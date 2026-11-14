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
  if (globalThis.${PROBE_MARKER}) return 'already-installed'
  globalThis.${PROBE_MARKER} = true

  const ID_PATTERN = /^[a-z0-9]{24}$/i
  const ROOT_SELECTOR = '[data-selector-id],[data-cd-id],[data-card-id],[data-component-id]'
  const MAX_SELECTORS = ${String(MAX_SELECTORS)}
  const MAX_VALUES = ${String(MAX_VALUES)}
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
      selections.push({ selectorId, values, displayValues: values, operator: values.length > 1 ? 'IN' : 'EQ' })
      if (selections.length >= MAX_SELECTORS) break
    }
    return selections
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
    return {
      pageId: currentPageId,
      pageName: cleanText(runtime.pageName || document.querySelector('[data-page-name],h1')?.textContent || document.title),
      url: safeUrl(),
      selectors: Array.isArray(runtime.selectors) ? runtime.selectors.slice(0, MAX_SELECTORS) : domSelectors(),
      focusedCardId: String(runtime.focusedCardId || focusedCardId || ''),
      capturedAt: Date.now(),
    }
  }

  function publish() {
    const value = snapshot()
    if (!ID_PATTERN.test(value.pageId)) return
    const serialized = JSON.stringify(value)
    if (serialized === lastPublished) return
    lastPublished = serialized
    console.log('${PROBE_LOG_PREFIX}' + serialized)
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(publish, 600)
  }

  document.addEventListener('click', (event) => {
    const root = event.target?.closest?.(ROOT_SELECTOR)
    const id = idFrom(root)
    if (id) focusedCardId = id
    schedule()
  }, true)
  document.addEventListener('change', schedule, true)
  window.addEventListener('popstate', schedule)
  window.addEventListener('hashchange', schedule)
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'GUANDATA_DASHBOARD_CONTEXT') return
    runtimeContext = event.data.context || null
    schedule()
  })
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
