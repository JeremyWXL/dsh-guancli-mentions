/**
 * Minimal guancli runner.
 *
 * Only two things live here: discovering which BI environments the CLI has been
 * authenticated for, and running read-only `preview` queries. Argument arrays
 * with `shell: false` keep asset ids, filters, and profile names out of a shell.
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
    const args = [
      '--profile', input.profile,
      'card', 'preview', input.cardId,
      '--page-id', input.pageId,
      '--limit', String(input.limit),
      '-f', 'json',
    ]
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
