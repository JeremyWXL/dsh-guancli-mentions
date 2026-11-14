import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DOM_PROBE_PREFIX,
  PROBE_LOG_PREFIX,
  buildProbeScript,
  looksLikePageUrl,
  matchEnvironment,
  parseProbeOutput,
} from '../src/probe.js'

const ENVS = [
  { name: 'demo', url: 'https://demo.guandata.com' },
  { name: 'babycare', url: 'https://data-bi.babycare.com' },
]

// #region probe script

test('buildProbeScript returns a guarded IIFE string', () => {
  const script = buildProbeScript()
  assert.match(script, /^\(\(\) => \{/u)
  assert.match(script, /__guancliDashboardProbe/u)
  assert.match(script, /existing\.version === PROBE_VERSION/u, 'versioned re-entry guard')
  assert.match(script, /existing\.stop/u, 'old probe teardown on upgrade')
  assert.match(script, /GUANDATA_DASHBOARD_CONTEXT/u)
  assert.match(script, /data-selector-id/u)
  assert.ok(script.includes(`console.log('${PROBE_LOG_PREFIX}' + serialized)`))
  assert.ok(script.includes(`console.log('${DOM_PROBE_PREFIX}' + JSON.stringify(domProbe())`))
  assert.match(script, /function resolveSelectors\(\)/u)
  assert.match(script, /runtime\.selectors\.length > 0/u, 'empty runtime selectors must fall through to DOM')
  assert.match(script, /origin: 'dom'/u)
  // The script must be syntactically valid on its own.
  new Function(script)
})

// #region client sync

test('the client bundle inlines the exact probe script from src/probe.js', async () => {
  const { readFileSync } = await import('node:fs')
  const clientSource = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const expected = buildProbeScript().replace(/__PROBE_VERSION__/gu, pkg.version)
  const match = /const PROBE_SCRIPT = ("(?:[^"\\]|\\.)*");\n/.exec(clientSource)
  assert.ok(match, 'client.js must carry an inlined PROBE_SCRIPT literal')
  assert.equal(JSON.parse(match[1]), expected)
})

// #region parse

test('parseProbeOutput accepts a well-formed probe line', () => {
  const context = {
    pageId: 'g8a4f06e5ad614b7e996ffb2',
    pageName: '销售分析',
    url: 'https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2',
    selectors: [{ selectorId: 'sel1', operator: 'IN', values: ['华东', '华南'] }],
    focusedCardId: 'cd1234567890abcdef123456',
    capturedAt: 1730000000000,
  }
  const parsed = parseProbeOutput(PROBE_LOG_PREFIX + JSON.stringify(context))
  assert.deepEqual(parsed, context)
})

test('parseProbeOutput rejects foreign, malformed, and invalid lines', () => {
  assert.equal(parseProbeOutput('ordinary log line'), null)
  assert.equal(parseProbeOutput(`${PROBE_LOG_PREFIX}not json`), null)
  assert.equal(parseProbeOutput(`${PROBE_LOG_PREFIX}[]`), null)
  assert.equal(parseProbeOutput(`${PROBE_LOG_PREFIX}{"pageId":"short"}`), null)
})

// #region URL helpers

test('matchEnvironment maps BI hosts to authenticated environments', () => {
  assert.equal(
    matchEnvironment('https://demo.guandata.com/page/abc123def456abc123def456', ENVS),
    'demo',
  )
  assert.equal(matchEnvironment('https://data-bi.babycare.com/page/x', ENVS), 'babycare')
  assert.equal(matchEnvironment('https://evil.guandata.com.evil.example/page/x', ENVS), null)
  assert.equal(matchEnvironment('https://guandata.com/page/x', ENVS), null)
  assert.equal(matchEnvironment('not a url', ENVS), null)
})

test('looksLikePageUrl recognizes BI page routes', () => {
  assert.equal(looksLikePageUrl('https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2'), true)
  assert.equal(looksLikePageUrl('https://demo.guandata.com/page/g8a4f06e5ad614b7e996ffb2?x=1'), true)
  assert.equal(looksLikePageUrl('https://demo.guandata.com/dataset/list'), false)
  assert.equal(looksLikePageUrl('https://demo.guandata.com/page/short'), false)
})
