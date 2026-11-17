/**
 * Page-definition mining: the raw `page get` JSON declares everything the
 * probe and the dataset API cannot see —
 *  - SELECTOR cards: each global filter's bound dataset field, its date
 *    granularity (YEAR/QUARTER/MONTH/DAY via SUB_DATE), and default values;
 *  - card dsInfo columns: dataset-level calculated fields (e.g.
 *    `销售金额 = [实际成交额(券后)]*76`) that the dataset get API never returns.
 *
 * Pure functions only; the Host caches raw page details and calls in here.
 */

/**
 * Parse a card's `settings.asFilter` linkage config (may be an object or a
 * JSON string). For SELECTOR cards this is the 联动范围: which cards the
 * selector applies to (`targetCdIds`) and per-card field mappings
 * (`columnMappings[].targetFields` — the field each target card is filtered
 * on, which may live on a different dataset than the selector source).
 * Absent asFilter means the default scope: every card on the page that uses
 * the selector's source dataset.
 * @param card - raw card entry.
 * @returns `{ cardIds, targets }` or null when unscoped.
 */
function parseLinkageScope(card) {
  const raw = card?.settings?.asFilter
  if (raw === null || raw === undefined) return null
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const cardIds = (Array.isArray(parsed.targetCdIds) ? parsed.targetCdIds : []).map(String)
  const targets = []
  const seen = new Set()
  for (const mapping of Array.isArray(parsed.columnMappings) ? parsed.columnMappings : []) {
    for (const tf of Array.isArray(mapping?.targetFields) ? mapping.targetFields : []) {
      const cdId = String(tf?.cdId ?? '')
      const dsId = String(tf?.dsId ?? '')
      const fdId = String(tf?.fdId ?? '')
      const fieldName = String(tf?.name ?? '')
      // Keep cdId: one selector can map the same value onto DIFFERENT fields
      // per target card, so the binding is per-card, not per-dataset. Keying
      // by dataset alone collapses two cards into one guess.
      const key = `${cdId}:${dsId}:${fdId}:${fieldName}`
      if (fieldName === '' || seen.has(key)) continue
      seen.add(key)
      targets.push({ cdId, dsId, fdId, fieldName })
    }
  }
  return { cardIds, targets }
}

/**
 * Extract the page's global selector definitions.
 * @param detail - raw page detail (must carry `cards`).
 * @returns selector definitions with binding targets and default values.
 */
export function extractPageSelectors(detail) {
  const cards = Array.isArray(detail?.cards) ? detail.cards : []
  const cardNames = new Map(cards.map((card) => [String(card?.cdId ?? ''), String(card?.name ?? '')]))
  const out = []
  for (const card of cards) {
    if (card?.cdType !== 'SELECTOR') continue
    const content = card.content ?? {}
    const source = content.source ?? {}
    const field = source.field ?? {}
    const defaultValue = content.defaultValue ?? {}
    const name = String(card.name ?? field.name ?? '')
    const cdId = String(card.cdId ?? '')
    if (cdId === '' && name === '') continue
    const linkage = parseLinkageScope(card)
    out.push({
      cdId,
      name,
      multiSelect: content.multiSelect === true,
      displayType: String(content.display?.type ?? ''),
      selectorType: String(content.selectorType ?? ''),
      defaultValues: (Array.isArray(defaultValue.value) ? defaultValue.value : []).map(String),
      target: {
        dsId: String(source.dsId ?? ''),
        dsName: String(source.dsName ?? ''),
        fdId: String(field.fdId ?? ''),
        fieldName: String(field.name ?? ''),
        parentFdName: field.parentFdName === undefined ? '' : String(field.parentFdName),
        granularity: field.granularity === undefined ? '' : String(field.granularity),
        fdType: String(field.fdType ?? ''),
      },
      // 联动范围: null = page default (all cards on the source dataset);
      // otherwise the selector only drives the listed cards, filtering each
      // on its mapped field (possibly on another dataset).
      scope: linkage === null ? null : {
        cardIds: linkage.cardIds,
        cardNames: linkage.cardIds.map((id) => cardNames.get(id) ?? '').filter((n) => n !== '').slice(0, 6),
        targets: linkage.targets,
      },
    })
  }
  return out
}

/**
 * Extract dataset-level calculated fields declared in card dsInfo columns.
 * @param detail - raw page detail.
 * @returns `[{ dsId, fields: [{ name, formula, fdType, aggregated }] }]`.
 */
export function extractCalcFields(detail) {
  const cards = Array.isArray(detail?.cards) ? detail.cards : []
  const byDataset = new Map()
  for (const card of cards) {
    const dsInfo = card?.content?.dsInfo
    const columns = Array.isArray(dsInfo?.columns) ? dsInfo.columns : null
    const dsId = String(dsInfo?.dsId ?? card?.content?.dsId ?? '')
    if (columns === null || dsId === '') continue
    let bucket = byDataset.get(dsId)
    if (bucket === undefined) {
      bucket = new Map()
      byDataset.set(dsId, bucket)
    }
    for (const column of columns) {
      const formula = String(column?.formula ?? '').trim()
      const name = String(column?.name ?? '')
      // Only measures: DIM calc fields (月=concat(month(...),'月') and the
      // like) are display helpers — grouping on them is impossible through
      // the raw dataset columns, and listing them as fields misleads.
      if (String(column?.metaType ?? 'METRIC') !== 'METRIC') continue
      if (formula === '' || name === '' || bucket.has(name)) continue
      bucket.set(name, {
        name,
        formula,
        fdType: String(column?.fdType ?? ''),
        aggregated: column?.isAggregated === true,
      })
    }
  }
  return [...byDataset.entries()].map(([dsId, fields]) => ({ dsId, fields: [...fields.values()] }))
}

/**
 * Compact per-card summary for the page overview (replaces the truncated
 * raw-JSON dump that hid selector definitions past the cut).
 * @param detail - raw page detail.
 * @returns card summaries.
 */
export function summarizeCards(detail) {
  const cards = Array.isArray(detail?.cards) ? detail.cards : []
  const out = []
  const names = (list) => (Array.isArray(list) ? list : [])
    .map((item) => String(item?.nameTranslated ?? item?.name ?? ''))
    .filter((value) => value !== '' && value !== '度量名')
    .slice(0, 20)
  for (const card of cards) {
    const cdType = String(card?.cdType ?? '')
    if (cdType !== 'CHART' && cdType !== 'DRILL') continue
    const content = card.content ?? {}
    const zone = content.meta?.chartMain?.zoneData ?? {}
    const metrics = (Array.isArray(zone.metric) ? zone.metric : []).map((metric) => ({
      name: String(metric?.nameTranslated ?? metric?.name ?? ''),
      ...(metric?.alias === undefined || metric.alias === '' ? {} : { alias: String(metric.alias) }),
      ...(String(metric?.formula ?? '').trim() === '' ? {} : { formula: String(metric.formula).trim() }),
      ...(metric?.advCalc === undefined ? {} : { advCalc: String(metric.advCalc?.advType ?? '') }),
    })).filter((metric) => metric.name !== '').slice(0, 20)
    out.push({
      cdId: String(card.cdId ?? ''),
      name: String(card.name ?? ''),
      chartType: String(content.chartType ?? ''),
      dsId: String(content.dsId ?? ''),
      dimensions: [...names(zone.row), ...names(zone.column)],
      metrics,
      ...(Array.isArray(zone.filters) && zone.filters.length > 0 ? { cardFilters: names(zone.filters) } : {}),
    })
  }
  return out
}

/** Days in one month (month is 1-based). */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

/** Pad to two digits. */
function pad2(value) {
  return String(value).padStart(2, '0')
}

/**
 * Convert one selector display value to a [start, end] date pair at the
 * given BI granularity. Accepts the formats this BI build renders:
 * 2020 / 2020-03 / 2020年3月 / 2020年第2季度 / 2020Q2 / 2020-03-15.
 * @param text - display value.
 * @param granularity - YEAR | QUARTER | MONTH | DAY | DATE | ''.
 * @returns `[start, end]` or null when unparsable.
 */
function valueToRange(text, granularity) {
  const value = String(text ?? '').trim()
  if (value === '') return null
  const g = String(granularity ?? '').toUpperCase()
  if (g === 'YEAR') {
    const match = /(\d{4})/u.exec(value)
    return match === null ? null : [`${match[1]}-01-01`, `${match[1]}-12-31`]
  }
  if (g === 'QUARTER') {
    const match = /(\d{4})\s*年第?\s*([1-4])\s*季度?/u.exec(value)
      ?? /(\d{4})\s*[-/]?\s*Q([1-4])/iu.exec(value)
    if (match === null) return null
    const year = Number(match[1])
    const startMonth = (Number(match[2]) - 1) * 3 + 1
    return [
      `${match[1]}-${pad2(startMonth)}-01`,
      `${match[1]}-${pad2(startMonth + 2)}-${String(daysInMonth(year, startMonth + 2))}`,
    ]
  }
  if (g === 'MONTH') {
    const match = /^(\d{4})\s*[-/年]\s*(\d{1,2})\s*月?$/u.exec(value)
    if (match === null) return null
    const year = Number(match[1])
    const month = Number(match[2])
    if (month < 1 || month > 12) return null
    return [`${match[1]}-${pad2(month)}-01`, `${match[1]}-${pad2(month)}-${String(daysInMonth(year, month))}`]
  }
  // DAY/DATE or untyped: full dates only.
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/u.exec(value)
  if (match === null) return null
  const date = `${match[1]}-${pad2(Number(match[2]))}-${pad2(Number(match[3]))}`
  return [date, date]
}

/**
 * Convert selector display values into one spanning date range.
 * Multiple values (multi-select) span from the earliest start to the
 * latest end; a single unparsable value fails the whole conversion.
 * @param values - display values.
 * @param granularity - BI granularity.
 * @returns `{ start, end }` or null.
 */
export function granularityToRange(values, granularity) {
  const list = (Array.isArray(values) ? values : []).map((value) => String(value ?? '').trim()).filter((value) => value !== '')
  if (list.length === 0) return null
  const ranges = []
  for (const value of list) {
    const range = valueToRange(value, granularity)
    if (range === null) return null
    ranges.push(range)
  }
  return {
    start: ranges.map((range) => range[0]).sort()[0],
    end: ranges.map((range) => range[1]).sort().at(-1),
  }
}

/**
 * Map one captured selector onto the target dataset through its page
 * definition: SUB_DATE bindings become between_dates filters on the parent
 * time field; plain field bindings become eq/in on the bound field.
 *
 * Linkage scope (联动范围): a selector with `settings.asFilter` only drives
 * the cards it lists, filtering each on a per-card mapped field that may
 * live on another dataset. Scoped selectors resolve through that mapping
 * (so a selector sourced from dataset A can legitimately filter dataset B);
 * unscoped selectors use the source binding, matching the page default
 * (every card on the source dataset).
 *
 * Passing `cardId` switches the whole resolution to CARD granularity: a
 * scoped selector that does not list that card is skipped with an explicit
 * reason, because the BI page will not apply it to that card either. This is
 * the difference between "the dataset under the dashboard" and "what the card
 * on screen actually shows".
 * @param def - one extractPageSelectors entry.
 * @param values - captured display values.
 * @param datasetId - dataset being analyzed.
 * @param fields - dataset field whitelist.
 * @param cardId - target card; when set, only cards the selector drives apply.
 * @returns `{ filter, note }` or `{ skip }`.
 */
export function selectorDefFilter(def, values, datasetId, fields, cardId = '') {
  const target = def?.target ?? {}
  const scope = def?.scope ?? null
  const card = String(cardId ?? '')
  const list = (Array.isArray(values) ? values : []).map((value) => String(value ?? '')).filter((value) => value !== '')
  if (list.length === 0) return { skip: '筛选器未应用（无选中值），未合并' }

  // Resolve the field this selector drives on the analyzed dataset.
  let boundName = ''
  let scopeNote = ''
  if (scope !== null) {
    if (card !== '') {
      if (!scope.cardIds.includes(card)) {
        return {
          skip: `该筛选器未联动这张卡片（只联动 ${scope.cardIds.length} 张卡片${cardNamesHint(scope)}），看板不会把选中值应用到它，未合并`,
        }
      }
      const mine = scope.targets.find((item) => String(item.cdId) === card && String(item.dsId) === String(datasetId))
      const fallback = scope.targets.find((item) => String(item.dsId) === String(datasetId))
      const chosen = mine ?? fallback
      if (chosen === undefined) {
        return { skip: `该筛选器联动了这张卡片，但卡片在数据集 ${datasetId} 上没有对应的映射字段，未合并` }
      }
      boundName = String(chosen.fieldName ?? '')
      scopeNote = `；按卡片映射作用于「${boundName}」`
    } else {
      const hits = scope.targets.filter((item) => String(item.dsId) === String(datasetId))
      if (hits.length === 0) {
        return { skip: `筛选器联动范围只覆盖 ${scope.cardIds.length} 张卡片，均不使用数据集 ${datasetId}，未合并` }
      }
      boundName = String(hits[0].fieldName ?? '')
      scopeNote = `；注意该筛选器只联动页面上的 ${scope.cardIds.length} 张卡片${cardNamesHint(scope)}`
    }
  } else {
    if (String(target.dsId ?? '') !== String(datasetId)) {
      return { skip: `筛选器绑定的是其他数据集（dsId ${target.dsId || '未知'}）` }
    }
    boundName = String(target.parentFdName ?? '') !== '' ? String(target.parentFdName) : String(target.fieldName ?? '')
    if (card !== '') scopeNote = '；该筛选器未设联动范围，按页面默认作用于同数据集全部卡片'
  }
  if (boundName === '') boundName = String(def.name ?? '')

  const fieldByName = new Map((fields ?? []).map((field) => [field.name, field]))
  const granularity = String(target.granularity ?? '')
  const field = fieldByName.get(boundName)
  if (field === undefined) return { skip: `绑定字段「${boundName}」不在数据集字段清单中` }
  if (field.role === 'time') {
    const range = granularityToRange(list, granularity !== '' ? granularity : 'DAY')
    if (range === null) return { skip: `选中值「${list.join('、')}」无法按 ${granularity || '日期'} 粒度解析为日期区间` }
    return {
      filter: { field: boundName, op: 'between_dates', start: range.start, end: range.end },
      note: `筛选「${def.name}」按页面定义映射到 ${boundName}（${granularity || 'DAY'} 粒度 → ${range.start}~${range.end}）${scopeNote}`,
    }
  }
  if (String(target.fdType ?? '') === 'SUB_DATE' || granularity !== '') {
    return { skip: `绑定字段「${boundName}」不是时间字段，无法按 ${granularity || '日期'} 粒度转换` }
  }
  if (field.role !== 'dimension') return { skip: `绑定字段「${boundName}」是度量，无法作为等值筛选自动合并` }
  return {
    filter: { field: boundName, op: list.length > 1 ? 'in' : 'eq', value: list.length > 1 ? list : list[0] },
    note: `筛选「${def.name}」按页面定义映射到 ${boundName}${scopeNote}`,
  }
}

/**
 * Render a short "（卡片A、卡片B 等）" hint for a linkage scope.
 * @param scope - selector scope.
 * @returns hint text, possibly empty.
 */
function cardNamesHint(scope) {
  if (!Array.isArray(scope?.cardNames) || scope.cardNames.length === 0) return ''
  const more = scope.cardIds.length > scope.cardNames.length ? ' 等' : ''
  return `（${scope.cardNames.join('、')}${more}）`
}

/**
 * Whether a selector drives one specific card.
 *
 * `null` scope means the page default: every card on the selector's source
 * dataset. A scoped selector drives exactly `scope.cardIds`.
 * @param def - extractPageSelectors entry.
 * @param cardId - target card.
 * @param cardDsId - the card's dataset (for the unscoped default).
 * @returns `{ bound: boolean, fieldName?: string, reason?: string }`.
 */
export function selectorCardBinding(def, cardId, cardDsId = '') {
  const scope = def?.scope ?? null
  const card = String(cardId ?? '')
  if (card === '') return { bound: false, reason: '未指定卡片' }
  if (scope === null) {
    const sourceDsId = String(def?.target?.dsId ?? '')
    const bound = cardDsId === '' || sourceDsId === '' || String(cardDsId) === sourceDsId
    return bound
      ? { bound: true, fieldName: String(def?.target?.fieldName ?? '') }
      : { bound: false, reason: `筛选器未设联动范围，只作用于其源数据集 ${sourceDsId}` }
  }
  if (!scope.cardIds.includes(card)) {
    return { bound: false, reason: `联动范围只包含 ${scope.cardIds.length} 张卡片${cardNamesHint(scope)}` }
  }
  const mapped = scope.targets.find((item) => String(item.cdId) === card)
  return { bound: true, fieldName: String(mapped?.fieldName ?? def?.target?.fieldName ?? '') }
}

/**
 * Extract the filters a card carries itself (`zoneData.filters`).
 *
 * These are invisible to the dashboard selectors and to any dataset-level
 * query: a card titled 客单价 can still be hard-filtered to 同店, which makes
 * it disagree with the card next to it. Analyzing "as that card" has to
 * replay them.
 * @param detail - raw page detail.
 * @returns Map<cardId, [{ field, filterType, values }]>.
 */
export function extractCardFilters(detail) {
  const cards = Array.isArray(detail?.cards) ? detail.cards : []
  const out = new Map()
  for (const card of cards) {
    const cdId = String(card?.cdId ?? '')
    if (cdId === '') continue
    const zone = card?.content?.meta?.chartMain?.zoneData ?? {}
    const raw = Array.isArray(zone.filters) ? zone.filters : []
    const filters = []
    for (const entry of raw) {
      const field = String(entry?.name ?? '')
      if (field === '') continue
      filters.push({
        field,
        filterType: String(entry?.filterType ?? ''),
        values: (Array.isArray(entry?.filterValue) ? entry.filterValue : []).map((value) => String(value ?? '')),
      })
    }
    if (filters.length > 0) out.set(cdId, filters)
  }
  return out
}

/**
 * Convert one card's own filters into planner filters.
 * @param detail - raw page detail.
 * @param cardId - target card.
 * @param fields - dataset field whitelist.
 * @returns `{ filters, skipped, notes }`.
 */
export function cardEmbeddedFilters(detail, cardId, fields) {
  const entries = extractCardFilters(detail).get(String(cardId ?? '')) ?? []
  const byName = new Map((fields ?? []).map((field) => [field.name, field]))
  const filters = []
  const skipped = []
  const notes = []
  for (const entry of entries) {
    const field = byName.get(entry.field)
    if (field === undefined) {
      skipped.push({ field: entry.field, reason: '卡片固定筛选的字段不在数据集字段清单中，未合并' })
      continue
    }
    const op = { IN: 'in', EQ: 'eq', NE: 'ne' }[entry.filterType]
    if (op === undefined) {
      skipped.push({ field: entry.field, reason: `卡片固定筛选 ${entry.filterType || '(空)'} 暂不支持自动合并，请手工加筛选` })
      continue
    }
    const usable = entry.values.filter((value) => value !== '')
    if (usable.length === 0) continue
    filters.push({ field: entry.field, op, value: op === 'in' ? usable : usable[0] })
    notes.push(`卡片自带固定筛选「${entry.field} ${entry.filterType} ${usable.join('、')}」，已合并以保证与卡片显示一致`)
  }
  return { filters, skipped, notes }
}
