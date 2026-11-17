const EDITABLE_TYPES = new Set(['DS_ELEMENTS', 'CALENDAR', 'TIME_MACRO'])
const OPERATORS = new Set(['EQ', 'NE', 'LT', 'LE', 'GT', 'GE', 'BT', 'IN', 'CONTAINS', 'NOT_CONTAINS'])
const GRANULARITY = {
  YEAR: 'toYear',
  QUARTER: 'toQuarter',
  MONTH: 'toMonth',
  WEEK: 'toWeek',
  DAY: 'toDate',
  DATE: 'toDate',
}

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  throw error
}

function valuesOf(card) {
  const content = card?.content ?? {}
  const value = content.defaultValue
  if (content.selectorType === 'TIME_MACRO') {
    const name = typeof value === 'string' ? value : ''
    const option = (Array.isArray(content.options) ? content.options : []).find((item) => item?.name === name)
    return {
      values: Array.isArray(option?.value) ? option.value.map(String) : [],
      displayValues: name === '' ? [] : [name],
      valueType: 'FIXED_VALUE',
    }
  }
  if (Array.isArray(value)) return { values: value.map(String), displayValues: value.map(String), valueType: 'FIXED_VALUE' }
  return {
    values: Array.isArray(value?.value) ? value.value.map(String) : [],
    displayValues: Array.isArray(value?.displayValue)
      ? value.displayValue.map(String)
      : Array.isArray(value?.dvt) ? value.dvt.map(String) : Array.isArray(value?.value) ? value.value.map(String) : [],
    valueType: String(value?.valueType ?? content.valueType ?? 'FIXED_VALUE'),
  }
}

function operatorOf(content) {
  if (content.filterType !== undefined) return String(content.filterType).toUpperCase()
  if (content.selectorType === 'TIME_MACRO' || content.selectorType === 'CALENDAR') return 'BT'
  return content.multiSelect === true ? 'IN' : 'EQ'
}

function selectorOf(card) {
  const content = card?.content ?? {}
  const asFilter = card?.settings?.asFilter
  const mappings = Array.isArray(asFilter?.columnMappings) ? asFilter.columnMappings : []
  const source = content.source ?? {}
  const sourceField = source.field ?? mappings[0]?.sourceField ?? {}
  const defaults = valuesOf(card)
  const selectorType = String(content.selectorType ?? card?.cdType ?? '')
  const options = selectorType === 'TIME_MACRO'
    ? (Array.isArray(content.options) ? content.options : []).map((option) => ({
        value: String(option?.name ?? ''),
        label: String(option?.name ?? ''),
        values: Array.isArray(option?.value) ? option.value.map(String) : [],
      })).filter((option) => option.value !== '')
    : undefined
  return {
    id: String(card?.cdId ?? ''),
    name: String(card?.name ?? sourceField.name ?? card?.cdId ?? ''),
    type: selectorType,
    multiSelect: content.multiSelect === true,
    operator: operatorOf(content),
    ...defaults,
    sourceField: {
      dsId: String(source.dsId ?? mappings[0]?.sourceField?.dsId ?? ''),
      fdId: String(sourceField.fdId ?? ''),
      name: String(sourceField.name ?? card?.name ?? ''),
      granularity: String(sourceField.granularity ?? ''),
    },
    mappings: mappings.map((mapping) => ({
      sourceField: mapping?.sourceField ?? {},
      targetFields: Array.isArray(mapping?.targetFields) ? mapping.targetFields : [],
    })),
    defaultScope: asFilter === undefined,
    autoLink: asFilter === undefined ? undefined : {
      enabled: asFilter?.autoLink?.enabled !== false,
      blockedCdIds: Array.isArray(asFilter?.autoLink?.blockedCdIds) ? asFilter.autoLink.blockedCdIds.map(String) : [],
      targetCdIds: Array.isArray(asFilter?.targetCdIds) ? asFilter.targetCdIds.map(String) : [],
    },
    editable: EDITABLE_TYPES.has(selectorType) && (String(source.dsId ?? '') !== '' || asFilter !== undefined),
    ...(options === undefined ? {} : { options }),
  }
}

export function createPageScope({ scopeId, sessionId, profile, page, source = 'default' }) {
  const root = page?.data && typeof page.data === 'object' ? page.data : page
  const pageId = String(root?.pgId ?? root?.pageId ?? '')
  if (pageId === '') fail('SCOPE_PAGE_REQUIRED', '页面详情缺少页面 ID')
  const cards = Array.isArray(root?.cards) ? root.cards : []
  const filterIds = new Set(Array.isArray(root?.meta?.filterLayout) ? root.meta.filterLayout.map(String) : [])
  const selectors = cards
    .filter((card) => filterIds.has(String(card?.cdId ?? '')) || String(card?.cdType ?? '').includes('SELECTOR'))
    .map(selectorOf)
    .filter((selector) => selector.id !== '')
  const selectorIds = new Set(selectors.map((selector) => selector.id))
  return {
    scopeId: String(scopeId),
    sessionId: String(sessionId),
    profile: String(profile),
    pageId,
    pageName: String(root?.name ?? pageId),
    source,
    edited: false,
    revision: 0,
    frozen: false,
    selectors,
    cardIds: cards.map((card) => String(card?.cdId ?? '')).filter((id) => id !== '' && !selectorIds.has(id)),
    cardDatasets: Object.fromEntries(cards.map((card) => [
      String(card?.cdId ?? ''),
      String(card?.content?.dsId ?? card?.content?.dsInfo?.dsId ?? card?.content?.source?.dsId ?? ''),
    ])),
  }
}

function displayValue(selector) {
  if (selector.displayValues.length > 0) return selector.displayValues.join('、')
  if (selector.values.length > 0) return selector.values.join('、')
  if (selector.valueType === 'FIRST_PICK') return '首个候选'
  if (selector.valueType === 'MAX') return '最新候选'
  return '全部'
}

export function summarizeScope(scope) {
  const effective = scope.selectors.filter((selector) => (
    selector.defaultScope && selector.sourceField.dsId !== ''
  ) || selector.autoLink !== undefined)
  if (effective.length === 0) return '无生效页面筛选器'
  const active = effective.filter((selector) => selector.values.length > 0 || ['FIRST_PICK', 'MAX'].includes(selector.valueType))
  if (active.length === 0) return '全部（未设置默认筛选）'
  return active.map((selector) => `${selector.name}=${displayValue(selector)}`).join(' · ')
}

export function updateScopeSelections(scope, selections) {
  if (scope.frozen === true) fail('SCOPE_FROZEN', '已提交的数据范围不能继续编辑')
  const selectors = scope.selectors.map((selector) => {
    if (!Object.hasOwn(selections, selector.id)) return { ...selector }
    if (!selector.editable) fail('SCOPE_SELECTOR_READ_ONLY', `筛选器 ${selector.name} 不支持编辑`)
    const selection = selections[selector.id]
    const values = Array.isArray(selection?.values) ? selection.values.map(String) : []
    if (!selector.multiSelect && values.length > 1 && selector.operator !== 'BT') {
      fail('SCOPE_MULTIPLE_VALUES', `筛选器 ${selector.name} 只能选择一个值`)
    }
    return {
      ...selector,
      values,
      displayValues: Array.isArray(selection?.displayValues) ? selection.displayValues.map(String) : [...values],
      valueType: 'FIXED_VALUE',
    }
  })
  for (const id of Object.keys(selections)) {
    if (!scope.selectors.some((selector) => selector.id === id)) fail('SCOPE_SELECTOR_UNKNOWN', `未知筛选器：${id}`)
  }
  return { ...scope, selectors, edited: true, revision: scope.revision + 1 }
}

function targetFilters(scope, targetId, excludedSelectorId) {
  const filters = []
  const seen = new Set()
  for (const selector of scope.selectors) {
    if (selector.id === excludedSelectorId || selector.values.length === 0) continue
    if (selector.defaultScope) {
      const targetDsId = scope.cardDatasets[targetId] ?? ''
      if (selector.sourceField.dsId === '' || targetDsId === '' || selector.sourceField.dsId !== targetDsId) continue
    } else {
      if (selector.autoLink === undefined || !selector.autoLink.targetCdIds.includes(targetId)) continue
    }
    const modifier = GRANULARITY[selector.sourceField.granularity]
    const candidates = []
    let explicitlyMapped = false
    for (const mapping of selector.mappings) {
      for (const target of mapping.targetFields) {
        if (String(target?.cdId ?? '') !== targetId) continue
        explicitlyMapped = true
        candidates.push({ field: String(target?.name ?? ''), fieldId: String(target?.fdId ?? '') })
      }
    }
    const autoLinkAllowed = selector.defaultScope || (
      selector.autoLink.enabled && !selector.autoLink.blockedCdIds.includes(targetId)
    )
    if (!explicitlyMapped && autoLinkAllowed) {
      candidates.push({ field: selector.sourceField.name, fieldId: selector.sourceField.fdId })
    }
    for (const candidate of candidates) {
      if (candidate.field === '') fail('SCOPE_TARGET_FIELD_REQUIRED', `筛选器 ${selector.name} 缺少目标字段`)
      const key = `${candidate.fieldId}:${candidate.field}:${selector.operator}:${JSON.stringify(selector.values)}`
      if (seen.has(key)) continue
      seen.add(key)
      filters.push({
        field: candidate.field,
        ...(candidate.fieldId === '' ? {} : { fieldId: candidate.fieldId }),
        ...(modifier === undefined ? {} : { modifier }),
        operator: selector.operator,
        values: [...selector.values],
        selectorId: selector.id,
      })
    }
  }
  return filters
}

export function filtersForCard(scope, cardId) {
  if (!scope.cardIds.includes(cardId)) fail('SCOPE_CARD_MISMATCH', `卡片 ${cardId} 不属于页面 ${scope.pageId}`)
  return targetFilters(scope, cardId)
}

export function filtersForOptions(scope, selectorId) {
  if (!scope.selectors.some((selector) => selector.id === selectorId)) fail('SCOPE_SELECTOR_UNKNOWN', `未知筛选器：${selectorId}`)
  return targetFilters(scope, selectorId, selectorId)
}

export function cardPreviewInputForScope(scope, cardId, limit) {
  const selected = scope.edited ? filtersForCard(scope, cardId) : []
  for (const filter of selected) {
    const selector = scope.selectors.find((item) => item.id === filter.selectorId)
    if (selector && !selector.editable) {
      fail('SCOPE_SELECTOR_READ_ONLY', `筛选器 ${selector.name} 的非空条件暂不支持安全换算`)
    }
  }
  const filters = selected.map(formatCardFilter)
  if (!scope.edited && !scope.cardIds.includes(cardId)) fail('SCOPE_CARD_MISMATCH', `卡片 ${cardId} 不属于页面 ${scope.pageId}`)
  return {
    profile: scope.profile,
    pageId: scope.pageId,
    cardId,
    limit,
    filters,
    withDefaultFilters: !scope.edited,
  }
}

export function resolveScopeDefaults(scope, optionsBySelector) {
  const selectors = scope.selectors.map((selector) => {
    if (selector.values.length > 0 || !['FIRST_PICK', 'MAX'].includes(selector.valueType)) return { ...selector }
    const options = optionsBySelector[selector.id] ?? selector.options ?? []
    if (options.length === 0) fail('SCOPE_DEFAULT_UNRESOLVED', `筛选器 ${selector.name} 无法解析运行时默认值`)
    const option = selector.valueType === 'MAX'
      ? options.reduce((latest, item) => String(item.value) > String(latest.value) ? item : latest)
      : options[0]
    const values = Array.isArray(option.values) ? [...option.values] : [String(option.value)]
    return { ...selector, values, displayValues: [String(option.label ?? option.value)] }
  })
  return { ...scope, selectors }
}

export function validateScopeSelection(scope, selectorId, values, options) {
  const selector = scope.selectors.find((item) => item.id === selectorId)
  if (!selector) fail('SCOPE_SELECTOR_UNKNOWN', `未知筛选器：${selectorId}`)
  if (!selector.editable) fail('SCOPE_SELECTOR_READ_ONLY', `筛选器 ${selector.name} 不支持编辑`)
  if (selector.type === 'CALENDAR') return true
  if (selector.type === 'TIME_MACRO') {
    const actual = JSON.stringify(values.map(String))
    if (!options.some((option) => JSON.stringify(option.values ?? []) === actual)) {
      fail('SCOPE_OPTION_INVALID', `筛选器 ${selector.name} 包含非法枚举值`)
    }
    return true
  }
  const allowed = new Set(options.map((option) => String(option.value)))
  for (const value of values) {
    if (!allowed.has(String(value))) fail('SCOPE_OPTION_INVALID', `筛选器 ${selector.name} 包含非法枚举值`)
  }
  return true
}

export function formatCardFilter(filter) {
  if (!OPERATORS.has(filter.operator)) fail('SCOPE_OPERATOR_UNSUPPORTED', `不支持的筛选操作符：${filter.operator}`)
  if (!Array.isArray(filter.values) || filter.values.length === 0) fail('SCOPE_FILTER_EMPTY', '筛选条件不能为空')
  if (['IN', 'BT'].includes(filter.operator) && filter.values.some((value) => String(value).includes(','))) {
    fail('SCOPE_FILTER_AMBIGUOUS', '多值筛选暂不支持包含英文逗号的值')
  }
  const field = `${filter.field}${filter.modifier ? ` ${filter.modifier}` : ''}`
  return `${field} ${filter.operator} ${filter.values.map(String).join(',')}`
}
