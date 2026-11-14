import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAuthList } from '../src/cli.js'

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
