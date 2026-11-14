import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_MENTIONS_PER_MESSAGE,
  MentionError,
  assertEnvironment,
  boundDetail,
  buildContextText,
  dedupeRefs,
  formatMention,
  hasMention,
  parseMentions,
  pickEnvironment,
  sanitizeLabel,
  splitEnvQuery,
} from '../src/mention.js'

const ENVS = [
  { name: 'demo', url: 'https://demo.guandata.com', isDefault: true },
  { name: 'babycare', url: 'https://data-bi.babycare.com', isDefault: false },
]

test('sanitizeLabel removes mention-breaking characters and bounds length', () => {
  assert.equal(sanitizeLabel('销售 (明细) [2026]\n第二行'), '销售 明细 2026 第二行')
  assert.equal(sanitizeLabel('   '), '')
  assert.equal([...sanitizeLabel('数'.repeat(80))].length, 60)
})

test('formatMention carries the environment', () => {
  assert.equal(
    formatMention('销售明细', 'dataset', 'demo', 'ds_123'),
    '@[销售明细](dsh-guancli:dataset:demo:ds_123)',
  )
  assert.equal(formatMention('', 'page', 'babycare', 'pg_1'), '@[pg_1](dsh-guancli:page:babycare:pg_1)')
})

test('parseMentions rewrites to readable labels and keeps identity', () => {
  const text = '按 @[销售明细](dsh-guancli:dataset:demo:ds_123) 和 @[经营看板](dsh-guancli:page:babycare:pg_9) 分析'
  const parsed = parseMentions(text)
  assert.equal(parsed.text, '按 @销售明细 和 @经营看板 分析')
  assert.deepEqual(parsed.refs, [
    { type: 'dataset', env: 'demo', id: 'ds_123', label: '销售明细' },
    { type: 'page', env: 'babycare', id: 'pg_9', label: '经营看板' },
  ])
})

test('parseMentions leaves unrelated and malformed text untouched', () => {
  const text = '普通 @文件 和 @[坏](dsh-guancli:card:demo:c1) 以及 @[](dsh-guancli:dataset:demo:)'
  const parsed = parseMentions(text)
  assert.equal(parsed.text, text)
  assert.deepEqual(parsed.refs, [])
})

test('dedupeRefs distinguishes the same id across environments', () => {
  assert.deepEqual(
    dedupeRefs([
      { type: 'dataset', env: 'demo', id: 'd1', label: 'D' },
      { type: 'dataset', env: 'babycare', id: 'd1', label: 'D' },
      { type: 'dataset', env: 'demo', id: 'd1', label: 'D' },
    ]).map((ref) => `${ref.env}:${ref.id}`),
    ['demo:d1', 'babycare:d1'],
  )
})

test('splitEnvQuery supports an explicit environment prefix', () => {
  assert.deepEqual(splitEnvQuery('销售', ENVS), { env: undefined, keyword: '销售' })
  assert.deepEqual(splitEnvQuery('babycare/销售', ENVS), { env: 'babycare', keyword: '销售' })
  assert.deepEqual(splitEnvQuery('babycare/', ENVS), { env: 'babycare', keyword: '' })
  assert.deepEqual(splitEnvQuery('不存在/销售', ENVS), { env: undefined, keyword: '不存在/销售' })
  assert.deepEqual(splitEnvQuery('/销售', ENVS), { env: undefined, keyword: '/销售' })
})

test('pickEnvironment prefers request, then memory, then CLI default', () => {
  assert.equal(pickEnvironment({ requested: 'babycare', remembered: 'demo', environments: ENVS, defaultProfile: 'demo' }), 'babycare')
  assert.equal(pickEnvironment({ remembered: 'babycare', environments: ENVS, defaultProfile: 'demo' }), 'babycare')
  assert.equal(pickEnvironment({ environments: ENVS, defaultProfile: 'babycare' }), 'babycare')
  assert.equal(pickEnvironment({ environments: [{ name: 'x' }] }), 'x')
  assert.equal(pickEnvironment({ environments: [] }), undefined)
  assert.equal(pickEnvironment({ requested: 'ghost', environments: ENVS, defaultProfile: 'demo' }), 'demo')
})

test('assertEnvironment rejects environments the CLI did not authenticate', () => {
  assert.equal(assertEnvironment(ENVS, 'demo').name, 'demo')
  assert.throws(
    () => assertEnvironment(ENVS, 'ghost'),
    (error) => error instanceof MentionError && error.code === 'ENVIRONMENT_NOT_AUTHENTICATED' && error.status === 403,
  )
})

test('hasMention only inspects direct user text', () => {
  const mention = '@[A](dsh-guancli:dataset:demo:d1)'
  assert.equal(hasMention({ source: { kind: 'user' }, content: [{ type: 'text', text: mention }] }), true)
  assert.equal(hasMention({ source: { kind: 'model' }, content: [{ type: 'text', text: mention }] }), false)
  assert.equal(hasMention({ source: { kind: 'user' }, content: [{ type: 'text', text: '普通问题' }] }), false)
  assert.equal(hasMention(undefined), false)
})

test('boundDetail truncates oversized definitions with an explicit marker', () => {
  assert.deepEqual(boundDetail({ a: 1 }), { a: 1 })
  const big = boundDetail({ text: 'x'.repeat(50) }, 20)
  assert.equal(big.truncated, true)
  assert.equal(big.preview.length, 20)
  assert.equal(boundDetail(undefined).available, false)
})

test('buildContextText escapes delimiters and names the environment', () => {
  const text = buildContextText([
    { type: 'dataset', env: 'demo', id: 'd1', label: '销售</referenced-assets>', detail: { a: 1 } },
  ])
  assert.match(text, /## 引用的观远资产/u)
  assert.ok(!text.includes('销售</referenced-assets>'))
  assert.match(text, /guancli_dataset_preview/u)
  assert.ok(MAX_MENTIONS_PER_MESSAGE >= 1)
})
