/**
 * Host half of the Guandata mention plugin.
 *
 * Authorization model: whatever `guancli` has been authenticated against. No
 * session-to-Agent binding is involved — an environment is mentionable because
 * the CLI holds credentials for it, not because a saved Agent granted an asset.
 *
 * Three responsibilities:
 *  - report the authenticated environments and search their datasets/dashboards
 *    for the composer's `@` candidates;
 *  - turn a referenced asset into model context at the next model step, after
 *    re-validating its environment and identity;
 *  - expose read-only environment-scoped query tools so an unbound session can
 *    still analyze what the user mentioned.
 */

import { GuancliRunner } from './src/cli.js'
import {
  CONTEXT_SOURCE_KIND,
  MAX_MENTIONS_PER_MESSAGE,
  MentionError,
  assertEnvironment,
  boundDetail,
  buildContextText,
  dedupeRefs,
  hasMention,
  parseMentions,
  pickEnvironment,
  splitEnvQuery,
} from './src/mention.js'

export const name = 'guancli-mentions'

/** The RPC route, the capture step, and the query tools. */
export const inject = ['webServer', 'tools']

const ROUTE = '/guancli-mentions/v1/rpc'
const VERSION = '0.2.1'
/** Package name; also the Client module id and the Loader row target. */
const PACKAGE = '@local/dsh-guancli-mentions'
const MAX_BODY_BYTES = 64 * 1024
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/iu
const LOOPBACK_NAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
const ENVIRONMENT_TTL_MS = 60_000
const CANDIDATE_LIMIT_PER_TYPE = 8
const HARD_ROW_LIMIT = 200

/** Lazily resolved message factory: the plugin still loads if dsh-llm is unavailable. */
let userMessage

async function createUserMessage(input) {
  if (userMessage === undefined) {
    const loaded = await import('@deepseek-ai/dsh-llm')
    userMessage = loaded.createUserMessage
  }
  return userMessage(input)
}

/**
 * Per-activation state: one CLI runner, one environment cache, one remembered
 * environment per session, and the tool registration outcome. Keeping it off
 * module scope makes a disabled/enabled row start clean.
 */
class Runtime {
  /** @param ctx - Host plugin context. */
  constructor(ctx) {
    this.ctx = ctx
    this.runner = undefined
    this.environmentCache = { at: 0, value: { environments: [], defaultProfile: undefined } }
    this.sessionEnvironment = new Map()
    this.toolState = 'pending'
  }

  /** @returns the shared guancli runner. */
  cli() {
    if (this.runner === undefined) this.runner = new GuancliRunner()
    return this.runner
  }

  /**
   * Read the authenticated environments, refreshing at most once a minute.
   * @returns `{ environments, defaultProfile }`.
   */
  async environments() {
    const now = Date.now()
    if (now - this.environmentCache.at < ENVIRONMENT_TTL_MS) return this.environmentCache.value
    const value = await this.cli().environments()
    this.environmentCache = { at: now, value }
    return value
  }

  /** @returns the Guandata gateway service, when composed. */
  gateway() {
    return this.ctx.get('guandataGateway') ?? undefined
  }
}

/**
 * Register the RPC route, the mention context step, and the query tools.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  const runtime = new Runtime(ctx)
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE,
      handler: (req, res) => handleRpc(runtime, req, res),
    }),
    'guancli-mentions: local rpc route',
  )

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind === 'reject') return decision
    const messages = await enrichMessages(runtime, payload, decision.messages)
    return { ...decision, messages }
  }, { prepend: true })

  void registerTools(runtime).catch((error) => {
    runtime.toolState = `failed: ${messageOf(error)}`
    ctx.logger?.warn?.(error)
  })
}

// #region RPC transport

/**
 * Reject anything that is not a same-origin loopback POST.
 * @param runtime - plugin runtime.
 * @param req - incoming request.
 * @returns whether the caller may use the route.
 */
function localSameOrigin(runtime, req) {
  if (!LOOPBACK_HOST.test(String(req.headers.host ?? ''))) return false
  if (String(req.headers['sec-fetch-site'] ?? 'same-origin') === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    const parsed = new URL(origin)
    let expected
    try {
      expected = runtime.ctx.webServer.getOrigin()
    } catch {
      expected = undefined
    }
    if (expected !== undefined && parsed.origin === expected) return true
    return LOOPBACK_NAMES.has(parsed.hostname) && parsed.host === String(req.headers.host ?? '')
  } catch {
    return false
  }
}

/**
 * Read one bounded JSON body.
 * @param req - incoming request.
 * @returns the parsed body.
 */
async function readJsonBody(req) {
  const type = String(req.headers['content-type'] ?? '').toLowerCase()
  if (!type.startsWith('application/json')) {
    throw new MentionError('UNSUPPORTED_CONTENT_TYPE', '仅接受 application/json', 415)
  }
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) throw new MentionError('BODY_TOO_LARGE', '请求体过大', 413)
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new MentionError('INVALID_JSON', '请求体不是合法 JSON', 400)
  }
}

/**
 * Answer one RPC call.
 * @param runtime - plugin runtime.
 * @param req - incoming request.
 * @param res - outgoing response.
 */
async function handleRpc(runtime, req, res) {
  const reply = (status, body) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    res.end(JSON.stringify(body))
  }
  try {
    if (req.method !== 'POST') throw new MentionError('METHOD_NOT_ALLOWED', '仅允许 POST', 405)
    if (!localSameOrigin(runtime, req)) throw new MentionError('LOCAL_ONLY', '仅允许本机同源访问', 403)
    const body = await readJsonBody(req)
    const data = await dispatch(runtime, body?.action, body?.input ?? {})
    reply(200, { ok: true, data })
  } catch (error) {
    const status = error instanceof MentionError ? error.status : 500
    if (!(error instanceof MentionError)) runtime.ctx.logger?.error?.(error)
    reply(status, {
      ok: false,
      error: {
        code: error instanceof MentionError ? error.code : 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

/**
 * Route one RPC action.
 * @param runtime - plugin runtime.
 * @param action - action name.
 * @param input - action input.
 * @returns the action result.
 */
async function dispatch(runtime, action, input) {
  if (action === 'health') {
    const clientModules = runtime.ctx.get('clientModules')
    let clientModule = null
    try {
      clientModule = clientModules?.clientPath?.(PACKAGE) ?? null
    } catch {
      clientModule = null
    }
    let environmentCount = null
    try {
      environmentCount = (await runtime.environments()).environments.length
    } catch {
      environmentCount = null
    }
    return {
      version: VERSION,
      gateway: runtime.gateway() !== undefined,
      clientModule,
      environmentCount,
      tools: runtime.toolState,
    }
  }
  if (action === 'environments') {
    const value = await runtime.environments()
    return {
      defaultProfile: value.defaultProfile ?? null,
      environments: value.environments.map((environment) => environment.name),
    }
  }
  if (action === 'candidates') return await candidates(runtime, input)
  throw new MentionError('UNKNOWN_ACTION', `不支持的动作：${String(action)}`, 404)
}

/**
 * Environment-scoped candidates for one session.
 *
 * The state travels with the rows so the composer can explain an empty list:
 * `need-query`, `no-match`, `no-environment`, `no-gateway`, `no-cli`, `error`.
 * @param runtime - plugin runtime.
 * @param input - `{ sessionId, query? }`.
 * @returns rows plus the query state.
 */
async function candidates(runtime, input) {
  const sessionId = String(input?.sessionId ?? '').trim()
  if (sessionId === '') throw new MentionError('SESSION_REQUIRED', '缺少 sessionId', 400)
  const gateway = runtime.gateway()
  let envs
  try {
    envs = await runtime.environments()
  } catch (error) {
    return { items: [], state: 'no-cli', message: messageOf(error) }
  }
  const envList = envs.environments
  const names = envList.map((environment) => environment.name)
  if (envList.length === 0) return { items: [], state: 'no-environment', environments: names }
  const { env: requested, keyword } = splitEnvQuery(input?.query ?? '', envList)
  const env = pickEnvironment({
    requested,
    remembered: runtime.sessionEnvironment.get(sessionId),
    environments: envList,
    defaultProfile: envs.defaultProfile,
  })
  if (requested !== undefined) runtime.sessionEnvironment.set(sessionId, env)
  if (keyword === '') return { items: [], state: 'need-query', env, environments: names }
  if (gateway === undefined) return { items: [], state: 'no-gateway', env, environments: names }
  const [datasets, pages] = await Promise.all([
    search(gateway, env, 'dataset', keyword),
    search(gateway, env, 'page', keyword),
  ])
  const items = [...datasets.rows, ...pages.rows]
  if (datasets.failed && pages.failed) {
    return { items: [], state: 'error', env, environments: names }
  }
  return {
    items,
    state: items.length === 0 ? 'no-match' : 'ok',
    env,
    keyword,
    environments: names,
  }
}

/**
 * Search one asset type through the Guandata plugin's normalized discovery.
 * @param gateway - the Guandata gateway service.
 * @param env - authenticated environment name.
 * @param type - `dataset` or `page`.
 * @param query - keyword.
 * @returns rows plus a failure flag.
 */
async function search(gateway, env, type, query) {
  try {
    const result = await gateway.rpc('assets.search', { profile: env, type, query })
    const list = Array.isArray(result) ? result : []
    return {
      rows: list.slice(0, CANDIDATE_LIMIT_PER_TYPE).map((asset) => ({
        type: asset.type === 'page' ? 'page' : 'dataset',
        id: String(asset.id),
        name: String(asset.name ?? asset.id),
        ...(asset.path === undefined || asset.path === '' ? {} : { path: String(asset.path) }),
        env,
      })),
      failed: false,
    }
  } catch {
    return { rows: [], failed: true }
  }
}

// #endregion

// #region mention context

/**
 * Rewrite mentions in direct user messages and append the asset context.
 * @param runtime - plugin runtime.
 * @param payload - the pre-step payload.
 * @param messages - messages accepted by downstream pre-step listeners.
 * @returns direct messages followed by their asset context.
 */
async function enrichMessages(runtime, payload, messages) {
  const list = Array.isArray(messages) ? messages : []
  if (!list.some((message) => hasMention(message))) return messages
  const gateway = runtime.gateway()
  if (gateway === undefined) {
    throw new MentionError(
      'GATEWAY_UNAVAILABLE',
      '观远引用无法解析：未安装或未启用 @guandata/dsh-guancli 插件。',
    )
  }
  let envs
  try {
    envs = await runtime.environments()
  } catch (error) {
    throw new MentionError('CLI_UNAVAILABLE', `观远引用无法解析：${messageOf(error)}。`)
  }
  const sessionId = String(payload.agent.id)
  const out = []
  for (const message of list) {
    if (message?.source?.kind !== 'user' || !hasMention(message)) {
      out.push(message)
      continue
    }
    const refs = []
    const content = message.content.map((block) => {
      if (block?.type !== 'text' || typeof block.text !== 'string') return block
      if (!block.text.includes('dsh-guancli:')) return block
      const parsed = parseMentions(block.text)
      refs.push(...parsed.refs)
      return { ...block, text: parsed.text }
    })
    if (refs.length === 0) {
      out.push(message)
      continue
    }
    const selected = dedupeRefs(refs).slice(0, MAX_MENTIONS_PER_MESSAGE)
    const entries = []
    for (const ref of selected) {
      assertEnvironment(envs.environments, ref.env)
      runtime.sessionEnvironment.set(sessionId, ref.env)
      entries.push(await describe(gateway, ref, payload.signal))
    }
    out.push({ ...message, content })
    out.push(await createUserMessage({
      source: { kind: CONTEXT_SOURCE_KIND, form: 'recall', version: 2, references: selected },
      content: [{ type: 'text', text: buildContextText(entries) }],
    }))
  }
  return out
}

/**
 * Read one referenced asset's definition through the environment's own CLI
 * credentials; a wrong id or an unreadable asset fails the turn here.
 * @param gateway - the Guandata gateway service.
 * @param ref - parsed mention.
 * @param signal - turn cancellation.
 * @returns the context entry.
 */
async function describe(gateway, ref, signal) {
  let detail
  try {
    detail = await gateway.rpc('assets.inspect', {
      profile: ref.env,
      type: ref.type,
      id: ref.id,
      name: ref.label,
    })
  } catch (error) {
    throw new MentionError(
      'ASSET_INSPECT_FAILED',
      `观远引用解析失败：${ref.label}（${ref.type}:${ref.id} @ ${ref.env}）——${messageOf(error)}。`,
    )
  }
  if (signal?.aborted === true) throw new MentionError('CANCELLED', '观远引用解析已取消', 499)
  return {
    type: ref.type,
    env: ref.env,
    id: ref.id,
    label: ref.label,
    ...(detail !== null && typeof detail === 'object' && detail.path !== undefined
      ? { path: detail.path }
      : {}),
    detail: boundDetail(detail),
  }
}

// #endregion

// #region query tools

/**
 * Register the read-only, environment-scoped tools an unbound session needs.
 * @param runtime - plugin runtime.
 */
async function registerTools(runtime) {
  const { defineTool } = await import('@deepseek-ai/dsh-tools')
  const ctx = runtime.ctx
  const jsonOutput = {
    schema: { type: 'json' },
    render: (_args, value) => [{ type: 'text', text: renderForModel(value) }],
    presentationMeta: (_args, value) => value,
  }

  ctx.tools.register(defineTool({
    name: 'guancli_environments',
    description: '列出 guancli 当前已鉴权的观远 BI 环境。使用 @ 引用资产或调用其它观远工具前，先确认目标环境名。',
    parameters: {},
    output: jsonOutput,
    execute: async () => await runtime.environments(),
    timeoutMs: 20_000,
    isConcurrencySafe: () => true,
  }))

  ctx.tools.register(defineTool({
    name: 'guancli_asset_inspect',
    description: '读取一个已鉴权环境中的数据集或看板定义（字段、口径、页面卡片）。看板先 inspect 拿到 cardId，再用 guancli_card_preview 查询。',
    parameters: {
      profile: { type: 'string', required: true, description: 'guancli 环境名，例如 demo' },
      assetType: { type: 'string', required: true, enum: ['dataset', 'page'], description: '资产类型' },
      assetId: { type: 'string', required: true, description: '资产 ID' },
    },
    output: jsonOutput,
    execute: async (args, exec) => {
      await assertProfile(runtime, args.profile)
      return await requireGateway(runtime).rpc('assets.inspect', {
        profile: args.profile,
        type: args.assetType,
        id: args.assetId,
      }, exec.signal)
    },
    timeoutMs: 60_000,
    isConcurrencySafe: () => true,
  }))

  ctx.tools.register(defineTool({
    name: 'guancli_dataset_preview',
    description: '预览一个已鉴权环境里的数据集行数据（只读，行数受硬上限约束）。dataset 引用默认用它。',
    parameters: {
      profile: { type: 'string', required: true, description: 'guancli 环境名' },
      datasetId: { type: 'string', required: true, description: '数据集 ID' },
      columns: { type: 'array', items: { type: 'string' }, description: '要返回的列；省略则返回全部（受环境权限限制）' },
      limit: { type: 'integer', description: '返回行数，默认 50，硬上限 200' },
    },
    output: jsonOutput,
    execute: async (args, exec) => {
      await assertProfile(runtime, args.profile)
      return await runtime.cli().previewDataset({
        profile: args.profile,
        datasetId: args.datasetId,
        columns: args.columns,
        limit: clampRows(args.limit),
        signal: exec.signal,
      })
    },
    timeoutMs: 120_000,
    isConcurrencySafe: () => true,
  }))

  ctx.tools.register(defineTool({
    name: 'guancli_card_preview',
    description: '在所属页面上下文中预览一张卡片的数据（只读，行数受硬上限约束）。page（看板）引用默认用它。',
    parameters: {
      profile: { type: 'string', required: true, description: 'guancli 环境名' },
      pageId: { type: 'string', required: true, description: '卡片所属看板/页面 ID' },
      cardId: { type: 'string', required: true, description: '卡片 ID' },
      limit: { type: 'integer', description: '返回行数，默认 50，硬上限 200' },
    },
    output: jsonOutput,
    execute: async (args, exec) => {
      await assertProfile(runtime, args.profile)
      return await runtime.cli().previewCard({
        profile: args.profile,
        pageId: args.pageId,
        cardId: args.cardId,
        limit: clampRows(args.limit),
        signal: exec.signal,
      })
    },
    timeoutMs: 120_000,
    isConcurrencySafe: () => true,
  }))

  runtime.toolState = 'ready'
}

/**
 * @param runtime - plugin runtime.
 * @returns the Guandata gateway service.
 */
function requireGateway(runtime) {
  const gateway = runtime.gateway()
  if (gateway === undefined) {
    throw new MentionError('GATEWAY_UNAVAILABLE', '未安装或未启用 @guandata/dsh-guancli 插件。', 503)
  }
  return gateway
}

/**
 * Reject an environment the CLI has not authenticated.
 * @param runtime - plugin runtime.
 * @param profile - environment name from tool arguments.
 */
async function assertProfile(runtime, profile) {
  const value = await runtime.environments()
  assertEnvironment(value.environments, String(profile))
}

/**
 * @param value - requested row limit.
 * @returns a bounded positive integer.
 */
function clampRows(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 50
  return Math.min(Math.floor(numeric), HARD_ROW_LIMIT)
}

/**
 * @param value - tool result.
 * @returns compact text for the model.
 */
function renderForModel(value) {
  const text = JSON.stringify(value)
  if (text === undefined) return String(value)
  return text.length <= 8000 ? text : `${text.slice(0, 8000)}\n…（已截断，共 ${String(text.length)} 字符）`
}

/**
 * @param error - unknown thrown value.
 * @returns a readable message.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

// #endregion
