/**
 * Analysis planner: business-facing parameters → validated aggregation plan →
 * server-side SQL (preferred) or in-JS sample aggregation (degraded).
 *
 * Everything here is pure and injectable (time source, no I/O) so the whole
 * planner is unit-testable without a BI connection.
 */

import { selectorDefFilter } from './pagedef.js'

/** Aggregation functions a measure accepts. */
export const AGG_FUNCTIONS = ['sum', 'count', 'avg', 'min', 'max']

/** Filter operators, excluding time shortcuts. */
export const FILTER_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'contains']

/** Time shortcut spec types. */
export const TIME_TYPES = ['last_n_days', 'this_month', 'last_month', 'this_year', 'between_dates']

/** Default and hard caps for aggregation result rows. */
export const ANALYZE_DEFAULT_LIMIT = 20
export const ANALYZE_HARD_LIMIT = 500

/** Sample size for the degraded (SQL-unavailable) path. */
export const SAMPLE_LIMIT = 500

/** Byte budget for tool results sent to the model. */
export const RESULT_BUDGET_BYTES = 64 * 1024

/** Max dictionary entries returned by field_profile. */
export const DICTIONARY_LIMIT = 20

/** Cardinality above which a dimension is treated as high-base. */
export const HIGH_CARDINALITY = 200

// #region dataset metadata parsing

/**
 * Parse `guancli ds get <id> --brief` stdout into structured metadata.
 * @param text - raw CLI stdout.
 * @returns `{ name, rowCount, columnCount, updatedAt, fields }`.
 */
export function parseDatasetMeta(text) {
  const lines = String(text ?? '').split('\n')
  let name = ''
  let rowCount
  let columnCount
  let updatedAt = ''
  const fields = []
  for (const line of lines) {
    const title = /^\s*数据集:\s*(.+?)\s*\(([^)]+)\)\s*$/u.exec(line)
    if (title !== null) {
      name = title[1]
      continue
    }
    const stats = /^\s*-\s*行数:\s*([0-9.eE+]+)\s*\|\s*列数:\s*(\d+)/u.exec(line)
    if (stats !== null) {
      rowCount = Number(stats[1])
      columnCount = Number(stats[2])
      continue
    }
    const updated = /^\s*-\s*更新:\s*(.+?)\s*$/u.exec(line)
    if (updated !== null) {
      updatedAt = updated[1]
      continue
    }
    const field = /^\s*-\s*(.+?)\s*\(([A-Z]+)\/(DIM|METRIC)\)\s*$/u.exec(line)
    if (field !== null) {
      const dataType = field[2]
      const role = isTimeType(dataType) ? 'time' : field[3] === 'METRIC' ? 'measure' : 'dimension'
      fields.push({ name: field[1], dataType, role })
    }
  }
  return { name, rowCount, columnCount, updatedAt, fields }
}

/**
 * @param dataType - BI field data type.
 * @returns whether the type holds temporal values.
 */
function isTimeType(dataType) {
  return ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME'].includes(String(dataType).toUpperCase())
}

// #endregion

// #region identifiers and literals

/**
 * Backtick-quote a SQL identifier; embedded backticks are doubled.
 * @param name - field or dataset name.
 * @returns quoted identifier.
 */
export function quoteIdent(name) {
  return `\`${String(name).replace(/`/gu, '``')}\``
}

/**
 * Render one literal. Numbers pass through; everything else becomes a quoted
 * string with single quotes doubled (parameter-style escaping).
 * @param value - raw filter value.
 * @returns SQL literal text.
 */
export function quoteValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value instanceof Date) return `'${toDateString(value)}'`
  return `'${String(value).replace(/'/gu, "''")}'`
}

/**
 * @param date - local date.
 * @returns `YYYY-MM-DD`.
 */
export function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// #endregion

// #region time ranges

/**
 * Resolve a time shortcut into concrete dates.
 * @param spec - `{type, ...}` time shortcut.
 * @param now - injectable current time.
 * @returns `{ start, end, label }` with `YYYY-MM-DD` strings.
 */
export function resolveTimeRange(spec, now = new Date()) {
  if (spec === null || typeof spec !== 'object') {
    throw new Error('时间范围必须是对象，例如 {type:"last_n_days", days:90}')
  }
  const day = 24 * 60 * 60 * 1000
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (spec.type) {
    case 'last_n_days': {
      const days = Number(spec.days)
      if (!Number.isInteger(days) || days <= 0 || days > 3660) {
        throw new Error('last_n_days 的 days 必须是 1-3660 的整数')
      }
      return {
        start: toDateString(new Date(startOfToday.getTime() - (days - 1) * day)),
        end: toDateString(startOfToday),
        label: `近 ${String(days)} 天`,
      }
    }
    case 'this_month':
      return {
        start: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: toDateString(startOfToday),
        label: '本月至今',
      }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: toDateString(first), end: toDateString(last), label: '上月' }
    }
    case 'this_year':
      return {
        start: toDateString(new Date(now.getFullYear(), 0, 1)),
        end: toDateString(startOfToday),
        label: '今年至今',
      }
    case 'between_dates': {
      // Models reach for `{start,end}`, `{value:[start,end]}` and
      // `{value:{start,end}}` in roughly equal measure. Rejecting two of the
      // three turns an argument-shape guess into a wasted round trip, so
      // normalize instead of failing.
      const fallback = betweenValueRange(spec.value)
      const rawStart = spec.start ?? fallback.start
      const rawEnd = spec.end ?? fallback.end
      const start = parseDateString(rawStart)
      const end = parseDateString(rawEnd)
      if (start === null || end === null) {
        throw new Error('between_dates 需要 start 与 end（YYYY-MM-DD），也接受 value:[start,end] 或 value:{start,end}')
      }
      if (start > end) throw new Error('between_dates 的 start 不能晚于 end')
      return { start: toDateString(start), end: toDateString(end), label: `${String(rawStart)} 至 ${String(rawEnd)}` }
    }
    default:
      throw new Error(`未知的时间范围类型：${String(spec.type)}（支持 ${TIME_TYPES.join(' / ')}）`)
  }
}

/**
 * @param value - a `between_dates` payload in any accepted shape.
 * @returns `{ start, end }`, with `undefined` for whatever was not supplied.
 */
export function betweenValueRange(value) {
  if (Array.isArray(value) && value.length === 2) return { start: value[0], end: value[1] }
  if (value !== null && typeof value === 'object') return { start: value.start, end: value.end }
  return { start: undefined, end: undefined }
}

/**
 * Whether a filter constrains a date range, in either shape this module
 * produces: planner filters (`kind:'time'`) or dashboard filters
 * (`op:'between_dates'`).
 * @param filter - one filter entry.
 * @returns the constrained field name, or null when it is not a range filter.
 */
function timeFilterField(filter) {
  if (filter === null || typeof filter !== 'object') return null
  if (filter.kind === 'time') return String(filter.field)
  if (String(filter.op ?? '').toLowerCase() === 'between_dates' && filter.start !== undefined) {
    return String(filter.field)
  }
  return null
}

/**
 * Intersect every set of date ranges that targets the same field.
 *
 * A dashboard can carry several selectors on one time field (年份 / 季度 /
 * 月份). Applying them one after another ANDs the ranges together, and when
 * they do not overlap the query silently returns zero rows — which reads as
 * "there is no data" instead of "these filters contradict each other". This
 * collapses overlapping ranges into the intersection and reports the ones that
 * cannot meet, so a caller can refuse the query instead of answering it wrongly.
 * @param filters - planner filters and/or dashboard filters.
 * @returns `{ filters, conflicts }` — `filters` has one range per field;
 *   `conflicts` lists every participant of an empty intersection.
 */
export function mergeTimeFilters(filters) {
  const list = Array.isArray(filters) ? filters : []
  const groups = new Map()
  for (const filter of list) {
    const field = timeFilterField(filter)
    if (field === null) continue
    const bucket = groups.get(field) ?? []
    bucket.push(filter)
    groups.set(field, bucket)
  }

  const conflicts = []
  const replacement = new Map()
  for (const [field, bucket] of groups) {
    if (bucket.length < 2) continue
    const windows = bucket.map((filter) => ({
      field,
      start: String(filter.start),
      end: String(filter.end),
      label: String(filter.selector ?? filter.label ?? `${String(filter.start)}~${String(filter.end)}`),
    }))
    const overlapStart = windows.map((window) => window.start).sort().at(-1)
    const overlapEnd = windows.map((window) => window.end).sort()[0]
    if (overlapStart > overlapEnd) {
      conflicts.push({ field, windows })
      continue
    }
    replacement.set(field, {
      ...bucket[0],
      start: overlapStart,
      end: overlapEnd,
      label: bucket.map((filter) => String(filter.label ?? `${String(filter.start)}~${String(filter.end)}`)).join(' ∩ '),
    })
  }
  if (replacement.size === 0) return { filters: list, conflicts }

  const merged = []
  const emitted = new Set()
  for (const filter of list) {
    const field = timeFilterField(filter)
    if (field === null || !replacement.has(field)) {
      merged.push(filter)
      continue
    }
    if (emitted.has(field)) continue
    emitted.add(field)
    merged.push(replacement.get(field))
  }
  return { filters: merged, conflicts }
}

/**
 * @param value - date string `YYYY-MM-DD` or Date.
 * @returns parsed local Date, or null.
 */
function parseDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(value ?? '').trim())
  if (match === null) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

// #endregion

// #region field suggestions

/**
 * Suggest existing fields for a mistyped name: substring matches first, then
 * character-overlap ranking.
 * @param input - the name the user/model typed.
 * @param fields - dataset field metadata.
 * @returns up to 3 candidate names.
 */
export function suggestFields(input, fields) {
  const needle = String(input ?? '').toLowerCase()
  if (needle === '') return []
  const names = fields.map((field) => field.name)
  const substring = names.filter((name) => name.toLowerCase().includes(needle) || needle.includes(name.toLowerCase()))
  const needleChars = new Set(needle)
  const overlap = names
    .filter((name) => !substring.includes(name))
    .map((name) => {
      const hit = [...name.toLowerCase()].filter((char) => needleChars.has(char)).length
      return { name, score: name === '' ? 0 : hit / name.length }
    })
    .filter((entry) => entry.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.name)
  return [...new Set([...substring, ...overlap])].slice(0, 3)
}

// #endregion

// #region analysis validation

/**
 * Validate and normalize an analyze_dataset call against field metadata.
 * @param spec - raw tool arguments.
 * @param fields - field metadata from parseDatasetMeta.
 * @param now - injectable time.
 * @returns normalized plan plus `errors: [{field, message, suggestions?}]`.
 */
export function planAnalysis(spec, fields, now = new Date()) {
  const errors = []
  const fieldByName = new Map(fields.map((field) => [field.name, field]))

  const fail = (field, message, suggestions = undefined) => {
    errors.push({ field, message, ...(suggestions === undefined ? {} : { suggestions }) })
  }

  const by = Array.isArray(spec.by) ? [...new Set(spec.by.map(String))] : []
  for (const name of by) {
    const field = fieldByName.get(name)
    if (field === undefined) {
      fail(name, `字段「${name}」不存在`, suggestFields(name, fields))
    } else if (field.role !== 'dimension') {
      fail(name, `字段「${name}」是${roleLabel(field.role)}，不能作为分组维度（by 只接受维度字段）`)
    }
  }

  const metrics = []
  const rawMetrics = Array.isArray(spec.metric) && spec.metric.length > 0 ? spec.metric : null
  if (rawMetrics === null) {
    fail('metric', '至少需要一个度量（metric），例如 {field:"销售金额", agg:"sum"}')
  } else {
    rawMetrics.forEach((raw, index) => {
      const fieldName = String(raw?.field ?? '')
      const agg = String(raw?.agg ?? 'sum').toLowerCase()
      if (!AGG_FUNCTIONS.includes(agg)) {
        fail(`metric[${String(index)}]`, `聚合函数「${agg}」不支持（支持 ${AGG_FUNCTIONS.join('/')}）`)
        return
      }
      if (agg === 'count') {
        metrics.push({ field: fieldName, agg, alias: `m${String(metrics.length + 1)}` })
        return
      }
      const field = fieldByName.get(fieldName)
      if (field === undefined) {
        fail(fieldName, `度量字段「${fieldName}」不存在`, suggestFields(fieldName, fields))
      } else if (field.role !== 'measure') {
        fail(fieldName, `字段「${fieldName}」是${roleLabel(field.role)}，不能作为度量（metric 只接受数值度量字段）`)
      } else if (field.calculated === true) {
        // Dataset-level calc field (from page dsInfo): row-level formulas
        // expand into the aggregation; pre-aggregated formulas cannot.
        if (field.aggregated === true) {
          fail(fieldName, `字段「${fieldName}」是聚合计算字段（${String(field.formula ?? '')}），不能直接聚合；请对它的组成字段分别聚合后自行计算`)
          return
        }
        const compiled = calcExpression(field.formula ?? '', fieldByName)
        if (compiled.error !== undefined) {
          fail(fieldName, `计算字段「${fieldName}」无法展开：${compiled.error}`)
          return
        }
        metrics.push({ field: fieldName, agg, alias: `m${String(metrics.length + 1)}`, expression: compiled.expression })
      } else {
        metrics.push({ field: fieldName, agg, alias: `m${String(metrics.length + 1)}` })
      }
    })
  }

  const filters = []
  const timeFields = fields.filter((field) => field.role === 'time')
  for (const [index, raw] of (Array.isArray(spec.filters) ? spec.filters : []).entries()) {
    const fieldName = raw?.field === undefined || raw.field === '' ? undefined : String(raw.field)
    const op = String(raw?.op ?? '').toLowerCase()
    if (TIME_TYPES.includes(op)) {
      let range
      try {
        range = resolveTimeRange({ ...raw, type: op }, now)
      } catch (error) {
        fail(`filters[${String(index)}]`, error.message)
        continue
      }
      let target = fieldName
      if (target === undefined) {
        if (timeFields.length === 1) target = timeFields[0].name
        else {
          fail(`filters[${String(index)}]`, `该数据集有 ${String(timeFields.length)} 个时间字段，请显式指定 filters.field`)
          continue
        }
      }
      const field = fieldByName.get(target)
      if (field === undefined) {
        fail(target, `字段「${target}」不存在`, suggestFields(target, fields))
        continue
      }
      if (field.role !== 'time') {
        fail(target, `字段「${target}」不是时间字段，不能用 ${op} 快捷时间筛选`)
        continue
      }
      filters.push({ kind: 'time', field: target, ...range })
      continue
    }
    if (!FILTER_OPS.includes(op)) {
      fail(`filters[${String(index)}]`, `操作符「${op}」不支持（支持 ${[...FILTER_OPS, ...TIME_TYPES].join('/')}）`)
      continue
    }
    if (fieldName === undefined) {
      fail(`filters[${String(index)}]`, '筛选缺少 field')
      continue
    }
    const field = fieldByName.get(fieldName)
    if (field === undefined) {
      fail(fieldName, `字段「${fieldName}」不存在`, suggestFields(fieldName, fields))
      continue
    }
    if (field.calculated === true) {
      fail(fieldName, `字段「${fieldName}」是计算字段（公式而非数据列），不能作为筛选条件；请改用其组成字段`)
      continue
    }
    const valueError = validateFilterValue(op, raw.value, field)
    if (valueError !== null) {
      fail(fieldName, valueError)
      continue
    }
    filters.push({ kind: 'value', field: fieldName, op, value: raw.value })
  }

  // Safety net for duplicate ranges on one field: hand-written filters and
  // dashboard selectors both land here, and a silent empty AND is the worst
  // possible answer.
  const timeMerge = mergeTimeFilters(filters)
  for (const conflict of timeMerge.conflicts) {
    const windows = conflict.windows.map((window) => `${window.label}=${window.start}~${window.end}`).join('、')
    fail(
      conflict.field,
      `同一时间字段「${conflict.field}」上有 ${String(conflict.windows.length)} 个互不重叠的区间（${windows}），叠加后必然为空；请只保留一个区间，或确认哪个筛选才是真正生效的`,
    )
  }
  const mergedFilters = timeMerge.filters

  let sort
  if ((spec.sort === undefined || spec.sort === null) && by.length > 0 && metrics.length > 0) {
    // Business default: ranked output reads better for every "top N" question.
    sort = { field: metrics[0].alias, direction: 'desc' }
  }
  if (spec.sort !== undefined && spec.sort !== null) {
    const sortField = String(spec.sort.field ?? '')
    const direction = String(spec.sort.direction ?? 'desc').toLowerCase()
    if (direction !== 'asc' && direction !== 'desc') {
      fail('sort', 'sort.direction 必须是 asc 或 desc')
    } else {
      const dimOk = by.includes(sortField)
      const metricOk = metrics.some((metric) => metric.alias === sortField)
      if (!dimOk && !metricOk) {
        fail(sortField, `排序字段必须是分组维度（${by.join('、') || '无'}）或度量别名（${metrics.map((m) => m.alias).join('、') || '无'}）`)
      } else {
        sort = { field: sortField, direction }
      }
    }
  }

  let limit = Number(spec.limit ?? ANALYZE_DEFAULT_LIMIT)
  if (!Number.isInteger(limit) || limit <= 0) limit = ANALYZE_DEFAULT_LIMIT
  limit = Math.min(limit, ANALYZE_HARD_LIMIT)

  return {
    errors,
    plan: errors.length === 0 ? {
      by: by.map((name) => fieldByName.get(name)),
      metrics,
      filters: mergedFilters,
      sort,
      limit,
      timeFields,
    } : null,
  }
}

/**
 * @param role - field role.
 * @returns Chinese role label for error messages.
 */
function roleLabel(role) {
  return { dimension: '维度', measure: '度量', time: '时间字段' }[role] ?? String(role)
}

/**
 * @param op - filter operator.
 * @param value - raw value.
 * @param field - field metadata.
 * @returns an error message, or null when valid.
 */
function validateFilterValue(op, value, field) {
  const needArray = (min, max) => {
    if (!Array.isArray(value) || value.length < min || (max !== undefined && value.length > max)) {
      return `${op} 需要${min === max ? String(min) : `${String(min)}-${String(max ?? '多')}`}个值的数组`
    }
    return null
  }
  switch (op) {
    case 'eq':
    case 'ne':
    case 'contains':
      return value === undefined || value === null || value === '' ? `${op} 需要一个值` : null
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return typeof value !== 'number' || !Number.isFinite(value) ? `${op} 需要数值` : null
    case 'between':
      return needArray(2, 2) ?? (value.some((item) => typeof item !== 'number' || !Number.isFinite(item)) ? 'between 需要两个数值' : null)
    case 'in':
      return needArray(1) ?? null
    default:
      return null
  }
}

// #endregion

/**
 * Translate a BI row-level calc formula into a SQL expression with
 * whitelisted field references (`[字段]` → backticked identifier). Only
 * arithmetic survives validation — the text lands in server-side SQL.
 * @param formula - BI formula, e.g. `[实际成交额(券后)]*76`.
 * @param fieldByName - dataset field whitelist map.
 * @returns `{ expression }` or `{ error }`.
 */
function calcExpression(formula, fieldByName) {
  const refs = []
  const replaced = String(formula ?? '').replace(/\[([^\]]+)\]/gu, (_match, ref) => {
    refs.push(ref)
    const field = fieldByName.get(ref)
    if (field === undefined || field.calculated === true) return '\u0001'
    return quoteIdent(ref)
  })
  if (replaced.includes('\u0001')) {
    return { error: `公式引用了未知或嵌套计算字段：${refs.join('、')}` }
  }
  const residue = replaced.replace(/`(?:[^`]|``)*`/gu, '')
  if (!/^[\d\s+\-*/%().,]*$/u.test(residue)) {
    return { error: '公式含有暂不支持的函数或字面量（仅支持四则运算）' }
  }
  return { expression: replaced }
}

// #region SQL generation

/**
 * Build the server-side aggregation SQL.
 * @param datasetName - dataset display name (becomes the temp table name).
 * @param plan - normalized plan from planAnalysis.
 * @returns `{ sql, selectLabels }` where labels explain each output column.
 */
export function buildAggregationSql(datasetName, plan) {
  const selects = []
  const labels = []
  for (const dim of plan.by) {
    selects.push(`${quoteIdent(dim.name)} AS ${quoteIdent(dim.name)}`)
    labels.push({ column: dim.name, kind: 'dimension', field: dim.name })
  }
  for (const metric of plan.metrics) {
    const target = metric.agg === 'count' ? '*' : metric.expression ?? quoteIdent(metric.field)
    selects.push(`${metric.agg.toUpperCase()}(${target}) AS ${quoteIdent(metric.alias)}`)
    labels.push({
      column: metric.alias,
      kind: 'measure',
      field: metric.field || '*',
      agg: metric.agg,
      ...(metric.expression === undefined ? {} : { calculated: true }),
    })
  }
  const where = []
  for (const filter of plan.filters) {
    if (filter.kind === 'time') {
      where.push(`${quoteIdent(filter.field)} >= ${quoteValue(filter.start)}`)
      where.push(`${quoteIdent(filter.field)} <= ${quoteValue(filter.end)}`)
    } else {
      where.push(buildValuePredicate(filter))
    }
  }
  const sql = [
    `SELECT ${selects.join(', ')}`,
    `FROM ${quoteIdent(datasetName)}`,
    ...(where.length > 0 ? [`WHERE ${where.join(' AND ')}`] : []),
    ...(plan.by.length > 0 ? [`GROUP BY ${plan.by.map((dim) => quoteIdent(dim.name)).join(', ')}`] : []),
    ...(plan.sort !== undefined ? [`ORDER BY ${quoteIdent(plan.sort.field)} ${plan.sort.direction.toUpperCase()}`] : []),
    ...(plan.by.length > 0 || plan.sort !== undefined ? [`LIMIT ${String(plan.limit)}`] : [`LIMIT 1`]),
  ].join('\n')
  return { sql, labels }
}

/**
 * @param filter - normalized value filter.
 * @returns SQL predicate text.
 */
function buildValuePredicate(filter) {
  const column = quoteIdent(filter.field)
  switch (filter.op) {
    case 'eq':
      return `${column} = ${quoteValue(filter.value)}`
    case 'ne':
      return `${column} <> ${quoteValue(filter.value)}`
    case 'gt':
      return `${column} > ${quoteValue(filter.value)}`
    case 'gte':
      return `${column} >= ${quoteValue(filter.value)}`
    case 'lt':
      return `${column} < ${quoteValue(filter.value)}`
    case 'lte':
      return `${column} <= ${quoteValue(filter.value)}`
    case 'between':
      return `${column} BETWEEN ${quoteValue(filter.value[0])} AND ${quoteValue(filter.value[1])}`
    case 'in':
      return `${column} IN (${filter.value.map(quoteValue).join(', ')})`
    case 'contains':
      return `${column} LIKE '%${String(filter.value).replace(/'/gu, "''")}%'`
    default:
      throw new Error(`未支持的操作符：${filter.op}`)
  }
}

/**
 * Build the field-profile SQL pair.
 * @param datasetName - dataset display name.
 * @param field - field metadata.
 * @returns `{ dictionarySql, statsSql, dictionaryLabels, statsLabels }`; `statsSql` is null for enum fields.
 */
export function buildFieldProfileSql(datasetName, field) {
  const column = quoteIdent(field.name)
  const dictionarySql = [
    `SELECT ${column} AS value, COUNT(*) AS cnt`,
    `FROM ${quoteIdent(datasetName)}`,
    `WHERE ${column} IS NOT NULL`,
    `GROUP BY ${column}`,
    `ORDER BY cnt DESC`,
    `LIMIT ${String(DICTIONARY_LIMIT + 1)}`,
  ].join('\n')
  const statsSql = field.role === 'measure'
    ? [
      `SELECT COUNT(*) AS total,`,
      `SUM(CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END) AS nulls,`,
      `MIN(${column}) AS min, MAX(${column}) AS max, AVG(${column}) AS avg`,
      `FROM ${quoteIdent(datasetName)}`,
    ].join('\n')
    : null
  return { dictionarySql, statsSql }
}

/**
 * SQL for the min/max span of the time field (asset_overview).
 * @param datasetName - dataset display name.
 * @param fieldName - time field.
 * @returns SQL text.
 */
export function buildTimeRangeSql(datasetName, fieldName) {
  return [
    `SELECT MIN(${quoteIdent(fieldName)}) AS min, MAX(${quoteIdent(fieldName)}) AS max`,
    `FROM ${quoteIdent(datasetName)}`,
  ].join('\n')
}

// #endregion

// #region sample-path aggregation (degraded, no SQL support)

/**
 * Aggregate preview rows locally. Used only when the BI environment cannot run
 * execute-sql; the result is explicitly scope-tagged as a sample.
 * @param rows - raw preview rows (string values).
 * @param plan - normalized plan.
 * @returns `{ rows, truncated }` aggregated rows with numeric measures.
 */
export function aggregateSample(rows, plan) {
  const groups = new Map()
  const metricFields = plan.metrics.map((metric) => ({
    alias: metric.alias,
    field: metric.field,
    agg: metric.agg,
  }))
  for (const raw of rows) {
    const key = plan.by.map((dim) => String(raw[dim.name] ?? '')).join('')
    let bucket = groups.get(key)
    if (bucket === undefined) {
      bucket = { dims: plan.by.map((dim) => raw[dim.name] ?? null), values: metricFields.map(() => []) }
      groups.set(key, bucket)
    }
    metricFields.forEach((metric, index) => {
      if (metric.agg === 'count') {
        bucket.values[index].push(1)
        return
      }
      const numeric = Number(raw[metric.field])
      if (Number.isFinite(numeric)) bucket.values[index].push(numeric)
    })
  }
  const out = [...groups.values()].map((bucket) => {
    const row = {}
    plan.by.forEach((dim, index) => {
      row[dim.name] = bucket.dims[index]
    })
    metricFields.forEach((metric, index) => {
      row[metric.alias] = finalizeAggregate(metric.agg, bucket.values[index])
    })
    return row
  })
  const sort = plan.sort
  if (sort !== undefined) {
    out.sort((left, right) => {
      const a = left[sort.field]
      const b = right[sort.field]
      const order = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'zh')
      return sort.direction === 'asc' ? order : -order
    })
  }
  const truncated = out.length > plan.limit
  return { rows: out.slice(0, plan.limit), truncated }
}

/**
 * @param agg - aggregation function.
 * @param values - collected numbers.
 * @returns aggregated value.
 */
function finalizeAggregate(agg, values) {
  if (values.length === 0) return null
  switch (agg) {
    case 'count':
      return values.length
    case 'sum':
      return values.reduce((acc, value) => acc + value, 0)
    case 'avg':
      return values.reduce((acc, value) => acc + value, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return null
  }
}

/**
 * Apply value filters to preview rows (JS mirror of the SQL predicates).
 * @param rows - raw preview rows.
 * @param filters - normalized plan filters.
 * @returns filtered rows.
 */
export function filterSample(rows, filters) {
  const valueFilters = filters.filter((filter) => filter.kind === 'value')
  return rows.filter((row) => valueFilters.every((filter) => matchesFilter(row, filter)))
}

/**
 * @param row - one preview row.
 * @param filter - normalized value filter.
 * @returns whether the row matches.
 */
function matchesFilter(row, filter) {
  const actual = row[filter.field]
  switch (filter.op) {
    case 'eq':
      return String(actual) === String(filter.value)
    case 'ne':
      return String(actual) !== String(filter.value)
    case 'contains':
      return String(actual).includes(String(filter.value))
    case 'in':
      return filter.value.some((value) => String(actual) === String(value))
    case 'gt':
      return Number(actual) > filter.value
    case 'gte':
      return Number(actual) >= filter.value
    case 'lt':
      return Number(actual) < filter.value
    case 'lte':
      return Number(actual) <= filter.value
    case 'between':
      return Number(actual) >= filter.value[0] && Number(actual) <= filter.value[1]
    default:
      return true
  }
}

// #endregion

// #region result shaping

/**
 * Run fixed insight rules over aggregated rows (business-language findings).
 * @param rows - aggregated rows.
 * @param metrics - plan metrics.
 * @param byLabel - human label of the grouping.
 * @returns finding list.
 */
export function runInsights(rows, metrics, byLabel) {
  const findings = []
  const metric = metrics[0]
  if (metric === undefined || rows.length < 2) return findings
  const values = rows.map((row) => Number(row[metric.alias])).filter((value) => Number.isFinite(value))
  if (values.length < 2) return findings
  const total = values.reduce((acc, value) => acc + value, 0)
  const sorted = [...values].sort((a, b) => b - a)
  const metricLabel = metric.agg === 'count' ? '记录数' : `${aggLabel(metric.agg)} ${metric.field}`
  if (total > 0 && sorted[0] / total > 0.4) {
    const leader = rows.find((row) => Number(row[metric.alias]) === sorted[0])
    const dimText = leader === undefined ? '第一组' : formatDimText(leader, metrics)
    findings.push({
      type: 'concentration',
      message: `${dimText} 的 ${metricLabel} 占${byLabel}前 ${String(rows.length)} 组的 ${percent(sorted[0] / total)}，明显领先`,
    })
  }
  const baseline = sorted[Math.min(4, sorted.length - 1)]
  if (baseline > 0 && sorted[0] / baseline >= 3) {
    findings.push({
      type: 'disparity',
      message: `第一名与第 ${String(Math.min(5, sorted.length))} 名相差 ${String(Math.round(sorted[0] / baseline))} 倍，组间差距较大`,
    })
  }
  return findings
}

/**
 * @param agg - aggregation function.
 * @returns Chinese label.
 */
function aggLabel(agg) {
  return { sum: '合计', count: '计数', avg: '平均', min: '最小', max: '最大' }[agg] ?? agg
}

/**
 * @param row - aggregated row.
 * @param metrics - plan metrics.
 * @returns dimension text for the leading row.
 */
function formatDimText(row, metrics) {
  const dims = Object.keys(row).filter((key) => !metrics.some((metric) => metric.alias === key))
  if (dims.length === 0) return '头部组'
  return dims.map((key) => `${key}「${String(row[key])}」`).join('、')
}

/**
 * @param ratio - 0..1.
 * @returns formatted percentage.
 */
function percent(ratio) {
  return `${(ratio * 100).toFixed(1)}%`
}

/**
 * Format a number for business readers: thousands separator, 1 decimal max.
 * @param value - number.
 * @returns formatted text.
 */
export function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value ?? '')
  const fixed = Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(1)
  return fixed.replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
}

/**
 * Build "you can keep asking" suggestions from field roles.
 * @param fields - dataset field metadata.
 * @param usedDims - dimensions already used.
 * @returns question templates.
 */
export function suggestQuestions(fields, usedDims = []) {
  const dims = fields.filter((field) => field.role === 'dimension' && !usedDims.includes(field.name)).map((field) => field.name)
  const time = fields.find((field) => field.role === 'time')
  const measures = fields.filter((field) => field.role === 'measure').map((field) => field.name)
  const out = []
  if (dims.length > 0 && measures.length > 0) {
    out.push(`各 ${dims[0]} 的 ${measures[0]} 排名？`)
    if (dims.length > 1) out.push(`${dims[0]} × ${dims[1]} 交叉看 ${measures[0]}？`)
  }
  if (time !== undefined && measures.length > 0) {
    out.push(`${measures[0]} 按 ${time.name} 的月度趋势？`)
  }
  if (dims.length > 0 && measures.length > 1) {
    out.push(`各 ${dims[0]} 的 ${measures[0]} 与 ${measures[1]} 对比？`)
  }
  return out.slice(0, 3)
}

/**
 * One-paragraph business summary of a dataset (asset_overview).
 * @param fields - dataset field metadata.
 * @returns summary text.
 */
export function buildSummary(fields) {
  const dims = fields.filter((field) => field.role === 'dimension')
  const measures = fields.filter((field) => field.role === 'measure')
  const time = fields.filter((field) => field.role === 'time')
  const parts = [`含 ${String(dims.length)} 个维度、${String(measures.length)} 个度量`]
  if (time.length > 0) parts.push(`${String(time.length)} 个时间字段（${time[0].name}）`)
  if (dims.length > 0 && measures.length > 0) {
    parts.push(`可按 ${dims.slice(0, 3).map((field) => field.name).join('、')}${dims.length > 3 ? ' 等' : ''}分组统计 ${measures.slice(0, 2).map((field) => field.name).join('、')}`)
  } else if (fields.length === 0) {
    return '未读取到字段元信息'
  }
  return `${parts.join('，')}。`
}

/**
 * Enforce the byte budget by shedding optional payload in order.
 * @param payload - full tool result (JSON-serializable).
 * @param budgetBytes - budget.
 * @returns `{ payload, shed: string[] }` — `shed` lists what was removed.
 */
export function fitBudget(payload, budgetBytes = RESULT_BUDGET_BYTES) {
  const shed = []
  let current = payload
  const sizeOf = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8')
  const tryShed = (keys, reason) => {
    if (sizeOf(current) <= budgetBytes) return true
    const next = { ...current }
    let removed = false
    for (const key of keys) {
      if (next[key] !== undefined) {
        delete next[key]
        removed = true
      }
    }
    if (removed) shed.push(reason)
    current = next
    return sizeOf(current) <= budgetBytes
  }
  tryShed(['suggestedQuestions', 'samples'], '示例与建议')
  tryShed(['insights'], '自动洞察')
  tryShed(['fieldProfile', 'dictionary', 'timeRange'], '字段画像详情')
  if (sizeOf(current) > budgetBytes && Array.isArray(current.rows)) {
    const rows = current.rows
    let kept = rows.length
    while (kept > 2 && sizeOf({ ...current, rows: rows.slice(0, kept) }) > budgetBytes) kept -= 1
    current = { ...current, rows: rows.slice(0, kept), rowTruncated: { from: rows.length, kept } }
    shed.push(`结果行 ${String(rows.length)} → ${String(kept)}`)
  }
  return { payload: current, shed }
}

// #endregion

// #region dashboard context merging

/** Map BI selector operators onto planner filter operators. */
const SELECTOR_OP_MAP = {
  EQ: 'eq',
  NE: 'ne',
  IN: 'in',
  BT: 'between',
  GT: 'gt',
  GE: 'gte',
  LT: 'lt',
  LE: 'lte',
  CONTAINS: 'contains',
}

/** Numeric comparisons need real numbers; these convert from BI strings. */
const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte', 'between'])

/**
 * Map dashboard selectors onto filters for one target dataset.
 *
 * Resolution order per selector:
 *  1. Runtime targets (`targets[].dsId === datasetId`) — the BI frontend
 *     names the exact bound field.
 *  2. Page-definition binding (`pageSelectors`, from `page get`): SUB_DATE
 *     selectors (年/季/月) convert to between_dates ranges on the parent
 *     time field; plain bindings become eq/in on the bound field.
 *  3. Name match against the dataset fields (DOM-fallback selectors only
 *     carry a display name).
 * Anything unresolvable lands in `skipped` with a reason — never dropped
 * silently.
 * @param context - probe-captured dashboard context.
 * @param datasetId - dataset being analyzed.
 * @param fields - dataset field metadata (whitelist).
 * @param explicitFields - fields the caller already filtered on explicitly.
 * @param pageSelectors - selector definitions from the page JSON.
 * @param options - `{ cardId }`: analyze as one specific card. A selector
 *   that does not drive that card is then skipped instead of merged, so the
 *   query matches what the card on screen displays.
 * @returns `{ filters, skipped, notes }` in planner-filter shape.
 */
export function dashboardFiltersForDataset(context, datasetId, fields, explicitFields = [], pageSelectors = [], options = {}) {
  const cardId = String(options?.cardId ?? '')
  const filters = []
  const skipped = []
  const notes = []
  const fieldNames = new Set((fields ?? []).map((field) => field.name))
  const explicit = new Set(explicitFields)
  const seen = new Set()

  /** Push one mapped filter with explicit-field and dedupe guards. */
  const accept = (selector, filter, note = undefined) => {
    if (explicit.has(filter.field)) {
      skipped.push({ selector: selectorName(selector), field: filter.field, reason: '该字段已有显式筛选，看板值不覆盖' })
      return
    }
    const key = filter.op === 'between_dates'
      ? `${filter.field}:dates:${filter.start}:${filter.end}`
      : `${filter.field}:${filter.op}:${JSON.stringify(filter.value)}`
    if (seen.has(key)) return
    seen.add(key)
    // Keep the selector name on the filter: conflict reports and
    // `dashboardFiltersApplied` both need to say which control produced a range.
    filters.push({ ...filter, selector: selectorName(selector) })
    if (typeof note === 'string' && note !== '') notes.push(note)
  }

  for (const selector of context?.selectors ?? []) {
    // Page-definition binding beats every guess: the page JSON declares the
    // exact field (and date granularity) each selector is wired to. When a
    // target card is named we MUST go through it — only the page definition
    // knows which cards a selector drives, and the runtime targets are
    // dataset-wide (they would filter cards the selector never touches).
    if (pageSelectors.length > 0 && (cardId !== '' || !Array.isArray(selector.targets))) {
      const def = pageSelectors.find((candidate) => candidate.cdId === String(selector.selectorId ?? ''))
        ?? pageSelectors.find((candidate) => candidate.name === selectorName(selector))
      if (def !== undefined) {
        const mapped = selectorDefFilter(def, selector.values, datasetId, fields ?? [], cardId)
        if (mapped.skip !== undefined) {
          skipped.push({ selector: selectorName(selector), reason: mapped.skip })
        } else {
          accept(selector, mapped.filter, mapped.note)
        }
        continue
      }
      if (cardId !== '') {
        // Card-scoped call but this selector is not in the page definition
        // (stale cache, DOM-only capture): refuse to guess, because adding it
        // could filter a card the selector does not actually drive.
        skipped.push({
          selector: selectorName(selector),
          reason: '页面定义里找不到这个筛选器，无法确认它是否联动该卡片；为与卡片显示一致，未合并（如确认生效请显式加等价筛选）',
        })
        continue
      }
    }
    const rawOp = String(selector.operator ?? '').toUpperCase()
    const op = SELECTOR_OP_MAP[rawOp]
    if (op === undefined) {
      skipped.push({ selector: selectorName(selector), reason: `操作符 ${rawOp || '空'} 不支持自动合并` })
      continue
    }
    const rawValues = (Array.isArray(selector.values) ? selector.values : []).slice(0, 20)
    let value
    if (op === 'between') {
      if (rawValues.length !== 2) {
        skipped.push({ selector: selectorName(selector), reason: 'between 需要两个值' })
        continue
      }
      value = rawValues.map(Number)
      if (value.some((item) => !Number.isFinite(item))) {
        skipped.push({ selector: selectorName(selector), reason: 'between 的值不是数值' })
        continue
      }
    } else if (op === 'in') {
      if (rawValues.length === 0) {
        skipped.push({ selector: selectorName(selector), reason: 'in 没有选中值' })
        continue
      }
      value = rawValues.map(String)
    } else if (NUMERIC_OPS.has(op)) {
      value = Number(rawValues[0])
      if (!Number.isFinite(value)) {
        skipped.push({ selector: selectorName(selector), reason: `${rawOp} 的选中值不是数值` })
        continue
      }
    } else {
      value = String(rawValues[0] ?? '')
      if (value === '') {
        skipped.push({ selector: selectorName(selector), reason: '没有选中值' })
        continue
      }
    }

    const candidates = []
    for (const target of selector.targets ?? []) {
      if (String(target.dsId ?? '') === String(datasetId) && target.name) candidates.push(String(target.name))
    }
    if (candidates.length === 0 && !Array.isArray(selector.targets)) {
      const name = selectorName(selector)
      if (fieldNames.has(name)) candidates.push(name)
    }
    if (candidates.length === 0) {
      const foreign = (selector.targets ?? []).filter((target) => String(target.dsId ?? '') !== String(datasetId))
      if (Array.isArray(selector.targets) && selector.targets.length > 0 && foreign.length > 0) {
        const names = foreign.map((target) => target.name).filter(Boolean)
        const hint = names.length > 0 && names.some((name) => fieldNames.has(name))
          ? '；字段名与目标数据集相同，疑似同名不同 ID 的数据集（口径可能不同），如确认一致请手动加筛选'
          : ''
        skipped.push({ selector: selectorName(selector), reason: `筛选器绑定的是其他数据集（dsId ${foreign[0].dsId ?? '未知'}）${hint}` })
      } else {
        skipped.push({ selector: selectorName(selector), reason: '无法映射到该数据集的字段（缺少 targets，名称也不匹配）' })
      }
      continue
    }
    for (const field of [...new Set(candidates)]) {
      if (!fieldNames.has(field)) {
        skipped.push({ selector: selectorName(selector), field, reason: '字段不在数据集字段清单中' })
        continue
      }
      if (explicit.has(field)) {
        skipped.push({ selector: selectorName(selector), field, reason: '该字段已有显式筛选，看板值不覆盖' })
        continue
      }
      const key = `${field}:${op}:${JSON.stringify(value)}`
      if (seen.has(key)) continue
      seen.add(key)
      filters.push({ field, op, value, selector: selectorName(selector) })
    }
    const granularity = selector.sourceField?.granularity
    if (typeof granularity === 'string' && granularity !== '' && filters.length > 0) {
      notes.push(`筛选「${selectorName(selector)}」带 ${granularity} 粒度，已按原始值合并`)
    }
  }
  return { filters, skipped, notes }
}

/**
 * @param selector - probe selector entry.
 * @returns best-effort display name.
 */
function selectorName(selector) {
  return String(selector?.name ?? selector?.selectorId ?? '未知筛选器')
}

/**
 * Whether a dashboard context is fresh enough to act on.
 * @param capturedAt - probe timestamp.
 * @param now - injectable clock.
 * @returns true when within the freshness window.
 */
export function isContextFresh(capturedAt, now = Date.now()) {
  const at = Number(capturedAt)
  return Number.isFinite(at) && at > 0 && now - at <= 5 * 60_000
}
