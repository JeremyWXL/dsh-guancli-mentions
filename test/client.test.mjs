import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

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
  }
  const fn = new Function('window', `${source}\nreturn window.__ModuleLoader__;`)
  fn(window)
  assert.ok(registration, 'module must register through window.__ModuleLoader__.load')
  assert.equal(registration.id, '@local/dsh-guancli-mentions')
  return registration.factory((name) => {
    assert.equal(name, 'react')
    return react
  })
}

/** Build one client context that captures dictionaries, the source, and slot nodes. */
function harness() {
  const body = loadClientModule()
  const captured = { dictionaries: undefined, source: undefined, rules: [], nodes: [] }
  const ctx = {
    effect(run) {
      return run()
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
function answer(data, version = '0.2.0') {
  return withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    const reply = body.action === 'health' ? { version } : data
    return { json: async () => ({ ok: true, data: reply }) }
  }, () => harness().captured.source.candidates({ sessionId: 'session-1' }, { query: '销售', quoted: false }))
}

const session = { sessionId: 'session-1' }

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
  const rows = await answer({ items: [] }, '0.1.0')
  assert.match(rows[0].name, /重启/u)
  assert.deepEqual(JSON.parse(rows[0].value), { kind: 'hint' })
})

test('current and future host generations pass the version floor', async () => {
  for (const version of ['0.2.0', '0.3.0', '0.10.1', '1.0.0']) {
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

test('every locale dictionary carries the new asset.open keys', () => {
  const { captured } = harness()
  for (const dict of Object.values(captured.dictionaries)) {
    assert.equal(typeof dict['asset.open'], 'string')
    assert.equal(typeof dict['asset.openFailed'], 'string')
  }
})
