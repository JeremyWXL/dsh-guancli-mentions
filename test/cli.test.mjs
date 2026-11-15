import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GuancliRunner,
  normalizeAssetDetail,
  normalizeAssetSearch,
  parseAuthList,
} from '../src/cli.js'

/** Verbatim shape of `guancli auth list` stdout. */
const SAMPLE = `已配置的环境:
  Public           https://app.guandata.com  [personal_token] (Domain=未设置, PAT=有效)
  Workshop513      https://app.guandata.com  [password] (Domain=workshop513, uIdToken=有效)
* demo             https://demo.guandata.com  [personal_token] (Domain=demo_e_commerce, PAT=有效)
  finance-finance  https://app.guandata.com  [password] (Domain=finance, uIdToken=已过期)
  weinian          http://161.189.214.158  [password] (Domain=guanbi, uIdToken=已过期)

* 表示默认环境
`

test('parseAuthList keeps authenticated profiles and marks the default', () => {
  const { environments, defaultProfile } = parseAuthList(SAMPLE)
  assert.deepEqual(environments.map((environment) => environment.name), ['Public', 'Workshop513', 'demo'])
  assert.equal(defaultProfile, 'demo')
  assert.deepEqual(environments[2], {
    name: 'demo',
    url: 'https://demo.guandata.com',
    method: 'personal_token',
    isDefault: true,
  })
})

test('parseAuthList drops expired profiles and unrelated lines', () => {
  const { environments } = parseAuthList(SAMPLE)
  assert.ok(!environments.some((environment) => environment.name === 'finance-finance'))
  assert.ok(!environments.some((environment) => environment.name === 'weinian'))
  assert.equal(parseAuthList('').environments.length, 0)
  assert.equal(parseAuthList('已配置的环境:\n').defaultProfile, undefined)
})

test('parseAuthList survives a default marker on an expired profile', () => {
  const text = '* old  https://x.example  [token] (uIdToken=已过期)\n  live  https://y.example  [token] (PAT=有效)\n'
  const { environments, defaultProfile } = parseAuthList(text)
  assert.deepEqual(environments.map((environment) => environment.name), ['live'])
  assert.equal(defaultProfile, undefined)
})

test('previewCard keeps page context and applies its default filters', async () => {
  const runner = new GuancliRunner({ binary: 'unused' })
  const signal = new AbortController().signal
  let captured
  runner.json = async (args, receivedSignal) => {
    captured = { args, signal: receivedSignal }
    return []
  }
  await runner.previewCard({ profile: 'default', pageId: 'pg 1', cardId: 'cd 1', limit: 3, signal })
  assert.deepEqual(captured.args, [
    '--profile', 'default',
    'card', 'preview', 'cd 1',
    '--page-id', 'pg 1',
    '--with-default-filters',
    '--limit', '3',
    '-f', 'json',
  ])
  assert.equal(captured.signal, signal)
})

test('search normalization accepts CLI envelopes, aliases, paths, and deduplicates rows', () => {
  const payload = {
    data: {
      items: [
        { dsId: 'ds_1', dsName: '销售明细', dirPath: ['根目录', { name: '销售' }] },
        { id: 'ds_1', name: '重复项', path: '不应出现' },
        { dataset: { datasetId: 'ds_2', datasetName: '库存日报' }, parentDir: { dirName: '库存' } },
        { name: '缺少 ID 的坏行' },
      ],
    },
  }
  assert.deepEqual(normalizeAssetSearch(payload, 'dataset', 8), [
    { type: 'dataset', id: 'ds_1', name: '销售明细', path: '根目录 / 销售' },
    { type: 'dataset', id: 'ds_2', name: '库存日报', path: '库存' },
  ])
  assert.deepEqual(normalizeAssetSearch([], 'page'), [])
})

test('searchAssets invokes the matching CLI command and preserves cancellation', async () => {
  const runner = new GuancliRunner({ binary: 'unused' })
  const signal = new AbortController().signal
  let captured
  runner.json = async (args, receivedSignal) => {
    captured = { args, signal: receivedSignal }
    return { data: { pages: [{ pgId: 'pg 1', pgName: '销售看板', pathName: '根目录/看板' }] } }
  }
  const rows = await runner.searchAssets({
    profile: 'demo', assetType: 'page', query: '销售 看板', limit: 8, signal,
  })
  assert.deepEqual(captured.args, [
    '--raw',
    '--profile', 'demo',
    'page', 'search', '销售 看板',
    '--limit', '8',
    '--brief',
  ])
  assert.equal(captured.signal, signal)
  assert.deepEqual(rows, [{ type: 'page', id: 'pg 1', name: '销售看板', path: '根目录/看板' }])
})

test('normalizeAssetSearch 兼容 --raw 的 response.contents 和页面目录树', () => {
  const datasets = normalizeAssetSearch({
    result: 'ok',
    response: { contents: [{ id: 'ds_1', dsName: '客户表', dirPath: '/客户' }] },
  }, 'dataset', 8, '客户')
  assert.deepEqual(datasets, [{ type: 'dataset', id: 'ds_1', name: '客户表', path: '/客户' }])

  const payload = {
    result: 'ok',
    response: {
      contents: [{
        id: 'dir_1', name: '客户分析', isPage: false,
        contents: [{
          id: 'pg_1', name: '客户总览', isPage: true,
          uniformResourceType: 'DATA_ANALYSIS_PAGE',
        }],
      }],
    },
  }
  const pages = normalizeAssetSearch(payload, 'page', 8, '客户')
  assert.deepEqual(pages, [{ type: 'page', id: 'pg_1', name: '客户总览', path: '客户分析 / 客户总览' }])
  assert.deepEqual(normalizeAssetSearch(payload, 'page', 8, '不存在'), [])
})

test('inspect normalization keeps the definition and adds stable identity fields', () => {
  const detail = normalizeAssetDetail({
    data: {
      dsId: 'ds_1',
      dsName: '销售明细',
      path: [{ name: '根目录' }, { name: '销售' }],
      fields: [{ fdId: 'fd_1', name: '销售金额' }],
      lineage: { downstream: ['pg_1'] },
    },
  }, 'dataset', { id: 'ds_1' })
  assert.equal(detail.type, 'dataset')
  assert.equal(detail.id, 'ds_1')
  assert.equal(detail.name, '销售明细')
  assert.equal(detail.path, '根目录 / 销售')
  assert.deepEqual(detail.fields, [{ fdId: 'fd_1', name: '销售金额' }])
  assert.deepEqual(detail.lineage, { downstream: ['pg_1'] })
})

test('inspectAsset uses page get JSON and falls back to the mention label', async () => {
  const runner = new GuancliRunner({ binary: 'unused' })
  const signal = new AbortController().signal
  let captured
  runner.json = async (args, receivedSignal) => {
    captured = { args, signal: receivedSignal }
    return { pgId: 'pg_1', cards: [{ cdId: 'cd_1' }] }
  }
  const detail = await runner.inspectAsset({
    profile: 'demo', assetType: 'page', assetId: 'pg_1', name: '经营看板', signal,
  })
  assert.deepEqual(captured.args, [
    '--raw', '--profile', 'demo', 'page', 'get', 'pg_1', '--brief',
  ])
  assert.equal(captured.signal, signal)
  assert.equal(detail.type, 'page')
  assert.equal(detail.id, 'pg_1')
  assert.equal(detail.name, '经营看板')
  assert.deepEqual(detail.cards, [{ cdId: 'cd_1' }])
})

test('unknown successful CLI shapes fail instead of becoming false empty results', () => {
  assert.throws(() => normalizeAssetSearch({ data: { unexpected: true } }, 'dataset'), /资产列表/u)
  assert.throws(() => normalizeAssetDetail(null, 'page', { id: 'pg_1' }), /详情输出/u)
})
