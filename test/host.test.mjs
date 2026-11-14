import assert from 'node:assert/strict'
import test from 'node:test'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { register } from 'node:module'

// Map '@deepseek-ai/dsh-tools' to a local stub so registerTools() works in tests.
register(new URL('./fixtures/dsh-tools-loader.mjs', import.meta.url))

/** Declared package version; the health payload must report it verbatim. */
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

/** Fake gateway: asset discovery fixtures keyed by environment and type. */
const FIXTURES = {
  'demo:dataset': [
    { type: 'dataset', id: 'ds_1', name: '销售明细', path: '根目录 / 销售' },
    { type: 'dataset', id: 'ds_2', name: '库存日报', path: '根目录 / 库存' },
  ],
  'demo:page': [{ type: 'page', id: 'pg_1', name: '销售看板', path: '根目录 / 看板' }],
  'babycare:dataset': [{ type: 'dataset', id: 'ds_9', name: '销售汇总', path: '' }],
  'babycare:page': [],
}

function fakeGateway() {
  return {
    async rpc(action, input) {
      if (action === 'assets.search') {
        const list = FIXTURES[`${input.profile}:${input.type}`] ?? []
        const needle = String(input.query ?? '').toLowerCase()
        return list.filter((asset) => asset.name.toLowerCase().includes(needle))
      }
      if (action === 'assets.inspect') {
        return { type: input.type, id: input.id, name: input.name, fields: [{ name: '金额' }] }
      }
      throw new Error(`unexpected rpc ${action}`)
    },
    async execute() {
      throw new Error('unbound session')
    },
  }
}

/** Write an executable fake guancli printing the supplied auth table. */
function fakeCli(authOutput) {
  const dir = mkdtempSync(join(tmpdir(), 'guancli-fake-'))
  const path = join(dir, 'guancli')
  const body = `#!/bin/sh
if [ "$1" = "auth" ]; then
  cat <<'AUTH'
${authOutput}
AUTH
  exit 0
fi
echo '{"rows":[]}'
`
  writeFileSync(path, body, 'utf8')
  chmodSync(path, 0o755)
  return path
}

const AUTH_OK = `已配置的环境:
  Public           https://app.guandata.com  [personal_token] (Domain=未设置, PAT=有效)
* demo             https://demo.guandata.com  [personal_token] (Domain=demo_e_commerce, PAT=有效)
  babycare         https://data-bi.babycare.com  [personal_token] (Domain=未设置, PAT=有效)
  expired          https://app.guandata.com  [password] (Domain=x, uIdToken=已过期)

* 表示默认环境`

const AUTH_EMPTY = `已配置的环境:
  expired          https://app.guandata.com  [password] (Domain=x, uIdToken=已过期)`

/** Boot the host half against fakes and return an RPC caller. */
async function boot(authOutput = AUTH_OK, options = {}) {
  const gateway = 'gateway' in options ? options.gateway : fakeGateway()
  process.env.GUANDATA_PLUGIN_GUANCLI = fakeCli(authOutput)
  const host = await import('../index.js')
  let route
  let preStep
  const tools = []
  const ctx = {
    logger: { warn() {}, error() {} },
    effect(run) {
      return run()
    },
    on(event, listener) {
      if (event === 'agent/pre-step') preStep = listener
      return () => {}
    },
    get(name) {
      return name === 'guandataGateway' ? gateway : undefined
    },
    webServer: {
      register(definition) {
        route = definition
        return () => {}
      },
      getOrigin() {
        return 'http://127.0.0.1:43129'
      },
    },
    tools: {
      register(definition) {
        tools.push(definition)
        return () => {}
      },
    },
  }
  host.apply(ctx)
  assert.ok(route, 'route must be registered')
  assert.equal(preStep !== undefined, true, 'pre-step listener must be registered')
  // registerTools resolves dsh-tools lazily; wait until all seven tools land.
  for (let attempt = 0; attempt < 200 && tools.length < 7; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.ok(tools.length >= 7, `expected 7 tools, got ${String(tools.length)} (state=${ctx.__mentionsRuntime.toolState})`)

  /** Invoke the route with a JSON body. */
  async function call(body, { method = 'POST', origin = 'http://127.0.0.1:43129', host: hostHeader = '127.0.0.1:43129' } = {}) {
    const payload = Buffer.from(JSON.stringify(body), 'utf8')
    const req = {
      method,
      headers: { host: hostHeader, origin, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      async *[Symbol.asyncIterator]() {
        yield payload
      },
    }
    let status = 0
    let text = ''
    const res = {
      writeHead(code) {
        status = code
      },
      end(chunk) {
        text = String(chunk ?? '')
      },
    }
    await route.handler(req, res)
    return { status, body: text === '' ? undefined : JSON.parse(text) }
  }

  /** Find a registered tool by name. */
  function tool(name) {
    const found = tools.find((definition) => definition.name === name)
    assert.ok(found, `tool ${name} must be registered`)
    return found
  }

  const exec = { signal: undefined }

  return { host, call, preStep: () => preStep, tool, tools, ctx, exec }
}

test('health reports version, gateway, environment count, and tool state', async () => {
  const { call } = await boot()
  const { status, body } = await call({ action: 'health' })
  assert.equal(status, 200)
  assert.equal(body.data.version, VERSION)
  assert.equal(body.data.gateway, true)
  assert.equal(body.data.environmentCount, 3)
})

test('environments action lists authenticated names and the CLI default', async () => {
  const { call } = await boot()
  const { body } = await call({ action: 'environments' })
  assert.equal(body.data.defaultProfile, 'demo')
  assert.deepEqual(body.data.environments, ['Public', 'demo', 'babycare'])
})

test('an empty query explains itself with the active environment and the others', async () => {
  const { call } = await boot()
  const { body } = await call({ action: 'candidates', input: { sessionId: 's1', query: '' } })
  assert.equal(body.data.state, 'need-query')
  assert.equal(body.data.env, 'demo')
  assert.deepEqual(body.data.environments, ['Public', 'demo', 'babycare'])
})

test('a keyword searches the default environment for datasets and pages', async () => {
  const { call } = await boot()
  const { body } = await call({ action: 'candidates', input: { sessionId: 's1', query: '销售' } })
  assert.equal(body.data.state, 'ok')
  assert.deepEqual(body.data.items.map((item) => `${item.type}:${item.id}:${item.env}`), [
    'dataset:ds_1:demo',
    'page:pg_1:demo',
  ])
})

test('an environment prefix switches environment and is remembered', async () => {
  const { call } = await boot()
  const first = await call({ action: 'candidates', input: { sessionId: 's2', query: 'babycare/销售' } })
  assert.equal(first.body.data.env, 'babycare')
  assert.deepEqual(first.body.data.items.map((item) => item.id), ['ds_9'])
  const second = await call({ action: 'candidates', input: { sessionId: 's2', query: '销售' } })
  assert.equal(second.body.data.env, 'babycare', 'remembered environment must persist')
})

test('an unknown prefix is not treated as an environment', async () => {
  const { call } = await boot()
  const { body } = await call({ action: 'candidates', input: { sessionId: 's3', query: 'ghost/销售' } })
  assert.equal(body.data.state, 'no-match')
  assert.equal(body.data.env, 'demo')
})

test('no authenticated environment is reported, not hidden', async () => {
  const { call } = await boot(AUTH_EMPTY)
  const { body } = await call({ action: 'candidates', input: { sessionId: 's4', query: '销售' } })
  assert.equal(body.data.state, 'no-environment')
  assert.deepEqual(body.data.environments, [])
})

test('a missing Guandata plugin is reported instead of pretending no match', async () => {
  const { call } = await boot(AUTH_OK, { gateway: null })
  const { body } = await call({ action: 'candidates', input: { sessionId: 's5', query: '销售' } })
  assert.equal(body.data.state, 'no-gateway')
})

test('search failures surface as an error state', async () => {
  const broken = {
    async rpc() {
      throw new Error('bi down')
    },
    async execute() {
      throw new Error('unbound')
    },
  }
  const { call } = await boot(AUTH_OK, { gateway: broken })
  const { body } = await call({ action: 'candidates', input: { sessionId: 's6', query: '销售' } })
  assert.equal(body.data.state, 'error')
})

test('the route rejects cross-origin callers, non-POST requests, and missing sessions', async () => {
  const { call } = await boot()
  assert.equal((await call({ action: 'health' }, { origin: 'https://evil.example' })).status, 403)
  assert.equal((await call({ action: 'health' }, { method: 'GET' })).status, 405)
  const missing = await call({ action: 'candidates', input: {} })
  assert.equal(missing.status, 400)
  assert.equal(missing.body.error.code, 'SESSION_REQUIRED')
})

// #region analysis tools integration

const META_STDOUT = `数据集: 04_SKU日销售明细 (ds_demo)
- 类型: CSV | 状态: FINISHED
- 路径: 根目录>测试
- 行数: 1.097292e+06 | 列数: 5
- 更新: 2026-05-11 17:10:03+0800


字段列表 (5列, 3维度, 2度量):
  - 日期 (DATE/DIM)
  - 门店ID (STRING/DIM)
  - SKU编码 (STRING/DIM)
  - 销售数量 (LONG/METRIC)
  - 销售金额 (DOUBLE/METRIC)
`

const AGG_ROWS = [
  { '门店ID': 'S0006', m1: 2671033.5 },
  { '门店ID': 'S0001', m1: 2665472 },
  { '门店ID': 'S0002', m1: 1200 },
]

/** Replace the runtime's CLI runner with a controllable fake. */
function stubRunner(booted, overrides = {}) {
  const calls = { executeSql: [], previewJson: [], datasetMeta: [], resourceUrl: [] }
  const runner = {
    async environments() {
      return { environments: [{ name: 'demo', url: 'https://x', isDefault: true }], defaultProfile: 'demo' }
    },
    async datasetMeta(input) {
      calls.datasetMeta.push(input)
      return META_STDOUT
    },
    async previewJson(input) {
      calls.previewJson.push(input)
      return overrides.previewRows ?? []
    },
    async executeSql(input) {
      calls.executeSql.push(input)
      if (overrides.sqlError !== undefined) throw new Error(overrides.sqlError)
      return overrides.sqlRows ?? []
    },
    async previewCard() {
      return []
    },
    async resourceUrl(input) {
      calls.resourceUrl.push(input)
      if (overrides.urlError !== undefined) throw new Error(overrides.urlError)
      return `https://${input.profile}.guandata.com/${input.assetType === 'page' ? 'page' : 'dataset'}/${input.assetId}`
    },
  }
  booted.ctx.__mentionsRuntime.runner = runner
  return calls
}

test('asset_overview returns role-tagged fields, samples, and questions', async () => {
  const booted = await boot()
  const calls = stubRunner(booted, {
    previewRows: [
      { '日期': '2026-11-01', '门店ID': 'S0001', 'SKU编码': 'SKU0001', '销售数量': '11', '销售金额': '308.0' },
      { '日期': '2026-11-02', '门店ID': 'S0002', 'SKU编码': 'SKU0002', '销售数量': '5', '销售金额': '175.0' },
    ],
    sqlRows: [{ min: '2026-01-01', max: '2026-11-10' }],
  })
  const result = await booted.tool('guancli_asset_overview').execute(
    { profile: 'demo', assetType: 'dataset', assetId: 'ds_demo' },
    booted.exec,
  )
  assert.equal(result.name, '04_SKU日销售明细')
  assert.equal(result.rowCount, 1097292)
  const roles = Object.fromEntries(result.fields.map((field) => [field.name, field.role]))
  assert.deepEqual(roles, { '日期': 'time', '门店ID': 'dimension', 'SKU编码': 'dimension', '销售数量': 'measure', '销售金额': 'measure' })
  assert.deepEqual(result.fields.find((field) => field.name === '门店ID').samples, ['S0001', 'S0002'])
  assert.deepEqual(result.timeRange, { field: '日期', min: '2026-01-01', max: '2026-11-10' })
  assert.ok(result.suggestedQuestions.length > 0)
  assert.equal(calls.executeSql.length, 1, 'time span probe runs one SQL')
})

test('field_profile returns the enum dictionary through the SQL path', async () => {
  const booted = await boot()
  stubRunner(booted, {
    sqlRows: [{ value: 'S0001', cnt: 8943 }, { value: 'S0002', cnt: 8939 }],
  })
  const result = await booted.tool('guancli_field_profile').execute(
    { profile: 'demo', datasetId: 'ds_demo', field: '门店ID' },
    booted.exec,
  )
  assert.equal(result.scope, 'full')
  assert.deepEqual(result.dictionary, [{ value: 'S0001', count: 8943 }, { value: 'S0002', count: 8939 }])
  assert.equal(result.highCardinality, false)
})

test('field_profile falls back to a tagged sample when SQL is disabled', async () => {
  const booted = await boot()
  stubRunner(booted, {
    sqlError: '高级 SQL 查询未开启，请联系管理员',
    previewRows: [
      { '门店ID': 'S0001' }, { '门店ID': 'S0001' }, { '门店ID': 'S0002' },
    ],
  })
  const result = await booted.tool('guancli_field_profile').execute(
    { profile: 'demo', datasetId: 'ds_demo', field: '门店ID' },
    booted.exec,
  )
  assert.equal(result.scope, 'sample')
  assert.equal(result.sampleSize, 3)
  assert.deepEqual(result.dictionary[0], { value: 'S0001', count: 2 })
  assert.match(result.note, /样本/u)
  const health = await booted.call({ action: 'health' })
  assert.match(health.body.data.sqlSupport.demo, /^no/u)
})

test('analyze_dataset aggregates server-side with insights and suggestions', async () => {
  const booted = await boot()
  const calls = stubRunner(booted, { sqlRows: AGG_ROWS })
  const result = await booted.tool('guancli_analyze_dataset').execute({
    profile: 'demo',
    datasetId: 'ds_demo',
    by: ['门店ID'],
    metric: [{ field: '销售金额', agg: 'sum' }],
    sort: { field: 'm1', direction: 'desc' },
    limit: 10,
  }, booted.exec)
  assert.equal(result.scope, 'full')
  assert.equal(result.rowCount, 3)
  assert.deepEqual(result.rows, AGG_ROWS)
  assert.equal(result.grouping[0], '门店ID')
  assert.match(calls.executeSql[0].sql, /GROUP BY `门店ID`/u)
  assert.match(calls.executeSql[0].sql, /SUM\(`销售金额`\) AS `m1`/u)
  assert.equal(result.truncated, false)
  assert.ok(Array.isArray(result.insights), 'insights attach to the result')
  assert.ok(result.suggestedQuestions.length > 0)
  assert.equal(typeof result.sql, 'string', 'generated SQL is exposed for audit')
})

test('analyze_dataset degrades to a bounded sample and marks scope', async () => {
  const booted = await boot()
  stubRunner(booted, {
    sqlError: '高级 SQL 查询功能未开启',
    previewRows: [
      { '门店ID': 'S0001', '销售金额': '100' },
      { '门店ID': 'S0001', '销售金额': '200' },
      { '门店ID': 'S0002', '销售金额': '900' },
    ],
  })
  const result = await booted.tool('guancli_analyze_dataset').execute({
    profile: 'demo',
    datasetId: 'ds_demo',
    by: ['门店ID'],
    metric: [{ field: '销售金额', agg: 'sum' }],
  }, booted.exec)
  assert.equal(result.scope, 'sample')
  assert.equal(result.sampleSize, 3)
  assert.match(result.degradedReason, /SQL/u)
  assert.deepEqual(result.rows, [
    { '门店ID': 'S0002', m1: 900 },
    { '门店ID': 'S0001', m1: 300 },
  ])
})

test('analyze_dataset translates business filters into the plan and SQL', async () => {
  const booted = await boot()
  const calls = stubRunner(booted, { sqlRows: AGG_ROWS })
  const now = new Date()
  await booted.tool('guancli_analyze_dataset').execute({
    profile: 'demo',
    datasetId: 'ds_demo',
    by: ['门店ID'],
    metric: [{ field: '销售金额', agg: 'sum' }],
    filters: [
      { field: '门店ID', op: 'in', value: ['S0001', 'S0006'] },
      { op: 'last_n_days', days: 30 },
    ],
    limit: 5,
  }, booted.exec)
  const sql = calls.executeSql[0].sql
  assert.match(sql, /`门店ID` IN \('S0001', 'S0006'\)/u)
  const year = String(now.getFullYear())
  assert.match(sql, new RegExp(`\`日期\` >= '${year}-`, 'u'), 'time shortcut binds to the sole time field')
  assert.match(sql, /LIMIT 5/u)
})

test('analyze_dataset rejects non-whitelist fields with spelling hints', async () => {
  const booted = await boot()
  stubRunner(booted, { sqlRows: AGG_ROWS })
  await assert.rejects(
    booted.tool('guancli_analyze_dataset').execute({
      profile: 'demo',
      datasetId: 'ds_demo',
      by: ['门店'],
      metric: [{ field: '销售金额', agg: 'sum' }],
    }, booted.exec),
    (error) => /门店ID/u.test(error.message) && /你是不是想用/u.test(error.message),
  )
  await assert.rejects(
    booted.tool('guancli_analyze_dataset').execute({
      profile: 'demo',
      datasetId: 'ds_demo',
      by: ['销售金额'],
      metric: [{ field: '销售金额', agg: 'sum' }],
    }, booted.exec),
    /不能作为分组维度/u,
  )
})

test('preview tools stay registered but demoted to sample-verification copy', async () => {
  const booted = await boot()
  const preview = booted.tool('guancli_dataset_preview')
  assert.match(preview.description, /不要用本工具做统计分析/u)
  const card = booted.tool('guancli_card_preview')
  assert.match(card.description, /统计分析优先/u)
})


test('pageUrl resolves a BI web URL for pages and datasets', async () => {
  const booted = await boot()
  const calls = stubRunner(booted)
  const page = await booted.call({
    action: 'pageUrl',
    input: { profile: 'demo', assetType: 'page', assetId: 'pg_1' },
  })
  assert.equal(page.body.data.url, 'https://demo.guandata.com/page/pg_1')
  const ds = await booted.call({
    action: 'pageUrl',
    input: { profile: 'demo', assetType: 'dataset', assetId: 'ds_9' },
  })
  assert.equal(ds.body.data.url, 'https://demo.guandata.com/dataset/ds_9')
  assert.equal(calls.resourceUrl.length, 2)
})

test('pageUrl rejects missing input and reports resolution failures', async () => {
  const booted = await boot()
  const missing = await booted.call({ action: 'pageUrl', input: { profile: 'demo' } })
  assert.equal(missing.status, 400)
  stubRunner(booted, { urlError: 'guancli url 输出中没有 Web URL 行' })
  const failed = await booted.call({
    action: 'pageUrl',
    input: { profile: 'demo', assetType: 'page', assetId: 'pg_1' },
  })
  assert.equal(failed.status, 500)
  assert.equal(failed.body.error.code, 'URL_RESOLVE_FAILED')
})
