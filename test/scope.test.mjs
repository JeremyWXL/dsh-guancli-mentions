import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPageScope,
  cardPreviewInputForScope,
  filtersForCard,
  filtersForOptions,
  formatCardFilter,
  resolveScopeDefaults,
  summarizeScope,
  updateScopeSelections,
  validateScopeSelection,
} from '../src/scope.js'

function pageFixture() {
  return {
    pgId: 'pg_1',
    name: '销售看板',
    cards: [
      {
        cdId: 'region', name: '区域', cdType: 'SELECTOR',
        content: {
          selectorType: 'DS_ELEMENTS', multiSelect: false,
          defaultValue: { value: ['华东'], dvt: ['华东'], valueType: 'FIXED_VALUE' },
          source: { dsId: 'ds_1', field: { fdId: 'fd_region', name: '区域', fdType: 'STRING' } },
        },
        settings: { asFilter: { autoLink: { enabled: true, blockedCdIds: [] }, targetCdIds: ['chart_1', 'city'], columnMappings: [{
          sourceField: { fdId: 'fd_region', name: '区域' },
          targetFields: [
            { cdId: 'chart_1', dsId: 'ds_1', fdId: 'fd_region', name: '区域' },
            { cdId: 'city', dsId: 'ds_1', fdId: 'fd_city', name: '城市' },
          ],
        }] } },
      },
      {
        cdId: 'city', name: '城市', cdType: 'SELECTOR',
        content: {
          selectorType: 'DS_ELEMENTS', multiSelect: true,
          defaultValue: { value: [], dvt: [], valueType: 'FIRST_PICK' },
          source: { dsId: 'ds_1', field: { fdId: 'fd_city', name: '城市', fdType: 'STRING' } },
        },
        settings: { asFilter: { autoLink: { enabled: false, blockedCdIds: [] }, columnMappings: [{
          sourceField: { fdId: 'fd_city', name: '城市' },
          targetFields: [{ cdId: 'chart_1', dsId: 'ds_1', fdId: 'fd_city', name: '城市' }],
        }] } },
      },
      {
        cdId: 'date', name: '日期', cdType: 'SELECTOR',
        content: {
          selectorType: 'TIME_MACRO', defaultValue: '最近7天',
          options: [{ name: '最近7天', value: ['2026-11-10', '2026-11-16'] }],
        },
        settings: { asFilter: { targetCdIds: ['chart_1'], autoLink: { enabled: true, blockedCdIds: [] }, columnMappings: [] } },
      },
      { cdId: 'chart_1', name: '销售额', cdType: 'CHART', content: { dsId: 'ds_1' } },
      { cdId: 'chart_2', name: '库存', cdType: 'CHART', content: { dsId: 'ds_2' } },
    ],
  }
}

function scopeFixture() {
  return createPageScope({ scopeId: 'scope_1', sessionId: 'session_1', profile: 'demo', page: pageFixture() })
}

test('createPageScope reads real filters, defaults, mappings and linkage', () => {
  const scope = scopeFixture()
  assert.equal(scope.pageId, 'pg_1')
  assert.deepEqual(scope.cardIds.sort(), ['chart_1', 'chart_2'])
  assert.deepEqual(scope.selectors.map((selector) => selector.id), ['region', 'city', 'date'])
  assert.equal(scope.selectors[0].values[0], '华东')
  assert.equal(scope.selectors[1].valueType, 'FIRST_PICK')
  assert.equal(scope.selectors[2].options[0].label, '最近7天')
  assert.equal(summarizeScope(scope), '区域=华东 · 城市=首个候选 · 日期=最近7天')
})

test('createPageScope keeps only main page filters and expands selector groups', () => {
  const page = pageFixture()
  page.cards.push(
    {
      cdId: 'axis', name: '横轴', cdType: 'SELECTOR',
      content: { selectorType: 'PARAMETER', options: [{ name: '销售额' }] },
    },
    {
      cdId: 'hidden', name: '局部维度', cdType: 'SELECTOR',
      content: { selectorType: 'DS_ELEMENTS', source: { dsId: 'ds_1', field: { name: '局部维度' } } },
    },
  )
  page.meta = {
    filterLayout: ['date', 'region-group', 'missing'],
    layoutItemMap: { 'region-group': { cdIds: ['region', 'city'] } },
  }
  const scope = createPageScope({ scopeId: 'scope_layout', sessionId: 'session_1', profile: 'demo', page })
  assert.deepEqual(scope.selectors.map((selector) => selector.id), ['date', 'region', 'city'])

  // Older page definitions without filterLayout still expose their data
  // selectors, but chart parameters such as 横轴/纵轴/气泡 are never filters.
  delete page.meta
  const legacy = createPageScope({ scopeId: 'scope_legacy', sessionId: 'session_1', profile: 'demo', page })
  assert.deepEqual(legacy.selectors.map((selector) => selector.id), ['region', 'city', 'date', 'hidden'])
})

test('filtersForCard applies only original card mappings and autoLink rules', () => {
  const filters = filtersForCard(scopeFixture(), 'chart_1')
  assert.deepEqual(filters.map((filter) => [filter.field, filter.operator, filter.values]), [
    ['区域', 'EQ', ['华东']],
    ['日期', 'BT', ['2026-11-10', '2026-11-16']],
  ])
  assert.deepEqual(filtersForCard(scopeFixture(), 'chart_2'), [])
  assert.throws(() => filtersForCard(scopeFixture(), 'unknown'), /卡片/)
})

test('selectors without asFilter use the 0.8.1 same-dataset default scope', () => {
  const page = pageFixture()
  delete page.cards[0].settings.asFilter
  const scope = createPageScope({ scopeId: 'scope_default', sessionId: 'session_1', profile: 'demo', page })
  assert.deepEqual(filtersForCard(scope, 'chart_1').map((filter) => filter.field), ['区域', '日期'])
  assert.deepEqual(filtersForCard(scope, 'chart_2'), [])
})

test('unscoped selectors without a source dataset cannot invent a field filter', () => {
  const page = pageFixture()
  delete page.cards[2].settings.asFilter
  const scope = createPageScope({ scopeId: 'scope_unbound', sessionId: 'session_1', profile: 'demo', page })
  assert.equal(scope.selectors[2].editable, false)
  assert.deepEqual(filtersForCard(scope, 'chart_1').map((filter) => filter.field), ['区域'])
  assert.equal(summarizeScope(scope), '区域=华东 · 城市=首个候选')
})

test('options linkage reuses the original selector-to-selector mapping', () => {
  const filters = filtersForOptions(scopeFixture(), 'city')
  assert.deepEqual(filters, [{ field: '城市', fieldId: 'fd_city', operator: 'EQ', values: ['华东'], selectorId: 'region' }])
  assert.deepEqual(filtersForOptions(scopeFixture(), 'region'), [])
})

test('updates create an edited revision without mutating the original scope', () => {
  const original = scopeFixture()
  const edited = updateScopeSelections(original, {
    region: { values: ['华南'], displayValues: ['华南'] },
    city: { values: ['深圳', '广州'], displayValues: ['深圳', '广州'] },
  })
  assert.equal(original.selectors[0].values[0], '华东')
  assert.equal(edited.edited, true)
  assert.equal(edited.revision, 1)
  assert.equal(summarizeScope(edited), '区域=华南 · 城市=深圳、广州 · 日期=最近7天')
  const cleared = updateScopeSelections(edited, { region: { values: [] }, city: { values: [] } })
  assert.equal(summarizeScope(cleared), '日期=最近7天')
  assert.throws(() => updateScopeSelections(original, { ghost: { values: ['x'] } }), /筛选器/)
})

test('edited scopes produce explicit card preview input without page defaults', () => {
  const edited = updateScopeSelections(scopeFixture(), {
    region: { values: ['华南'], displayValues: ['华南'] },
  })
  assert.deepEqual(cardPreviewInputForScope(edited, 'chart_1', 25), {
    profile: 'demo', pageId: 'pg_1', cardId: 'chart_1', limit: 25,
    filters: ['区域 EQ 华南', '日期 BT 2026-11-10,2026-11-16'],
    withDefaultFilters: false,
  })
  assert.deepEqual(cardPreviewInputForScope(scopeFixture(), 'chart_1', 50), {
    profile: 'demo', pageId: 'pg_1', cardId: 'chart_1', limit: 50,
    filters: [], withDefaultFilters: true,
  })
  assert.throws(() => cardPreviewInputForScope(edited, 'unknown', 20), /卡片/)
})

test('edited scopes reject non-empty read-only filters instead of approximating them', () => {
  const page = pageFixture()
  page.cards.push({
    cdId: 'tree', name: '省份城市', cdType: 'TREE_SELECTOR',
    content: {
      selectorType: 'TREE', defaultValue: ['上海'],
      source: { dsId: 'ds_1', fieldSeq: [{ fdId: 'fd_city', name: '城市' }] },
    },
    settings: { asFilter: { targetCdIds: ['chart_1'], autoLink: { enabled: false }, columnMappings: [{
      sourceField: { fdId: 'fd_city', name: '城市' },
      targetFields: [{ cdId: 'chart_1', dsId: 'ds_1', fdId: 'fd_city', name: '城市' }],
    }] } },
  })
  const scope = createPageScope({ scopeId: 'scope_tree', sessionId: 'session_1', profile: 'demo', page })
  const edited = updateScopeSelections(scope, { region: { values: ['华南'] } })
  assert.throws(() => cardPreviewInputForScope(edited, 'chart_1', 20), /安全换算/)
})

test('dynamic defaults resolve from real options and remain fail closed', () => {
  const resolved = resolveScopeDefaults(scopeFixture(), {
    city: [{ value: '上海', label: '上海' }, { value: '杭州', label: '杭州' }],
  })
  assert.deepEqual(resolved.selectors[1].values, ['上海'])
  assert.throws(() => resolveScopeDefaults(scopeFixture(), { city: [] }), /城市/)
})

test('enum validation and CLI formatting reject ambiguous input', () => {
  const scope = scopeFixture()
  assert.equal(validateScopeSelection(scope, 'city', ['上海'], [{ value: '上海', label: '上海' }]), true)
  assert.throws(() => validateScopeSelection(scope, 'city', ['不存在'], [{ value: '上海' }]), /枚举/)
  assert.equal(
    validateScopeSelection(scope, 'date', ['2026-11-10', '2026-11-16'], scope.selectors[2].options),
    true,
  )
  assert.throws(() => validateScopeSelection(scope, 'date', ['最近7天'], scope.selectors[2].options), /枚举/)
  assert.equal(
    formatCardFilter({ field: '城市', operator: 'IN', values: ['上海', '杭州'] }),
    '城市 IN 上海,杭州',
  )
  assert.throws(
    () => formatCardFilter({ field: '城市', operator: 'IN', values: ['上海,浦东'] }),
    /逗号/,
  )
})
