/**
 * Inline the ask-widget script into client.js as a JSON literal, so widget
 * iterations ship with the client bundle (refresh-only) instead of the
 * Host module (restart-required). Run after editing src/ask-widget.js:
 *   node scripts/sync-ask.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { buildAskScript } from '../src/ask-widget.js'

const clientPath = new URL('../client.js', import.meta.url)
const source = readFileSync(clientPath, 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const script = buildAskScript().replace(/__ASK_VERSION__/gu, pkg.version)
const pattern = /const ASK_SCRIPT = [\s\S]*?;\n\/\/ __ASK_SCRIPT_INLINED__\n/
if (!pattern.test(source)) {
  throw new Error('ASK_SCRIPT anchor missing in client.js (expected `const ASK_SCRIPT = …;` followed by // __ASK_SCRIPT_INLINED__)')
}
writeFileSync(clientPath, source.replace(pattern, `const ASK_SCRIPT = ${JSON.stringify(script)};\n// __ASK_SCRIPT_INLINED__\n`))
console.log(`ASK_SCRIPT synced (${String(script.length)} chars)`)
