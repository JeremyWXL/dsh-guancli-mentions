/**
 * Page ask widget: a self-contained floating chat panel injected into the
 * sidebar webview alongside the dashboard probe, so the user can question
 * the Agent while browsing a Guandata dashboard.
 *
 * The channel is one-way out of the page (console lines, same pattern as
 * the probe) plus a best-effort ack injected back by the plugin Client via
 * webview.executeJavaScript. Pure helpers here are unit-tested without a
 * browser.
 */

/** Console line prefix carrying one question to the plugin Client. */
export const ASK_PREFIX = '__GUANCLI_PAGE_ASK__'

/** Global ack callback name the plugin Client invokes after delivery. */
export const ASK_ACK_GLOBAL = '__guancliAskAck'

/** Guest-side marker guarding against double injection. */
export const ASK_MARKER = '__guancliAskWidget'

/**
 * Parse one console line emitted by the widget.
 * @param text - console message text.
 * @returns the question object, or null when the line is not widget output.
 */
export function parseAskOutput(text) {
  const raw = String(text ?? '')
  if (!raw.startsWith(ASK_PREFIX)) return null
  try {
    const value = JSON.parse(raw.slice(ASK_PREFIX.length))
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const question = String(value.text ?? '').trim()
    if (question === '' || question.length > 4000) return null
    return {
      text: question,
      url: String(value.url ?? '').slice(0, 500),
      at: Number(value.at ?? 0),
    }
  } catch {
    return null
  }
}

/**
 * Build the widget script body (an IIFE string) for `webview.executeJavaScript`.
 * @returns JavaScript source text.
 */
export function buildAskScript() {
  return `(() => {
  const ASK_VERSION = '__ASK_VERSION__'
  const existing = globalThis.${ASK_MARKER}
  if (existing && existing.version === ASK_VERSION) return 'already-installed'
  if (existing && typeof existing.stop === 'function') existing.stop()

  const ASK_PREFIX = '${ASK_PREFIX}'
  const STYLE = {
    bubble: 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:6px;padding:8px 14px;border:none;border-radius:20px;background:#0F6FE0;color:#fff;font:13px/1.4 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;box-shadow:0 4px 16px rgba(15,111,224,.35);cursor:pointer;',
    panel: 'position:fixed;right:16px;bottom:60px;z-index:2147483647;width:320px;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.18);font:13px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f2329;',
    title: 'display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:13px;',
    close: 'border:none;background:none;cursor:pointer;font-size:14px;color:#646a73;padding:0 4px;',
    area: 'width:100%;min-height:72px;max-height:160px;resize:vertical;padding:8px;border:1px solid #dee0e3;border-radius:8px;font:13px/1.5 inherit;box-sizing:border-box;outline:none;',
    row: 'display:flex;justify-content:space-between;align-items:center;gap:8px;',
    status: 'flex:1;font-size:12px;color:#646a73;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    send: 'border:none;border-radius:8px;padding:6px 16px;background:#0F6FE0;color:#fff;font-size:13px;cursor:pointer;',
  }

  let container = null
  let panel = null
  let textarea = null
  let status = null

  function el(tag, style, text) {
    const node = document.createElement(tag)
    node.setAttribute('style', style)
    if (text !== undefined) node.textContent = text
    return node
  }

  /** Ack channel: the plugin Client calls this after delivery. */
  globalThis.${ASK_ACK_GLOBAL} = (result) => {
    if (status === null) return
    if (result && result.ok === true) {
      status.textContent = '已发送到主会话，回答请查看 DSH 对话区'
      if (textarea !== null) textarea.value = ''
    } else {
      status.textContent = '发送失败：' + String((result && result.error) || '插件未响应')
    }
  }

  function send() {
    const text = String(textarea?.value ?? '').trim()
    if (text === '') {
      status.textContent = '先输入问题'
      return
    }
    console.log(ASK_PREFIX + JSON.stringify({ text, url: location.href, at: Date.now() }))
    status.textContent = '发送中…'
  }

  function toggle(show) {
    if (panel !== null) panel.style.display = show ? 'flex' : 'none'
    if (show && textarea !== null) textarea.focus()
  }

  function install() {
    container = document.createElement('div')
    container.id = 'guancli-ask-widget'

    const bubble = el('button', STYLE.bubble, '💬 问 Agent')
    bubble.type = 'button'
    bubble.addEventListener('click', () => toggle(panel === null || panel.style.display === 'none'))

    panel = el('div', STYLE.panel)
    panel.style.display = 'none'
    const title = el('div', STYLE.title)
    title.appendChild(el('span', '', '向 Agent 提问'))
    const close = el('button', STYLE.close, '✕')
    close.type = 'button'
    close.setAttribute('aria-label', '关闭')
    close.addEventListener('click', () => toggle(false))
    title.appendChild(close)

    textarea = el('textarea', STYLE.area)
    textarea.placeholder = '针对当前看板提问…（Enter 发送，Shift+Enter 换行）'
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault()
        send()
      }
    })

    const row = el('div', STYLE.row)
    status = el('span', STYLE.status, '问题会附带当前看板上下文')
    const button = el('button', STYLE.send, '发送')
    button.type = 'button'
    button.addEventListener('click', send)
    row.appendChild(status)
    row.appendChild(button)

    panel.appendChild(title)
    panel.appendChild(textarea)
    panel.appendChild(row)
    container.appendChild(bubble)
    container.appendChild(panel)
    ;(document.body || document.documentElement).appendChild(container)
  }

  install()
  globalThis.${ASK_MARKER} = {
    version: ASK_VERSION,
    stop: () => {
      container?.remove()
      container = null
      panel = null
      textarea = null
      status = null
      delete globalThis.${ASK_ACK_GLOBAL}
    },
  }
  return 'installed'
})()`
}
