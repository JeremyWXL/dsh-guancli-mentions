/**
 * Read-only guancli runner.
 *
 * Environment discovery, asset search/inspect, previews, URL resolution, and
 * aggregation all use argument arrays with `shell: false`, keeping asset ids,
 * filters, and profile names out of a shell. JSON normalization lives here so
 * the Host and Browser see one stable asset contract across CLI versions.
 */

import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { delimiter } from 'node:path'

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024

/** Environment text the CLI prints before the profile table. */
const AUTH_HEADER = '已配置的环境'

/**
 * Parse `guancli auth list` output.
 * @param text - raw stdout.
 * @returns `{ environments, defaultProfile }`; invalid or expired entries are dropped.
 */
export function parseAuthList(text) {
  const environments = []
  let defaultProfile
  for (const line of String(text ?? '').split('\n')) {
    if (!line.includes('[')) continue
    const match = /^\s*(\*)?\s*(\S+)\s+(https?:\/\/\S+)\s+\[([^\]]+)\]\s+\((.*)\)\s*$/u.exec(line)
    if (match === null) continue
    const [, star, name, url, method, facts] = match
    const valid = /有效/u.test(facts) && !/已过期/u.test(facts)
    if (!valid) continue
    const isDefault = star === '*'
    if (isDefault) defaultProfile = name
    environments.push({ name, url, method, isDefault })
  }
  return { environments, defaultProfile }
}

/** Keys used by guancli JSON list envelopes, old and new. */
const ASSET_LIST_KEYS = [
  'items', 'list', 'rows', 'records', 'results', 'assets', 'datasets', 'pages', 'contents', 'data', 'result', 'response',
]

/**
 * Find the asset array in a direct CLI JSON result. Search output has existed
 * as a bare array and as nested list/data envelopes; do not silently turn an
 * unfamiliar successful response into a false "no match".
 * @param payload - parsed CLI JSON.
 * @param depth - recursion guard.
 * @returns the asset list, or undefined when the envelope is not recognized.
 */
function assetList(payload, depth = 0) {
  if (Array.isArray(payload)) return payload
  if (payload === null || typeof payload !== 'object' || depth > 4) return undefined
  for (const key of ASSET_LIST_KEYS) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  for (const key of ASSET_LIST_KEYS) {
    const value = payload[key]
    if (value === null || typeof value !== 'object') continue
    const nested = assetList(value, depth + 1)
    if (nested !== undefined) return nested
  }
  return undefined
}

/**
 * Read the first present scalar from a set of CLI field aliases.
 * @param source - asset object.
 * @param keys - preferred field names.
 * @returns a scalar value, or undefined.
 */
function firstScalar(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim() !== '') return value
  }
  return undefined
}

/**
 * Normalize a CLI path (string, node array, or directory object) to the string
 * consumed by the existing candidate UI.
 * @param value - raw path value.
 * @param depth - recursion guard.
 * @returns display path, or undefined.
 */
function displayPath(value, depth = 0) {
  if (depth > 5) return undefined
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? undefined : text
  }
  if (Array.isArray(value)) {
    const parts = value.map((part) => displayPath(part, depth + 1)).filter(Boolean)
    return parts.length === 0 ? undefined : parts.join(' / ')
  }
  if (value === null || typeof value !== 'object') return undefined
  const label = firstScalar(value, ['name', 'dirName', 'title', 'label'])
  if (label !== undefined) return String(label)
  for (const key of ['path', 'dirPath', 'fullPath', 'pathName', 'parentPath', 'names', 'parents']) {
    if (value[key] !== undefined) {
      const text = displayPath(value[key], depth + 1)
      if (text !== undefined) return text
    }
  }
  return undefined
}

/** @returns the normalized path on a raw asset, if one is available. */
function assetPath(source) {
  for (const key of ['path', 'dirPath', 'fullPath', 'pathName', 'parentPath', 'directoryPath']) {
    const text = displayPath(source?.[key])
    if (text !== undefined) return text
  }
  for (const key of ['parentDir', 'directory', 'dir']) {
    const text = displayPath(source?.[key])
    if (text !== undefined) return text
  }
  return undefined
}

/**
 * Convert dataset/page aliases to the candidate contract used by client.js.
 * @param source - raw asset object.
 * @param type - dataset or page.
 * @param fallback - id/name supplied by the caller for inspect.
 * @returns normalized asset, or null when the row has no usable id.
 */
function normalizeAsset(source, type, fallback = {}) {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) return null
  const resourceKey = type === 'page' ? 'page' : 'dataset'
  const nested = source[resourceKey]
  const raw = nested !== null && typeof nested === 'object' && !Array.isArray(nested)
    ? { ...nested, ...source }
    : source
  const id = firstScalar(raw, [
    'id',
    ...(type === 'page' ? ['pgId', 'pageId'] : ['dsId', 'datasetId']),
    'resourceId',
  ]) ?? fallback.id
  if (id === undefined || String(id).trim() === '') return null
  const name = firstScalar(raw, [
    'name',
    ...(type === 'page' ? ['pgName', 'pageName'] : ['dsName', 'datasetName']),
    'title', 'resourceName',
  ]) ?? fallback.name ?? id
  const path = assetPath(raw)
  return {
    type,
    id: String(id),
    name: String(name),
    ...(path === undefined ? {} : { path }),
  }
}

/**
 * Flatten the raw page-search directory tree. In --raw mode the CLI ignores
 * the keyword and returns the full tree, so filtering must happen locally.
 * @param payload - parsed CLI JSON.
 * @param query - original search keyword.
 * @param limit - maximum rows.
 * @returns whether page nodes were found, plus normalized matches.
 */
function pageTreeSearch(payload, query, limit) {
  const terms = String(query ?? '').trim().toLowerCase().split(/\s+/u).filter(Boolean)
  const rows = []
  const seen = new Set()
  let found = false

  function visit(value, trail = []) {
    if (rows.length >= limit || value === null || typeof value !== 'object') return
    if (Array.isArray(value)) {
      for (const item of value) visit(item, trail)
      return
    }
    for (const key of ['response', 'data', 'result']) {
      if (value[key] !== null && typeof value[key] === 'object') {
        visit(value[key], trail)
        return
      }
    }

    const name = firstScalar(value, ['name', 'pgName', 'pageName', 'title'])
    const resourceType = String(value.uniformResourceType ?? '')
    const isPage = value.isPage === true
      || firstScalar(value, ['pgId', 'pageId']) !== undefined
      || value.pgType !== undefined
      || /^(?:DATA_ANALYSIS_PAGE|DATA_ANALYSIS_CUSTOM_REPORT)$/u.test(resourceType)
    if (isPage) {
      found = true
      const path = assetPath(value) ?? [...trail, String(name ?? value.id ?? '')].filter(Boolean).join(' / ')
      const asset = normalizeAsset({ ...value, ...(path === undefined ? {} : { path }) }, 'page')
      if (asset !== null && !seen.has(asset.id)) {
        const haystack = `${asset.name}\n${asset.path ?? ''}`.toLowerCase()
        if (terms.every((term) => haystack.includes(term))) {
          seen.add(asset.id)
          rows.push(asset)
        }
      }
      return
    }

    const nextTrail = name === undefined ? trail : [...trail, String(name)]
    for (const key of ['contents', 'items', 'children', 'pages']) {
      if (Array.isArray(value[key])) visit(value[key], nextTrail)
    }
  }

  visit(payload)
  return { found, rows }
}

/**
 * Normalize a direct search response and cap each asset type independently.
 * @param payload - parsed CLI JSON.
 * @param type - dataset or page.
 * @param limit - maximum rows.
 * @param query - original keyword, used by raw page-tree filtering.
 * @returns candidate-compatible asset rows.
 */
export function normalizeAssetSearch(payload, type, limit = 8, query = '') {
  if (type === 'page') {
    const tree = pageTreeSearch(payload, query, limit)
    if (tree.found) return tree.rows
  }
  const list = assetList(payload)
  if (list === undefined) throw new Error('guancli 搜索输出中没有可识别的资产列表')
  const seen = new Set()
  const rows = []
  for (const raw of list) {
    const asset = normalizeAsset(raw, type)
    if (asset === null || seen.has(asset.id)) continue
    seen.add(asset.id)
    rows.push(asset)
    if (rows.length >= limit) break
  }
  return rows
}

/**
 * Unwrap common detail envelopes while retaining all definition fields.
 * @param payload - parsed CLI JSON.
 * @param type - dataset or page.
 * @returns raw detail object.
 */
function assetDetail(payload, type) {
  let value = Array.isArray(payload) ? payload[0] : payload
  for (let depth = 0; depth < 4; depth += 1) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) break
    if (firstScalar(value, ['id', 'dsId', 'datasetId', 'pgId', 'pageId', 'resourceId']) !== undefined) break
    const envelope = ['data', 'result', 'response', 'asset']
      .map((key) => value[key])
      .find((candidate) => candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate))
    if (envelope !== undefined) {
      value = envelope
      continue
    }
    const resource = value[type === 'page' ? 'page' : 'dataset']
    if (resource !== null && typeof resource === 'object' && !Array.isArray(resource)) {
      value = { ...value, ...resource }
    }
    break
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('guancli 资产详情输出不是可识别的对象')
  }
  return value
}

/**
 * Normalize identity/path on an inspect result without discarding fields,
 * cards, lineage, or other definition data returned by guancli.
 * @param payload - parsed CLI JSON.
 * @param type - dataset or page.
 * @param fallback - requested id and optional mention label.
 * @returns full detail with canonical type/id/name fields.
 */
export function normalizeAssetDetail(payload, type, fallback = {}) {
  const source = assetDetail(payload, type)
  const asset = normalizeAsset(source, type, fallback)
  if (asset === null) throw new Error('guancli 资产详情缺少资产 ID')
  const detail = {
    ...source,
    type: asset.type,
    id: asset.id,
    name: asset.name,
  }
  if (asset.path !== undefined) detail.path = asset.path
  else if (typeof detail.path !== 'string' || detail.path.trim() === '') delete detail.path
  return detail
}

/** Locate an executable on PATH without a shell. */
async function findExecutable(name, env = process.env) {
  if (name.includes('/')) {
    await access(name)
    return name
  }
  for (const folder of String(env.PATH ?? '').split(delimiter)) {
    if (folder === '') continue
    const candidate = `${folder}/${name}`
    try {
      await access(candidate)
      return candidate
    } catch {
      // Keep scanning; a missing directory is normal.
    }
  }
  throw new Error(`未找到 guancli（${name}），请先安装并执行 guancli auth login`)
}

/** One non-reconnecting CLI runner; `locate()` caches the resolved binary. */
export class GuancliRunner {
  constructor({ binary = process.env.GUANDATA_PLUGIN_GUANCLI ?? 'guancli', env = process.env } = {}) {
    this.binaryName = binary
    this.env = env
    this.binary = undefined
  }

  /** @returns the absolute binary path. */
  async locate() {
    if (this.binary === undefined) this.binary = await findExecutable(this.binaryName, this.env)
    return this.binary
  }

  /**
   * Run one read-only command.
   * @param args - argument array, never a shell string.
   * @param options - timeout and cancellation.
   * @returns stdout text.
   */
  async run(args, options = {}) {
    const binary = await this.locate()
    const timeoutMs = options.timeoutMs ?? 30_000
    return await new Promise((resolve, reject) => {
      const child = spawn(binary, args, {
        shell: false,
        env: { ...this.env, NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const stdout = []
      const stderr = []
      let bytes = 0
      let settled = false
      const finish = (callback) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', abort)
        callback()
      }
      const abort = () => {
        child.kill('SIGTERM')
        finish(() => reject(new Error('guancli 调用已取消')))
      }
      const collect = (bucket, chunk) => {
        bytes += chunk.length
        if (bytes > MAX_OUTPUT_BYTES) {
          child.kill('SIGTERM')
          finish(() => reject(new Error('guancli 输出超过 2 MiB 上限')))
          return
        }
        bucket.push(chunk)
      }
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        finish(() => reject(new Error(`guancli 超时（${String(timeoutMs)} ms）`)))
      }, timeoutMs)
      options.signal?.addEventListener('abort', abort, { once: true })
      child.stdout.on('data', (chunk) => collect(stdout, chunk))
      child.stderr.on('data', (chunk) => collect(stderr, chunk))
      child.on('error', (error) => finish(() => reject(new Error(`无法启动 guancli：${error.message}`))))
      child.on('close', (code) => finish(() => {
        if (code === 0) return resolve(Buffer.concat(stdout).toString('utf8'))
        const detail = Buffer.concat(stderr).toString('utf8').trim().split('\n').slice(-3).join(' ')
        reject(new Error(detail === '' ? `guancli 退出码 ${String(code)}` : detail))
      }))
    })
  }

  /**
   * List authenticated environments, cached by the caller.
   * @returns `{ environments, defaultProfile }`.
   */
  async environments() {
    return parseAuthList(await this.run(['auth', 'list'], { timeoutMs: 15_000 }))
  }

  /**
   * Search datasets or pages directly through guancli.
   * @param input - profile, asset type, keyword, row cap, and cancellation.
   * @returns normalized candidate-compatible assets.
   */
  async searchAssets(input) {
    const type = input.assetType === 'page' ? 'page' : 'dataset'
    const command = type === 'page' ? 'page' : 'ds'
    const limit = Math.max(1, Math.floor(Number(input.limit) || 8))
    const payload = await this.json([
      '--raw',
      '--profile', input.profile,
      command, 'search', input.query,
      '--limit', String(limit),
      '--brief',
    ], input.signal)
    return normalizeAssetSearch(payload, type, limit, input.query)
  }

  /**
   * Inspect one dataset/page directly through guancli, preserving its complete
   * JSON definition while adding stable identity and path fields.
   * @param input - profile, asset type/id, optional label, and cancellation.
   * @returns normalized full asset detail.
   */
  async inspectAsset(input) {
    const type = input.assetType === 'page' ? 'page' : 'dataset'
    const command = type === 'page' ? 'page' : 'ds'
    const payload = await this.json([
      '--raw',
      '--profile', input.profile,
      command, 'get', input.assetId,
      '--brief',
    ], input.signal)
    return normalizeAssetDetail(payload, type, { id: input.assetId, name: input.name })
  }

  /**
   * Preview a dataset's rows.
   * @param input - profile, dataset id, and optional projection.
   * @returns the parsed JSON payload.
   */
  async previewDataset(input) {
    const args = ['--profile', input.profile, 'ds', 'preview', input.datasetId, '--limit', String(input.limit), '-f', 'json']
    if (Array.isArray(input.columns) && input.columns.length > 0) args.push('--columns', input.columns.join(','))
    return await this.json(args, input.signal)
  }

  /**
   * Preview a card inside its page.
   * @param input - profile, page id, card id, and row limit.
   * @returns the parsed JSON payload.
   */
  async previewCard(input) {
    const withDefaultFilters = input.withDefaultFilters !== false
    const args = [
      '--profile', input.profile,
      'card', 'preview', input.cardId,
      ...(withDefaultFilters ? ['--page-id', input.pageId, '--with-default-filters'] : []),
    ]
    for (const filter of input.filters ?? []) args.push('--filter', filter)
    args.push('--limit', String(input.limit), '-f', 'json')
    return await this.json(args, input.signal)
  }

  /**
   * Run one command and parse its JSON stdout.
   * @param args - argument array.
   * @param signal - cancellation.
   * @returns the parsed value.
   */
  async json(args, signal) {
    const text = await this.run(args, { timeoutMs: 60_000, signal })
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('guancli 返回的内容不是合法 JSON')
    }
  }

  /**
   * Dataset metadata as printed by `ds get --brief` (name, rows, typed fields).
   * @param input - profile and dataset id.
   * @returns raw stdout text for parseDatasetMeta.
   */
  async datasetMeta(input) {
    return await this.run(
      ['--profile', input.profile, 'ds', 'get', input.datasetId, '--brief'],
      { timeoutMs: 30_000, signal: input.signal },
    )
  }

  /**
   * Preview dataset rows as JSON with optional column projection and filters.
   * @param input - profile, dataset id, limit, columns, filters.
   * @returns row object array (string values, per CLI contract).
   */
  async previewJson(input) {
    const args = ['--profile', input.profile, 'ds', 'preview', input.datasetId, '--limit', String(input.limit), '-f', 'json']
    if (Array.isArray(input.columns) && input.columns.length > 0) args.push('--columns', input.columns.join(','))
    for (const filter of input.filters ?? []) args.push('--filter', filter)
    return await this.json(args, input.signal)
  }

  /**
   * Resolve the BI web URL for a resource via `guancli url`.
   * @param input - profile, mention asset type, asset id.
   * @returns the web URL text.
   */
  async resourceUrl(input) {
    const type = input.assetType === 'page' ? 'page' : 'ds'
    const text = await this.run(
      ['--profile', input.profile, 'url', type, input.assetId],
      { timeoutMs: 30_000, signal: input.signal },
    )
    const match = /^Web URL:\s*(\S+)\s*$/mu.exec(text)
    if (match === null) throw new Error('guancli url 输出中没有 Web URL 行')
    return match[1]
  }

  /**
   * Execute one read-only aggregation query on the BI side.
   * @param input - profile, dataset id, SQL text, row cap.
   * @returns parsed JSON rows (typed numbers when --typed is honored).
   */
  async executeSql(input) {
    const args = [
      '--profile', input.profile,
      'ds', 'execute-sql',
      '-inputs', input.datasetId,
      '-sql', input.sql,
      '--limit', String(input.limit),
      '--disable-cache',
      '-f', 'json',
      '--typed',
    ]
    return await this.json(args, input.signal)
  }
}

export { AUTH_HEADER }
