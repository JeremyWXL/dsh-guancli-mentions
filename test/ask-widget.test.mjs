import test from 'node:test'
import assert from 'node:assert/strict'
import { ASK_PREFIX, buildAskScript, parseAskOutput } from '../src/ask-widget.js'

test('parseAskOutput accepts a well-formed ask line', () => {
  const line = ASK_PREFIX + JSON.stringify({ text: '退货率为什么升高？', url: 'https://app.guandata.com/page/abc', at: 123 })
  assert.deepEqual(parseAskOutput(line), { text: '退货率为什么升高？', url: 'https://app.guandata.com/page/abc', at: 123 })
})

test('parseAskOutput rejects foreign, empty, and oversized lines', () => {
  assert.equal(parseAskOutput('hello'), null)
  assert.equal(parseAskOutput(ASK_PREFIX + 'not-json'), null)
  assert.equal(parseAskOutput(ASK_PREFIX + JSON.stringify({ text: '   ' })), null)
  assert.equal(parseAskOutput(ASK_PREFIX + JSON.stringify({ text: 'x'.repeat(4001) })), null)
  assert.equal(parseAskOutput(ASK_PREFIX + JSON.stringify([1, 2])), null)
})

test('buildAskScript embeds the prefix and marker guards', () => {
  const script = buildAskScript()
  assert.ok(script.includes(ASK_PREFIX))
  assert.ok(script.includes('__guancliAskWidget'))
  assert.ok(script.includes('__guancliAskAck'))
  // The IIFE must be syntactically valid JavaScript.
  new Function(script)
})
