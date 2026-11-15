/**
 * Dashboard probe: a self-contained script injected into the sidebar webview
 * that watches the Guandata BI page and reports its interactive state.
 *
 * Data sources, best first (same priority the official companion plugin uses):
 *  1. `GUANDATA_DASHBOARD_CONTEXT` — the BI frontend broadcasts the full
 *     structured context (selectors with per-card/dataset field targets).
 *  2. DOM fallback — selected values of `[data-selector-id]` widgets plus
 *     click-captured focused card.
 *
 * The guest page cannot message the renderer directly, so the probe writes
 * one console line per change; the plugin's renderer listener filters the
 * prefix. Pure functions here are unit-tested without a browser.
 */

/** Guest-side marker guarding against double injection. */
export const PROBE_MARKER = '__guancliDashboardProbe'

/** Console line prefix the renderer listener scans for. */
export const PROBE_LOG_PREFIX = '__GUANCLI_DASHBOARD_CONTEXT__'

/** Console line prefix for DOM recon reports (selector list stayed empty). */
export const DOM_PROBE_PREFIX = '__GUANCLI_DOM_PROBE__'

/** Console line prefix for the probe heartbeat. */
export const HEARTBEAT_PREFIX = '__GUANCLI_HEARTBEAT__'

/** Console line prefix for network recon (fetch/XHR request capture). */
export const NET_PROBE_PREFIX = '__GUANCLI_NET_PROBE__'

/** How long a captured context stays "fresh" for tools and pre-step. */
export const CONTEXT_FRESH_MS = 5 * 60_000

/** Max selectors and values carried in one published context. */
export const MAX_SELECTORS = 30
export const MAX_VALUES = 50

/**
 * Build the probe script body (an IIFE string) for `webview.executeJavaScript`.
 * @returns JavaScript source text.
 */
export function buildProbeScript() {
  return `(() => {
  const PROBE_VERSION = '__PROBE_VERSION__'
  const existing = globalThis.${PROBE_MARKER}
  if (existing && existing.version === PROBE_VERSION) return 'already-installed'
  if (existing && typeof existing.stop === 'function') existing.stop()

  const ID_PATTERN = /^[a-z0-9]{24}$/i
  const ROOT_SELECTOR = '[data-selector-id],[data-cd-id],[data-card-id],[data-component-id]'
  const MAX_SELECTORS = ${String(MAX_SELECTORS)}
  const MAX_VALUES = ${String(MAX_VALUES)}
  const DOM_PROBE_PREFIX = '${DOM_PROBE_PREFIX}'
  const HEARTBEAT_PREFIX = '${HEARTBEAT_PREFIX}'
  const NET_PROBE_PREFIX = '${NET_PROBE_PREFIX}'
  let focusedCardId = ''
  let runtimeContext = null
  let timer = null
  let lastPublished = ''

  function idFrom(element) {
    if (!element) return ''
    for (const name of ['data-selector-id', 'data-cd-id', 'data-card-id', 'data-component-id']) {
      const value = element.getAttribute?.(name) || ''
      if (ID_PATTERN.test(value)) return value
    }
    return ID_PATTERN.test(element.id || '') ? element.id : ''
  }

  function pageId() {
    try {
      const url = new URL(location.href)
      for (const key of ['pageId', 'page_id', 'pgId', 'pg_id']) {
        const value = url.searchParams.get(key) || new URLSearchParams(url.hash.split('?')[1] || '').get(key)
        if (ID_PATTERN.test(value || '')) return value
      }
      const routeMatch = location.href.match(/(?:page|dashboard|analysis)[/=:]([a-z0-9]{24})(?:[/?#&]|$)/i)
      if (routeMatch) return routeMatch[1]
      for (const selector of ['[data-page-id]', '[data-pg-id]']) {
        const node = document.querySelector(selector)
        const value = node?.getAttribute(selector.includes('page') ? 'data-page-id' : 'data-pg-id') || ''
        if (ID_PATTERN.test(value)) return value
      }
    } catch (_error) {}
    return ''
  }

  function cleanText(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim().slice(0, 500)
  }

  function selectedValues(root) {
    const values = []
    const add = (value) => {
      const normalized = cleanText(value)
      if (!normalized || /^(全部|全选|请选择|搜索)$/i.test(normalized) || values.includes(normalized)) return
      values.push(normalized)
    }
    for (const option of root.querySelectorAll('select option:checked')) add(option.value || option.textContent)
    for (const input of root.querySelectorAll('input[type="checkbox"]:checked,input[type="radio"]:checked')) add(input.value || input.getAttribute('aria-label'))
    for (const input of root.querySelectorAll('input:not([type="checkbox"]):not([type="radio"])')) if (input.value) add(input.value)
    for (const node of root.querySelectorAll('[aria-selected="true"],.ant-select-selection-item')) add(node.getAttribute('title') || node.textContent)
    return values.slice(0, MAX_VALUES)
  }

  function domSelectors() {
    const selections = []
    const seen = new Set()
    for (const root of document.querySelectorAll(ROOT_SELECTOR)) {
      const selectorId = idFrom(root)
      if (!selectorId || seen.has(selectorId)) continue
      const values = selectedValues(root)
      if (!values.length) continue
      seen.add(selectorId)
      selections.push({ selectorId, values, displayValues: values, operator: values.length > 1 ? 'IN' : 'EQ', origin: 'dom' })
      if (selections.length >= MAX_SELECTORS) break
    }
    return selections
  }

  /**
   * Wide-pass capture for BI builds whose filter widgets carry no
   * data-* identity: aggregate selected pills per combobox, plus valued
   * inputs and checked options. Fingerprinted by container class+label,
   * origin-tagged 'dom-wide'; noise is accepted over silence — the merge
   * step whitelists by field name anyway.
   */
  function wideSelectors() {
    const out = []
    const seen = new Set()
    const push = (fingerprint, values, extra) => {
      const cleaned = values.map(cleanText).filter((value) => value !== '')
      // Unlabeled widgets are canvas layout controls (e.g. '自动铺满(70%)'),
      // not filters — drop them; labeled ones are real selectors. Segmented
      // widgets pass unnamed: their selected state is unambiguous.
      if (cleaned.length === 0 || seen.has(fingerprint)) return
      if ((extra?.name === undefined || extra.name === '') && extra?.widget !== 'segmented') return
      seen.add(fingerprint)
      out.push({
        selectorId: 'wide-' + String(out.length + 1),
        values: cleaned.slice(0, MAX_VALUES),
        displayValues: cleaned.slice(0, MAX_VALUES),
        operator: cleaned.length > 1 ? 'IN' : 'EQ',
        origin: 'dom-wide',
        ...extra,
      })
    }
    for (const box of document.querySelectorAll('[role="combobox"],.ant-select,[class*="Select"],[class*="selector"]')) {
      // Canvas layout chrome (the '自动铺满(70%)' zoom control), not a filter.
      if (String(box.className || '').includes('scale-selector') || box.closest('.scale-selector') !== null) continue
      const items = [...box.querySelectorAll('.ant-select-selection-item,[aria-selected="true"]')]
      const pills = items
        .map((el) => cleanText(el.getAttribute('title') || el.textContent))
        .filter((value) => value !== '' && !/^(全部|全选|请选择|搜索)$/iu.test(value))
      if (pills.length === 0 && !(items.length > 0 && box.matches('.SEL_select, [class*="SEL_"]'))) continue
      // Page filters in this BI build carry SEL_ class tokens; prefer a
      // label from the nearest filter container over generic text.
      const holder = box.closest('[class*="SEL_"],[class*="filter"],[class*="Filter"],[class*="selector"],[data-selector-id]')
      const label = cleanText(
        holder?.querySelector('[class*="title"],[class*="label"],label')?.textContent
        || box.getAttribute('aria-label') || '',
      ).slice(0, 40)
      push('box:' + String(box.className || '').slice(0, 60) + ':' + label, pills, {
        name: label || undefined,
        ...(pills.length === 0 ? { applied: false } : {}),
      })
    }
    // Segmented single-select widgets (e.g. LR=可用库存): the selected item
    // is unambiguous even without a label, so accept unnamed ones — BI uses
    // segmented almost exclusively for filters/switches, not layout.
    for (const seg of document.querySelectorAll('.ant-segmented')) {
      if (String(seg.className || '').includes('scale-selector') || seg.closest('.scale-selector') !== null) continue
      const selected = seg.querySelector('.ant-segmented-item-selected')
      const value = cleanText(selected?.textContent || '')
      if (value === '' || /^(全部|全选|请选择|搜索)$/iu.test(value)) continue
      const holder = seg.closest('[class*="SEL_"],[class*="filter"],[class*="Filter"]')
      const label = cleanText(
        holder?.querySelector('[class*="title"],[class*="label"],label')?.textContent
        || seg.getAttribute('aria-label') || '',
      ).slice(0, 40)
      push('seg:' + String(seg.className || '').slice(0, 60) + ':' + label, [value], { name: label || undefined, widget: 'segmented' })
    }
    for (const input of document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])')) {
      const value = cleanText(input.value)
      if (value === '') continue
      const label = cleanText(input.getAttribute('placeholder') || input.getAttribute('aria-label') || input.name || '').slice(0, 40)
      push('input:' + String(input.name || input.id || input.className || '').slice(0, 60) + ':' + label, [value], { name: label || undefined })
    }
    for (const select of document.querySelectorAll('select')) {
      const values = [...select.selectedOptions].map((option) => cleanText(option.value || option.textContent)).filter((value) => value !== '')
      if (values.length === 0) continue
      push('select:' + String(select.name || select.id || '').slice(0, 60), values, { name: cleanText(select.name || '').slice(0, 40) || undefined })
    }
    return out.slice(0, MAX_SELECTORS)
  }

  /**
   * Pick the selector list: network-captured filters win (they carry the
   * exact selector→field→dataset binding from the BI query payload), then
   * the runtime broadcast when it actually carries entries, then the
   * identified-widget DOM pass, then the wide pass. Entries are
   * origin-tagged. 'precise' is false only when the wide pass carried the
   * result — that is exactly when a DOM recon report is most needed.
   */
  function resolveSelectors() {
    const net = [...netSelectors.values()].filter((entry) => entry.applied !== false)
    if (net.length > 0) return { list: net.slice(0, MAX_SELECTORS), precise: true }
    const runtime = runtimeContext && typeof runtimeContext === 'object' ? runtimeContext : {}
    if (Array.isArray(runtime.selectors) && runtime.selectors.length > 0) {
      return { list: runtime.selectors.slice(0, MAX_SELECTORS).map((selector) => ({ origin: 'runtime', ...selector })), precise: true }
    }
    const dom = domSelectors()
    if (dom.length > 0) return { list: dom, precise: true }
    return { list: wideSelectors(), precise: false }
  }

  function safeUrl() {
    try {
      const url = new URL(location.href)
      const hashPath = url.hash ? url.hash.split('?')[0] : ''
      return url.origin + url.pathname + hashPath
    } catch (_error) {
      return location.href
    }
  }

  function snapshot() {
    const runtime = runtimeContext && typeof runtimeContext === 'object' ? runtimeContext : {}
    const currentPageId = String(runtime.pageId || pageId())
    const resolved = resolveSelectors()
    return {
      pageId: currentPageId,
      pageName: cleanText(runtime.pageName || document.querySelector('[data-page-name],h1')?.textContent || document.title),
      url: safeUrl(),
      selectors: resolved.list,
      selectorPrecise: resolved.precise,
      focusedCardId: String(runtime.focusedCardId || focusedCardId || ''),
      capturedAt: Date.now(),
    }
  }

  /** Last DOM recon emission, throttled to one per 30 seconds. */
  let lastDomProbeAt = 0
  /** Last heartbeat emission, throttled to one per 20 seconds. */
  let lastHeartbeatAt = 0

  /**
   * Recon pass over unknown BI DOM: input/select inventory, data-* attribute
   * names, and candidate listbox/filter containers. Sent only while the
   * selector list stays empty so the plugin author can adapt the real DOM.
   */
  function domProbe() {
    const inputs = []
    for (const el of document.querySelectorAll('input, select, textarea')) {
      inputs.push({
        tag: el.tagName.toLowerCase(),
        type: el.type || '',
        name: el.getAttribute('name') || '',
        placeholder: (el.getAttribute('placeholder') || '').slice(0, 60),
        value: String(el.value ?? '').slice(0, 60),
        cls: String(el.className || '').slice(0, 80),
        label: String(el.getAttribute('aria-label') || (el.closest('label')?.textContent || '')).slice(0, 60),
        data: Object.keys(el.dataset || {}).slice(0, 8),
      })
      if (inputs.length >= 40) break
    }
    const dataNames = new Set()
    for (const el of document.querySelectorAll('[data-selector-id],[data-cd-id],[data-card-id],[data-component-id],[data-page-id]')) {
      for (const attr of el.attributes) if (attr.name.startsWith('data-')) dataNames.add(attr.name)
    }
    const containers = []
    for (const el of document.querySelectorAll('[role="listbox"],[role="combobox"],[class*="select"],[class*="selector"],[class*="filter"]')) {
      containers.push({
        cls: String(el.className || '').slice(0, 80),
        text: cleanText(el.textContent).slice(0, 80),
        role: el.getAttribute('role') || '',
      })
      if (containers.length >= 25) break
    }
    return {
      kind: 'dom-probe',
      url: safeUrl(),
      title: cleanText(document.title),
      dataNames: [...dataNames],
      inputs,
      containers,
    }
  }

  function heartbeat() {
    if (Date.now() - lastHeartbeatAt < 20_000) return
    lastHeartbeatAt = Date.now()
    console.log('${HEARTBEAT_PREFIX}' + JSON.stringify({
      kind: 'heartbeat',
      href: (() => { try { return location.href } catch (_e) { return '' } })(),
      pageId: pageId(),
      readyState: document.readyState,
      at: Date.now(),
    }))
  }

  // #region network recon: capture the BI page's own API calls.
  // Filter changes on a BI dashboard are re-queried through fetch/XHR; the
  // request payload carries the exact selector→field→dataset mapping that
  // neither the (nonexistent) runtime broadcast nor the DOM can provide.
  // Phase 1 is reconnaissance: report endpoint inventory plus JSON request
  // bodies so the selector extractor can be written against real payloads.

  /** Per-page capture budgets; recon must never flood the console. */
  const NET_MAX_COMPACT = 120
  const NET_MAX_DETAILED = 30
  /** Static assets and telemetry never carry dashboard state. */
  const NET_SKIP_PATH = /\\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|map|ico)(?:[?#]|$)|\\/(?:static|vendor|polyfill)\\/|log|track|sentry|monitor|heartbeat/i
  /** Paths whose JSON bodies are always captured in detail. */
  const NET_DETAIL_PATH = /query|condition|selector|filter|page|card|data|ds|batch|search|report|chart/i
  const netState = { seen: new Set(), compact: 0, detailed: 0 }

  /**
   * Live selector state learned from card query payloads, keyed by the
   * source selector control id. Each /api/card/<cdId>/data request repeats
   * the page's applied filters with exact bindings:
   *   { name, fdId, dsId, cdId, filterType, sourceCdId, filterValue[] }
   * so one entry per selector aggregates every bound (dsId, field) pair.
   */
  const netSelectors = new Map()

  /** Card data queries repeat the applied page filters in their body. */
  const NET_CARD_DATA_PATH = /\\/api\\/card\\/[a-z0-9]{24}\\/data$/i

  /**
   * Fold one card-query body into netSelectors. A filter entry with an
   * empty filterValue means the selector was cleared for that card.
   * @returns whether any selector entry changed.
   */
  function ingestCardQuery(bodyText) {
    let parsed
    try {
      parsed = JSON.parse(bodyText)
    } catch (_error) {
      return false
    }
    const filters = parsed && Array.isArray(parsed.filters) ? parsed.filters : null
    if (filters === null) return false
    let changed = false
    for (const filter of filters) {
      if (filter === null || typeof filter !== 'object') continue
      const selectorId = String(filter.sourceCdId || '')
      if (selectorId === '') continue
      const values = (Array.isArray(filter.filterValue) ? filter.filterValue : [])
        .map((value) => (value === null || typeof value === 'object' ? JSON.stringify(value) : String(value)))
        .filter((value) => value !== '')
        .slice(0, MAX_VALUES)
      let entry = netSelectors.get(selectorId)
      if (entry === undefined) {
        entry = { selectorId, name: '', operator: '', values: [], displayValues: [], targets: [], origin: 'net', applied: false }
        netSelectors.set(selectorId, entry)
      }
      const name = String(filter.name || '')
      const operator = String(filter.filterType || '')
      const display = (Array.isArray(filter.displayValue) ? filter.displayValue : [])
        .map((value) => String(value || ''))
        .filter((value) => value !== '')
        .slice(0, MAX_VALUES)
      if (name !== '' && entry.name !== name) { entry.name = name; changed = true }
      if (operator !== '' && entry.operator !== operator) { entry.operator = operator; changed = true }
      if (JSON.stringify(entry.values) !== JSON.stringify(values)) { entry.values = values; changed = true }
      if (display.length > 0 && JSON.stringify(entry.displayValues) !== JSON.stringify(display)) { entry.displayValues = display; changed = true }
      const applied = values.length > 0
      if (entry.applied !== applied) { entry.applied = applied; changed = true }
      const dsId = String(filter.dsId || '')
      const fdId = String(filter.fdId || '')
      if (dsId !== '' && !entry.targets.some((target) => String(target.dsId) === dsId && String(target.fdId) === fdId)) {
        entry.targets.push({ dsId, name, fdId })
        changed = true
      }
    }
    return changed
  }

  function netUrl(rawUrl) {
    try {
      return new URL(rawUrl, location.href)
    } catch (_error) {
      return null
    }
  }

  /**
   * Report one request: a compact inventory line per unique signature, plus a
   * detailed JSON-body dump for query-looking endpoints.
   */
  function netCapture(method, rawUrl, body) {
    const url = netUrl(rawUrl)
    if (url === null || url.origin !== location.origin) return
    const path = url.pathname
    if (NET_SKIP_PATH.test(path)) return
    const bodyText = typeof body === 'string' ? body : ''
    // State ingestion is independent of recon budgets: a card query updates
    // the live selector map even when its body is not worth reporting.
    if (NET_CARD_DATA_PATH.test(path) && bodyText.charAt(0) === '{' && ingestCardQuery(bodyText)) {
      schedule()
    }
    const key = method + ' ' + path + ' #' + String(bodyText.length) + ':' + bodyText.slice(0, 64)
    if (netState.seen.has(key)) return
    netState.seen.add(key)
    if (netState.compact < NET_MAX_COMPACT) {
      netState.compact += 1
      console.log(NET_PROBE_PREFIX + JSON.stringify({ kind: 'net-req', method, path, bodyBytes: bodyText.length, at: Date.now() }))
    }
    if (bodyText === '' || bodyText.charAt(0) !== '{') return
    if (!NET_DETAIL_PATH.test(path) && netState.detailed >= 5) return
    if (netState.detailed >= NET_MAX_DETAILED) return
    netState.detailed += 1
    console.log(NET_PROBE_PREFIX + JSON.stringify({
      kind: 'net-req-body',
      method,
      path,
      body: bodyText.slice(0, 11000),
      truncated: bodyText.length > 11000,
      at: Date.now(),
    }).slice(0, 12000))
  }

  /** Monkey-patch fetch and XHR; originals are restorable via unhookNetwork. */
  function hookNetwork() {
    const w = window
    if (typeof w.fetch === 'function' && w.fetch.__guancliOriginal === undefined) {
      const original = w.fetch
      const hooked = function (input, init) {
        try {
          const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase()
          const url = typeof input === 'string' ? input : String((input && input.url) || '')
          if (method !== 'GET' && method !== 'HEAD') netCapture(method, url, init && init.body)
        } catch (_error) {}
        return original.apply(this, arguments)
      }
      hooked.__guancliOriginal = original
      w.fetch = hooked
    }
    const proto = typeof XMLHttpRequest === 'function' ? XMLHttpRequest.prototype : null
    if (proto !== null && proto.__guancliOriginal === undefined) {
      const open = proto.open
      const send = proto.send
      proto.open = function (method, url) {
        this.__guancliReq = { method: String(method || 'GET').toUpperCase(), url: String(url || '') }
        return open.apply(this, arguments)
      }
      proto.send = function (body) {
        try {
          const req = this.__guancliReq
          if (req && req.method !== 'GET' && req.method !== 'HEAD') {
            netCapture(req.method, req.url, typeof body === 'string' ? body : '')
          }
        } catch (_error) {}
        return send.apply(this, arguments)
      }
      proto.__guancliOriginal = { open, send }
    }
  }

  /** Restore the page's original fetch/XHR (probe upgrade or teardown). */
  function unhookNetwork() {
    const w = window
    if (w.fetch && w.fetch.__guancliOriginal !== undefined) w.fetch = w.fetch.__guancliOriginal
    const proto = typeof XMLHttpRequest === 'function' ? XMLHttpRequest.prototype : null
    if (proto !== null && proto.__guancliOriginal !== undefined) {
      proto.open = proto.__guancliOriginal.open
      proto.send = proto.__guancliOriginal.send
      delete proto.__guancliOriginal
    }
  }
  // #endregion

  function publish() {
    const value = snapshot()
    if (!ID_PATTERN.test(value.pageId)) return
    const serialized = JSON.stringify(value)
    if (serialized !== lastPublished) {
      lastPublished = serialized
      console.log('${PROBE_LOG_PREFIX}' + serialized)
    }
    if (value.selectorPrecise !== true && Date.now() - lastDomProbeAt > 30_000) {
      lastDomProbeAt = Date.now()
      console.log('${DOM_PROBE_PREFIX}' + JSON.stringify(domProbe()).slice(0, 16 * 1024))
    }
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(publish, 600)
  }

  const onClick = (event) => {
    const root = event.target?.closest?.(ROOT_SELECTOR)
    const id = idFrom(root)
    if (id) focusedCardId = id
    schedule()
  }
  const onDomReady = () => {
    heartbeat()
    schedule()
  }
  const onMessage = (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'GUANDATA_DASHBOARD_CONTEXT') return
    runtimeContext = event.data.context || null
    schedule()
  }
  document.addEventListener('click', onClick, true)
  document.addEventListener('change', schedule, true)
  document.addEventListener('DOMContentLoaded', onDomReady)
  window.addEventListener('popstate', schedule)
  window.addEventListener('hashchange', schedule)
  window.addEventListener('message', onMessage)
  globalThis.${PROBE_MARKER} = {
    version: PROBE_VERSION,
    stop: () => {
      clearTimeout(timer)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('change', schedule, true)
      document.removeEventListener('DOMContentLoaded', onDomReady)
      window.removeEventListener('popstate', schedule)
      window.removeEventListener('hashchange', schedule)
      window.removeEventListener('message', onMessage)
      unhookNetwork()
    },
  }
  hookNetwork()
  heartbeat()
  schedule()
  return 'installed'
})()`
}

/**
 * Parse one console line emitted by the probe.
 * @param text - console message text.
 * @returns the context object, or null when the line is not probe output.
 */
export function parseProbeOutput(text) {
  const raw = String(text ?? '')
  if (!raw.startsWith(PROBE_LOG_PREFIX)) return null
  try {
    const value = JSON.parse(raw.slice(PROBE_LOG_PREFIX.length))
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    if (!/^[a-z0-9]{24}$/i.test(String(value.pageId ?? ''))) return null
    return {
      pageId: String(value.pageId),
      pageName: String(value.pageName ?? ''),
      url: String(value.url ?? ''),
      selectors: Array.isArray(value.selectors) ? value.selectors : [],
      focusedCardId: String(value.focusedCardId ?? ''),
      capturedAt: Number(value.capturedAt ?? 0),
    }
  } catch {
    return null
  }
}

/**
 * Extract the BI environment name whose base URL matches the page.
 * @param rawUrl - current webview URL.
 * @param environments - authenticated environments with URLs.
 * @returns the matching environment name, or null.
 */
export function matchEnvironment(rawUrl, environments) {
  let host = ''
  try {
    host = new URL(String(rawUrl ?? '')).hostname.toLowerCase()
  } catch {
    return null
  }
  if (host === '') return null
  for (const environment of environments ?? []) {
    try {
      const envHost = new URL(String(environment.url ?? '')).hostname.toLowerCase()
      if (envHost !== '' && (host === envHost || host.endsWith(`.${envHost}`))) {
        return String(environment.name)
      }
    } catch {
      // Skip malformed environment URLs.
    }
  }
  return null
}

/**
 * Whether the URL already identifies a dashboard page by itself.
 * @param rawUrl - any URL.
 * @returns true when the path looks like a BI page route.
 */
export function looksLikePageUrl(rawUrl) {
  return /(?:page|dashboard|analysis)[/=:][a-z0-9]{24}(?:[/?#&]|$)/iu.test(String(rawUrl ?? ''))
}
