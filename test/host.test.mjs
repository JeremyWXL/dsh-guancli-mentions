import assert from 'node:assert/strict'
import test from 'node:test'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
    tools: { register() {} },
  }
  host.apply(ctx)
  assert.ok(route, 'route must be registered')
  assert.equal(preStep !== undefined, true, 'pre-step listener must be registered')

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

  return { host, call, preStep: () => preStep }
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
