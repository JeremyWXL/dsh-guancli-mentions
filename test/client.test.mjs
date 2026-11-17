import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { readFileSync } from 'node:fs'

/** Effect cleanups leaked by harness() modules (probe intervals and the like). */
const globalCleanups = []
afterEach(() => {
  while (globalCleanups.length > 0) globalCleanups.pop()()
})

/** Load the browser module body with a fake module loader, React, locale, and trigger service. */
function loadClientModule() {
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  let registration
  const window = {
    __ModuleLoader__: {
      load(entry) {
        registration = entry
      },
    },
  }
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  const primitives = { Modal: 'Modal', Button: 'Button' }
  const fn = new Function('window', `${source}\nreturn window.__ModuleLoader__;`)
  fn(window)
  assert.ok(registration, 'module must register through window.__ModuleLoader__.load')
  assert.equal(registration.id, '@local/dsh-guancli-mentions')
  return registration.factory((name) => {
    if (name === 'react') return react
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`unexpected module ${name}`)
  })
}

/** Build one client context that captures dictionaries, the source, and slot nodes. */
function harness(options = {}) {
  const body = loadClientModule()
  const captured = { dictionaries: undefined, source: undefined, rules: [], nodes: [], cleanups: [] }
  const ctx = {
    get remote() {
      for (const name of ['remote', 'remote.session']) {
        if (!body.inject.includes(name)) throw new Error(`cannot get property "${name}" without inject`)
      }
      return options.remote
    },
    contextMenus: options.contextMenus,
    effect(run) {
      const cleanup = run()
      if (typeof cleanup === 'function') {
        captured.cleanups.push(cleanup)
        globalCleanups.push(cleanup)
      }
      return cleanup
    },
    inject(_services, callback) {
      callback({
        effect: ctx.effect,
        locale: ctx.locale,
        get(name) {
          return captured.services?.[name]
        },
        sidebarRight: undefined,
        inputTriggers: {
          registerSource(source) {
            captured.source = source
            return () => {}
          },
        },
        uiConversation: {
          userText: {
            register(rule) {
              captured.rules.push(rule)
            },
          },
        },
        slots: {
          inject(_slotName, callback) {
            return callback()
          },
          register(definition, component) {
            captured.nodes.push({ definition, component })
            return () => {}
          },
        },
      })
    },
    locale: {
      register(_ns, dictionaries) {
        captured.dictionaries = dictionaries
        return () => {}
      },
      bind(ns) {
        assert.equal(ns, 'guancli-mentions')
        return (key) => {
          const dict = captured.dictionaries?.zh ?? {}
          return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key
        }
      },
    },
  }
  body.apply(ctx)
  return { body, captured }
}

/** Replace the global fetch for one call and restore it afterwards. */
async function withFetch(impl, run) {
  const original = globalThis.fetch
  globalThis.fetch = impl
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

/**
 * Answer one candidates call: the one-time health probe, then the fixed payload.
 * @param data - host candidates payload.
 * @param version - host version the probe reports.
 */
function answer(data, version = '0.10.1') {
  return withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    const reply = body.action === 'health' ? { version } : data
    return { json: async () => ({ ok: true, data: reply }) }
  }, () => harness().captured.source.candidates({ sessionId: 'session-1' }, { query: '销售', quoted: false }))
}

const session = { sessionId: 'session-1' }

/** Find one element in the small React element tree produced by the test stub. */
function findElement(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  return findElement([node.children, node.props?.footer], predicate)
}

test('module registers one "@" source named guancli', () => {
  const { captured } = harness()
  assert.ok(captured.source, 'source must be registered')
  assert.equal(captured.source.trigger, '@')
  assert.equal(captured.source.name, 'guancli')
  assert.equal(typeof captured.source.candidates, 'function')
  assert.equal(typeof captured.source.onPick, 'function')
})

test('every locale dictionary carries the same keys', () => {
  const { captured } = harness()
  const dicts = captured.dictionaries
  const locales = Object.keys(dicts)
  assert.deepEqual(locales.sort(), ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'])
  const keys = Object.keys(dicts.zh).sort()
  for (const locale of locales) {
    assert.deepEqual(Object.keys(dicts[locale]).sort(), keys, `${locale} keys differ`)
  }
  assert.equal(dicts.zh['section.datasets'], '观远数据集')
  assert.equal(dicts.zh['section.pages'], '观远看板')
})

test('candidates map datasets and pages into distinct sections with their environment', async () => {
  const rows = await answer({
    state: 'ok',
    env: 'demo',
    items: [
      { type: 'dataset', id: 'd1', name: '销售明细', path: '根目录/销售', env: 'demo' },
      { type: 'page', id: 'p1', name: '经营看板', env: 'demo' },
    ],
  })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].section, '观远数据集')
  assert.equal(rows[1].section, '观远看板')
  assert.equal(rows[0].description, 'demo · 根目录/销售')
  assert.deepEqual(JSON.parse(rows[0].value), { type: 'dataset', id: 'd1', name: '销售明细', env: 'demo' })
})

test('a stale host generation asks for the restart it needs', async () => {
  const rows = await answer({ items: [] }, '0.8.1')
  assert.match(rows[0].name, /重启/u)
  assert.deepEqual(JSON.parse(rows[0].value), { kind: 'hint' })
})

test('current and future host generations pass the version floor', async () => {
  for (const version of ['0.10.1', '0.10.10', '0.11.0', '1.0.0']) {
    const rows = await answer({ state: 'need-query', env: 'demo', environments: ['demo'] }, version)
    assert.match(rows[0].name, /关键词/u, `version ${version} must pass the gate`)
  }
})

test('an empty query explains how to search and which environments exist', async () => {
  const rows = await answer({
    state: 'need-query',
    env: 'demo',
    environments: ['demo', 'babycare'],
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].section, '观远数据')
  assert.match(rows[0].name, /demo/u)
  assert.match(rows[0].description, /babycare/u)
  assert.deepEqual(JSON.parse(rows[0].value), { kind: 'hint' })
})

test('a keyword without matches names the keyword and environment', async () => {
  const rows = await answer({ state: 'no-match', env: 'demo', keyword: '销售', environments: ['demo'] })
  assert.match(rows[0].name, /销售/u)
  assert.match(rows[0].name, /demo/u)
})

test('missing environments, missing CLI, and failures each explain themselves', async () => {
  const noEnv = await answer({ state: 'no-environment', environments: [] })
  assert.match(noEnv[0].name, /鉴权/u)
  const noCli = await answer({ state: 'no-cli', message: 'boom' })
  assert.match(noCli[0].name, /guancli/u)
  const failed = await withFetch(async () => {
    throw new TypeError('boom')
  }, () => harness().captured.source.candidates(session, { query: '', quoted: false }))
  assert.match(failed[0].name, /失败/u)
})

test('an aborted fetch keeps the menu empty rather than reporting failure', async () => {
  const rows = await withFetch(async () => {
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }, () => harness().captured.source.candidates(session, { query: '', quoted: false }))
  assert.deepEqual(rows, [])
})

test('quoted input and missing sessions produce no candidates', async () => {
  const { captured } = harness()
  assert.deepEqual(await captured.source.candidates(session, { query: 'x', quoted: true }), [])
  assert.deepEqual(await captured.source.candidates({}, { query: '', quoted: false }), [])
})

test('picking an asset inserts the canonical environment-scoped mention', () => {
  const { captured } = harness()
  const outcome = captured.source.onPick({
    candidate: { value: JSON.stringify({ type: 'dataset', id: 'ds_9', name: '销售 (明细)', env: 'demo' }) },
  })
  assert.equal(outcome.insert.source, 'guancli')
  assert.equal(outcome.insert.ref, '@[销售 明细](dsh-guancli:dataset:demo:ds_9)')
  assert.equal(outcome.insert.clipboardText, outcome.insert.ref)
  assert.equal(outcome.insert.label, '销售 明细')
  assert.equal(outcome.insert.appearance, undefined)
})

test('a picked chip serializes through its own codec instead of failing the send', async () => {
  const { captured } = harness()
  assert.equal(typeof captured.source.codec?.serialize, 'function')
  const ref = '@[销售 明细](dsh-guancli:dataset:demo:ds_9)'
  assert.equal(await captured.source.codec.serialize(ref), ref)
  assert.equal(captured.source.codec.clipboardText(ref), ref)
})

test('picking a hint row or malformed value inserts nothing', () => {
  const { captured } = harness()
  assert.equal(captured.source.onPick({ candidate: { value: JSON.stringify({ kind: 'hint' }) } }), undefined)
  assert.equal(captured.source.onPick({ candidate: { value: 'not json' } }), undefined)
  assert.equal(captured.source.onPick({ candidate: { value: JSON.stringify({ type: 'dataset', id: 'd1' }) } }), undefined)
})


// #region clickable asset links

const PAGE_MENTION = '@[经营看板](dsh-guancli:page:demo:pg_1)'
const DS_MENTION = '@[销售明细](dsh-guancli:dataset:demo:ds_9)'

test('the user-text rule extracts env and id from page and dataset mentions', () => {
  const { captured } = harness()
  const rule = captured.rules.find((candidate) => candidate.id === 'guancli-asset')
  assert.ok(rule, 'asset mention rule must be registered')
  const page = rule.match(`看看 ${PAGE_MENTION} 的数据`, 0)
  assert.deepEqual(page.data, { label: '经营看板', type: 'page', env: 'demo', id: 'pg_1' })
  assert.equal(page.start, 3)
  const ds = rule.match(DS_MENTION, 0)
  assert.equal(ds.data.type, 'dataset')
  assert.equal(ds.data.id, 'ds_9')
  assert.equal(rule.match('普通文本 @文件 没有 mention', 0), undefined)
  assert.equal(rule.match('@[坏](dsh-guancli:card:demo:c1)', 0), undefined)
})

test('clicking the asset chip resolves the URL and opens the sidebar browser', async () => {
  const { captured } = harness()
  const node = captured.nodes.find((entry) => entry.definition.key === 'guancli-asset')
  assert.ok(node, 'asset link node must be registered')
  const opened = []
  const openAsset = async (data) => {
    const result = await withFetch(async () => ({
      json: async () => ({ ok: true, data: { url: `https://demo.guandata.com/page/${data.id}` } }),
    }), async () => {
      // Mirror the client openAsset flow against a stubbed sidebarRight.
      const response = await fetch('/guancli-mentions/v1/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'pageUrl', input: data }),
      })
      return (await response.json()).data
    })
    opened.push({ kind: 'browser', params: { url: result.url } })
  }
  const zhDict = { 'asset.open': '在侧边栏打开 {name}' }
  const t = (key, values = {}) => String(zhDict[key] ?? key).replace(/\{(\w+)\}/gu, (_w, name) => values[name] ?? _w)
  const element = node.component({ node: { data: { label: '经营看板', type: 'page', env: 'demo', id: 'pg_1' } }, openAsset, t })
  assert.equal(element.type, 'button')
  assert.equal(element.props.title, '在侧边栏打开 经营看板')
  await element.props.onClick()
  assert.deepEqual(opened, [{ kind: 'browser', params: { url: 'https://demo.guandata.com/page/pg_1' } }])
})

test('scoped page links open a menu with adjust and open actions', async () => {
  const registered = []
  const opened = []
  const contextMenus = {
    register(input) { registered.push(input); return () => {} },
    open(target, point) { opened.push({ target, point }) },
  }
  const { captured } = harness({ contextMenus })
  const node = captured.nodes.find((entry) => entry.definition.key === 'guancli-asset')
  const data = { label: '销售看板', type: 'page', env: 'demo', id: 'pg_1', scopeId: 'scope-old' }
  const element = node.component({ node: { data }, sessionId: 'session-1', ...node.definition.inject() })
  assert.equal(element.props['aria-haspopup'], 'menu')
  element.props.onClick({
    preventDefault() {}, stopPropagation() {},
    currentTarget: { getBoundingClientRect: () => ({ left: 40, bottom: 60 }) },
  })
  assert.deepEqual(opened[0].point, { x: 40, y: 60 })
  assert.equal(opened[0].target.kind, 'guancli-asset')
  const actions = registered[0].resolve(opened[0].target.value)
  assert.deepEqual(actions.map((action) => action.label), ['调整数据范围', '打开页面'])

  await withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    const data = body.action === 'scope.get'
      ? {
          scopeId: 'scope-old', pageId: 'pg_1', pageName: '销售看板', summary: '区域=华东',
          selectors: [], frozen: true, edited: true, revision: 1,
        }
      : {
          scopeId: 'scope-new', pageId: 'pg_1', pageName: '销售看板', summary: '区域=华东',
          selectors: [], frozen: false, edited: false, revision: 2,
        }
    return { json: async () => ({ ok: true, data }) }
  }, () => actions[0].run())
  assert.equal(captured.source.scopeEditor.getSnapshot().scopeId, 'scope-new')
  assert.equal(captured.source.scopeEditor.getSnapshot().mode, 'confirm')
  assert.match(captured.source.scopeEditor.getSnapshot().reference, /scope=scope-new/u)
})

test('expired scoped links restore current page filters for confirmation', async () => {
  const { captured } = harness()
  const requests = []
  await withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    requests.push(body)
    if (body.action === 'scope.get') {
      return { json: async () => ({ ok: false, error: { message: '页面数据范围不存在' } }) }
    }
    return {
      json: async () => ({
        ok: true,
        data: {
          scopeId: 'scope-old', pageId: 'pg_1', pageName: '销售看板', summary: '区域=华东',
          source: 'restored', selectors: [], frozen: false, edited: false, revision: 0,
        },
      }),
    }
  }, async () => {
    const ref = '@[销售看板](dsh-guancli:page:demo:pg_1?scope=scope-old)'
    await captured.source.scopeEditor.open('session-1', ref, { confirm: true, revise: true })
  })
  const restore = requests.find((request) => request.action === 'scope.restore')
  assert.deepEqual(restore.input, {
    sessionId: 'session-1', scopeId: 'scope-old', profile: 'demo', pageId: 'pg_1',
  })
  const state = captured.source.scopeEditor.getSnapshot()
  assert.equal(state.restored, true)
  assert.equal(state.error, '')
  assert.equal(state.scopeId, 'scope-old')
  const modal = captured.source.ScopeEditor({ sessionId: 'session-1' })
  assert.match(JSON.stringify(modal), /原范围已失效/u)
  assert.ok(!JSON.stringify(modal).includes('正在读取页面筛选器'))
})

test('every locale dictionary carries the new asset.open keys', () => {
  const { captured } = harness()
  for (const dict of Object.values(captured.dictionaries)) {
    assert.equal(typeof dict['asset.open'], 'string')
    assert.equal(typeof dict['asset.openFailed'], 'string')
  }
})


// #region dashboard probe watcher

test('the probe watcher injects into BI webviews and forwards console contexts', async () => {
  const webviews = []
  const published = []
  const requests = []
  const handlers = new Map()
  const webview = {
    getURL: () => 'https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2',
    addEventListener(name, fn) {
      handlers.set(name, fn)
    },
    async executeJavaScript(script) {
      webviews.push(script)
      return 'installed'
    },
  }
  const originalDocument = globalThis.document
  globalThis.document = { querySelectorAll: () => [webview] }
  try {
    await withFetch(async (_url, init) => {
      const body = JSON.parse(init.body)
      requests.push(body.action)
      if (body.action === 'environments') {
        return { json: async () => ({ ok: true, data: { environments: [{ name: 'demo', url: 'https://demo.guandata.com' }] } }) }
      }
      if (body.action === 'context.publish') published.push(body.input.context)
      return { json: async () => ({ ok: true, data: { accepted: true } }) }
    }, async () => {
      const { captured } = harness()
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      assert.ok(webviews.length > 0, 'inlined probe script must be injected into the BI webview')
      assert.ok(webviews[0].includes('GUANDATA_DASHBOARD_CONTEXT'), 'injected code is the real probe')
      // Simulate the guest page emitting one context line.
      handlers.get('console-message')({
        message: '__GUANCLI_DASHBOARD_CONTEXT__' + JSON.stringify({
          pageId: 'g8a4f06e5ad614b7e996ffb2',
          pageName: '销售分析',
          url: 'https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2',
          selectors: [],
          focusedCardId: '',
          capturedAt: 1730000000000,
        }),
      })
      await new Promise((resolve) => setImmediate(resolve))
      for (const cleanup of captured.cleanups) cleanup()
    })
  } finally {
    globalThis.document = originalDocument
  }
  assert.deepEqual(published.map((context) => context.pageId), ['g8a4f06e5ad614b7e996ffb2'])
  assert.ok(requests.includes('environments'))
  assert.ok(requests.includes('context.publish'))
})


test('a first-load -6 failure on a BI page triggers one automatic reload', async () => {
  const webviews = []
  let reloads = 0
  const handlers = new Map()
  const webview = {
    getURL: () => 'https://demo.guandata.com/page/ia69fb0af56f3456e94bc7f0',
    addEventListener(name, fn) {
      handlers.set(name, fn)
    },
    async executeJavaScript() {
      return 'installed'
    },
    reload() {
      reloads += 1
    },
  }
  const originalDocument = globalThis.document
  globalThis.document = { querySelectorAll: () => [webview] }
  try {
    await withFetch(async (_url, init) => {
      const body = JSON.parse(init.body)
      if (body.action === 'environments') {
        return { json: async () => ({ ok: true, data: { environments: [{ name: 'demo', url: 'https://demo.guandata.com' }] } }) }
      }
      return { json: async () => ({ ok: true, data: { accepted: true } }) }
    }, async () => {
      const { captured } = harness()
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      handlers.get('did-fail-load')({ isMainFrame: true, errorCode: -6 })
      await new Promise((resolve) => setTimeout(resolve, 1200))
      handlers.get('did-fail-load')({ isMainFrame: true, errorCode: -6 })
      await new Promise((resolve) => setTimeout(resolve, 1200))
      for (const cleanup of captured.cleanups) cleanup()
    })
  } finally {
    globalThis.document = originalDocument
  }
  assert.equal(reloads, 1, 'exactly one automatic reload per webview')
})


test('the watcher self-reports its state through the recon channel', async () => {
  const webviews = []
  const handlers = new Map()
  const uploaded = []
  const webview = {
    getURL: () => 'https://demo.guandata.com/page/ia69fb0af56f3456e94bc7f0',
    addEventListener(name, fn) {
      handlers.set(name, fn)
    },
    async executeJavaScript() {
      webviews.push(true)
      return 'installed'
    },
  }
  const originalDocument = globalThis.document
  globalThis.document = { querySelectorAll: () => [webview] }
  try {
    await withFetch(async (_url, init) => {
      const body = JSON.parse(init.body)
      if (body.action === 'environments') {
        return { json: async () => ({ ok: true, data: { environments: [{ name: 'demo', url: 'https://demo.guandata.com' }] } }) }
      }
      uploaded.push(body.input.report)
      return { json: async () => ({ ok: true, data: { accepted: true } }) }
    }, async () => {
      const { captured } = harness()
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      for (const cleanup of captured.cleanups) cleanup()
    })
  } finally {
    globalThis.document = originalDocument
  }
  const state = uploaded.find((report) => report?.kind === 'probe-state')
  assert.ok(state, 'probe-state report must be uploaded')
  assert.equal(state.environments, 1)
  assert.equal(state.webviews, 1)
  assert.equal(state.biWebviews, 1)
  assert.ok(state.probeScriptChars > 1000)
})


test('page questions are delivered through the current remote session prompt', async () => {
  const prompts = []
  const remote = {
    session: {
      async prompt(input) {
        prompts.push(input)
      },
    },
  }
  const handlers = new Map()
  const webview = {
    getURL: () => 'https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2',
    addEventListener(name, fn) {
      handlers.set(name, fn)
    },
    async executeJavaScript() {
      return 'installed'
    },
  }
  const originalDocument = globalThis.document
  globalThis.document = { querySelectorAll: () => [webview] }
  try {
    await withFetch(async (_url, init) => {
      const body = JSON.parse(init.body)
      if (body.action === 'health') return { json: async () => ({ ok: true, data: { version: '0.5.19' } }) }
      if (body.action === 'environments') {
        return { json: async () => ({ ok: true, data: { defaultProfile: 'default', environments: [{ name: 'Public', url: 'https://demo.guandata.com' }, { name: 'default', url: 'https://demo.guandata.com' }] } }) }
      }
      if (body.action === 'candidates') {
        return { json: async () => ({ ok: true, data: { state: 'need-query', env: 'default', environments: ['Public', 'default'], items: [] } }) }
      }
      return { json: async () => ({ ok: true, data: { accepted: true } }) }
    }, async () => {
      const { captured } = harness({ remote })
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      await captured.source.candidates(session, { query: '', quoted: false })
      handlers.get('console-message')({
        message: '__GUANCLI_DASHBOARD_CONTEXT__' + JSON.stringify({
          pageId: 'g8a4f06e5ad614b7e996ffb2',
          pageName: '销售分析',
          url: 'https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2',
          selectors: [],
          focusedCardId: '',
          capturedAt: 1730000000000,
        }),
      })
      handlers.get('console-message')({
        message: '__GUANCLI_PAGE_ASK__' + JSON.stringify({
          text: '分析当前看板',
          url: 'https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2',
          at: 1730000000000,
        }),
      })
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      for (const cleanup of captured.cleanups) cleanup()
    })
  } finally {
    globalThis.document = originalDocument
  }
  assert.equal(prompts.length, 1, 'the page question must reach remote.session.prompt')
  assert.equal(prompts[0].sessionId, 'session-1')
  assert.equal(prompts[0].mode, 'queue')
  assert.match(prompts[0].content[0].text, /分析当前看板/u)
  assert.match(prompts[0].content[0].text, /dsh-guancli:page:default:g8a4f06e5ad614b7e996ffb2/u)
})

test('page chips carry their scope id and real filter summary', () => {
  const { captured } = harness()
  const outcome = captured.source.onPick({
    candidate: { value: JSON.stringify({
      type: 'page', id: 'pg_1', name: '销售看板', env: 'demo',
      scopeId: 'scope-1', scopeSummary: '区域=华东',
    }) },
  })
  assert.equal(outcome.insert.ref, '@[销售看板](dsh-guancli:page:demo:pg_1?scope=scope-1)')
  assert.equal(outcome.insert.label, '销售看板 · 区域=华东')
})

test('scope editor is mounted in the composer overlay with list-slot options', () => {
  const { captured } = harness()
  const node = captured.nodes.find((entry) => entry.definition.name === 'conversation.input.overlay')
  assert.ok(node, 'scope editor must register in conversation.input.overlay')
  assert.equal(node.definition.id, 'guancli-scope-editor')
  assert.equal(node.definition.order, 100)
  assert.equal(node.definition.key, undefined)
  assert.equal(node.definition.priority, undefined)
  assert.equal(node.component, captured.source.ScopeEditor)
})

test('scope editor loads real options, accepts a selection, and saves the same scope', async () => {
  const { captured } = harness()
  const scope = {
    scopeId: 'scope-1', pageId: 'pg_1', pageName: '销售看板', summary: '区域=华东',
    revision: 0, edited: false, frozen: false,
    selectors: [{
      id: 'region', name: '区域', type: 'DS_ELEMENTS', editable: true,
      multiSelect: false, values: ['华东'], displayValues: ['华东'],
    }, {
      id: 'tree', name: '树筛选', type: 'TREE', editable: false,
      multiSelect: false, values: [], displayValues: [],
    }],
  }
  const requests = []
  await withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    requests.push(body)
    const data = body.action === 'scope.get'
      ? scope
      : body.action === 'scope.options'
        ? { options: [{ value: '华东', label: '华东' }, { value: '华南', label: '华南' }] }
        : { ...scope, summary: '区域=华南', edited: true, revision: 1 }
    return { json: async () => ({ ok: true, data }) }
  }, async () => {
    const ref = '@[销售看板](dsh-guancli:page:demo:pg_1?scope=scope-1)'
    assert.equal(captured.source.openReference(session, { ref }), true)
    await captured.source.scopeEditor.open('session-1', ref)
    assert.deepEqual(captured.source.scopeEditor.getSnapshot().options.region, [
      { value: '华东', label: '华东' }, { value: '华南', label: '华南' },
    ])

    // Exercise the actual modal controls, not only the underlying store.
    const modal = captured.source.ScopeEditor({ sessionId: 'session-1' })
    assert.equal(modal.type, 'Modal')
    assert.equal(modal.props.open, true)
    assert.match(modal.props.title, /页面数据范围/u)
    const filterBar = findElement(modal, (element) => element.props?.className === 'guancli-scope-filter-bar')
    assert.ok(filterBar)
    assert.equal(filterBar.props.style.display, 'flex')
    assert.equal(filterBar.props.style.flexWrap, 'wrap')
    const filterChip = findElement(modal, (element) => element.props?.['data-filter-id'] === 'region')
    assert.equal(filterChip.props.style.display, 'inline-flex')
    const select = findElement(modal, (element) => element.type === 'select')
    assert.ok(select, 'the modal must render an interactive filter select')
    assert.equal(select.props.value, '华东')
    assert.equal(select.props.disabled, false)
    select.props.onChange({ target: { selectedOptions: [{ value: '华南' }] } })
    await new Promise((resolve) => setImmediate(resolve))

    const updated = captured.source.ScopeEditor({ sessionId: 'session-1' })
    const save = findElement(updated, (element) => element.type === 'Button' && element.props.variant === 'primary')
    assert.ok(save, 'the modal must render a save action')
    assert.equal(save.props.disabled, false)
    save.props.onClick()
    await new Promise((resolve) => setImmediate(resolve))
  })
  const saved = requests.find((request) => request.action === 'scope.save')
  assert.equal(saved.input.scopeId, 'scope-1')
  assert.deepEqual(saved.input.selections.region.values, ['华南'])
  assert.equal(saved.input.selections.tree, undefined)
  assert.equal(captured.source.scopeEditor.getSnapshot().scope.summary, '区域=华南')
  assert.equal(captured.source.openReference(session, { ref: '@[销售](dsh-guancli:dataset:demo:ds_1)' }), false)
})

test('multi-value page filters stay inside a compact checkbox chip', async () => {
  const { captured } = harness()
  const scope = {
    scopeId: 'scope-multi', pageId: 'pg_1', pageName: '销售看板', summary: '门店=华东店',
    revision: 0, edited: false, frozen: false,
    selectors: [{
      id: 'store', name: '门店', type: 'DS_ELEMENTS', editable: true,
      multiSelect: true, values: ['S0001'], displayValues: ['华东店'],
    }],
  }
  await withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    const data = body.action === 'scope.get'
      ? scope
      : { options: [{ value: 'S0001', label: '华东店' }, { value: 'S0002', label: '华南店' }] }
    return { json: async () => ({ ok: true, data }) }
  }, async () => {
    const ref = '@[销售看板](dsh-guancli:page:demo:pg_1?scope=scope-multi)'
    await captured.source.scopeEditor.open('session-1', ref)
    const modal = captured.source.ScopeEditor({ sessionId: 'session-1' })
    const details = findElement(modal, (element) => element.type === 'details')
    assert.ok(details, 'multi-select must use a popover instead of a tall native listbox')
    const checkbox = findElement(details, (element) => element.type === 'input' && element.props.value === 'S0002')
    assert.ok(checkbox)
    checkbox.props.onChange({ target: { checked: true } })
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(captured.source.scopeEditor.getSnapshot().selections.store, {
      values: ['S0001', 'S0002'], displayValues: ['华东店', '华南店'],
    })
  })
})

test('sent page mentions render filter chips and confirmation resumes the agent', async () => {
  const prompts = []
  const remote = { session: { async prompt(input) { prompts.push(input) } } }
  const { captured } = harness({ remote })
  const footer = captured.nodes.find((entry) => entry.definition.id === 'guancli-scope-confirmation')
  assert.ok(footer, 'scope confirmation chips must register in the user message footer')
  assert.equal(footer.definition.name, 'conversation.chat.userMessageFooter')
  assert.equal(footer.definition.order, 30)

  const ref = '@[销售看板](dsh-guancli:page:demo:pg_1?scope=scope-1)'
  const owner = { sessionId: 'session-1', message: { content: [{ type: 'text', text: `分析 ${ref}` }] } }
  const chip = findElement(footer.component(owner), (element) => element.props?.className === 'guancli-scope-filter-chip')
  assert.ok(chip, 'the sent page mention must render a filter-style chip')
  assert.match(JSON.stringify(chip), /确认数据范围/u)
  assert.equal(footer.component({ sessionId: 'session-1', message: { content: [{ type: 'text', text: '普通消息' }] } }), null)

  const scope = {
    scopeId: 'scope-1', pageId: 'pg_1', pageName: '销售看板', summary: '门店=S0001',
    revision: 0, edited: false, frozen: false,
    selectors: [{
      id: 'store', name: '门店', type: 'DS_ELEMENTS', editable: true,
      multiSelect: false, values: ['S0001'], displayValues: ['S0001'],
    }],
  }
  const requests = []
  await withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    requests.push(body)
    const data = body.action === 'scope.get'
      ? scope
      : body.action === 'scope.options'
        ? { options: [{ value: 'S0001', label: '华东店' }, { value: 'S0002', label: '华南店' }] }
        : { ...scope, summary: '门店=华南店', edited: true, frozen: true, revision: 1 }
    return { json: async () => ({ ok: true, data }) }
  }, async () => {
    await chip.props.onClick()
    assert.equal(captured.source.scopeEditor.getSnapshot().mode, 'confirm')
    const modal = captured.source.ScopeEditor({ sessionId: 'session-1' })
    const select = findElement(modal, (element) => element.type === 'select')
    assert.ok(select, 'the chip must open actual filter controls')
    select.props.onChange({ target: { selectedOptions: [{ value: 'S0002' }] } })
    await new Promise((resolve) => setImmediate(resolve))
    const textarea = findElement(modal, (element) => element.type === 'textarea')
    assert.ok(textarea, 'confirmation must include an analysis request input')
    textarea.props.onChange({ target: { value: '重点分析费用异常，并指出需要关注的业务单位' } })

    const updated = captured.source.ScopeEditor({ sessionId: 'session-1' })
    const confirm = findElement(updated, (element) => element.type === 'Button' && element.props.variant === 'primary')
    assert.ok(confirm)
    assert.match(JSON.stringify(confirm), /确认范围并继续/u)
    confirm.props.onClick()
    await new Promise((resolve) => setImmediate(resolve))
  })

  const confirmed = requests.find((request) => request.action === 'scope.confirm')
  assert.ok(confirmed, 'the GUI must call scope.confirm rather than only saving a draft')
  assert.deepEqual(confirmed.input.selections.store.values, ['S0002'])
  assert.equal(prompts.length, 1, 'confirmation must resume the same session')
  assert.equal(prompts[0].sessionId, 'session-1')
  assert.match(prompts[0].content[0].text, /scope=scope-1/u)
  assert.match(prompts[0].content[0].text, /门店=华南店/u)
  assert.ok(prompts[0].content[0].text.startsWith('重点分析费用异常，并指出需要关注的业务单位'))
  assert.equal(captured.source.scopeEditor.getSnapshot().open, false)
})

test('the user-text rule keeps the page id separate from its scope query', () => {
  const { captured } = harness()
  const rule = captured.rules.find((item) => item.id === 'guancli-asset')
  const text = '@[销售看板](dsh-guancli:page:demo:pg_1?scope=scope-1)'
  const matched = rule.match(text, 0)
  assert.equal(matched.end, text.length)
  assert.equal(matched.data.id, 'pg_1')
  assert.equal(matched.data.scopeId, 'scope-1')
})
