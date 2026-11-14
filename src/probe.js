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
      // not filters — drop them; labeled ones are real selectors.
      if (cleaned.length === 0 || seen.has(fingerprint)) return
      if (extra?.name === undefined || extra.name === '') return
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
      const pills = [...box.querySelectorAll('.ant-select-selection-item,[aria-selected="true"]')]
        .map((el) => cleanText(el.getAttribute('title') || el.textContent))
        .filter((value) => value !== '' && !/^(全部|全选|请选择|搜索)$/iu.test(value))
      if (pills.length === 0) continue
      const label = cleanText(
        box.closest('[class*="filter"],[class*="Filter"],[class*="selector"],[data-selector-id]')?.querySelector('[class*="title"],[class*="label"],label')?.textContent
        || box.getAttribute('aria-label') || '',
      ).slice(0, 40)
      push('box:' + String(box.className || '').slice(0, 60) + ':' + label, pills, { name: label || undefined })
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
   * Pick the selector list: the runtime broadcast wins only when it
   * actually carries entries, then the identified-widget DOM pass, then
   * the wide pass. Entries are origin-tagged. 'precise' is false when the
   * wide pass carried the result — that is exactly when a DOM recon
   * report is most needed.
   */
  function resolveSelectors() {
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
  const onMessage = (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'GUANDATA_DASHBOARD_CONTEXT') return
    runtimeContext = event.data.context || null
    schedule()
  }
  document.addEventListener('click', onClick, true)
  document.addEventListener('change', schedule, true)
  window.addEventListener('popstate', schedule)
  window.addEventListener('hashchange', schedule)
  window.addEventListener('message', onMessage)
  globalThis.${PROBE_MARKER} = {
    version: PROBE_VERSION,
    stop: () => {
      clearTimeout(timer)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('change', schedule, true)
      window.removeEventListener('popstate', schedule)
      window.removeEventListener('hashchange', schedule)
      window.removeEventListener('message', onMessage)
    },
  }
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
