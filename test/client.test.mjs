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

/** Build one client context that captures dictionaries and the registered source. */
function harness() {
  const body = loadClientModule()
  const captured = { dictionaries: undefined, source: undefined }
  const ctx = {
    effect(run) {
      return run()
    },
    inject(_services, callback) {
      callback({
        effect: ctx.effect,
        locale: ctx.locale,
        inputTriggers: {
          registerSource(source) {
            captured.source = source
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
