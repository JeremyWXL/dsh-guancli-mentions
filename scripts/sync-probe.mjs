/**
 * Inline the probe script into client.js as a JSON literal, so probe
 * iterations ship with the client bundle (refresh-only) instead of the
 * Host module (restart-required). Run after editing src/probe.js:
 *   node scripts/sync-probe.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { buildProbeScript } from '../src/probe.js'

const clientPath = new URL('../client.js', import.meta.url)
const source = readFileSync(clientPath, 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const script = buildProbeScript().replace(/__PROBE_VERSION__/gu, pkg.version)
const pattern = /const PROBE_SCRIPT = [\s\S]*?;\n\/\/ __PROBE_SCRIPT_INLINED__\n/
if (!pattern.test(source)) {
  throw new Error('PROBE_SCRIPT anchor missing in client.js (expected `const PROBE_SCRIPT = …;` followed by // __PROBE_SCRIPT_INLINED__)')
}
writeFileSync(clientPath, source.replace(pattern, `const PROBE_SCRIPT = ${JSON.stringify(script)};\n// __PROBE_SCRIPT_INLINED__\n`))
console.log(`PROBE_SCRIPT synced (${String(script.length)} chars)`)
