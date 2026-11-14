import assert from 'node:assert/strict'
import test from 'node:test'

import {
  aggregateSample,
  buildAggregationSql,
  buildFieldProfileSql,
  buildSummary,
  buildTimeRangeSql,
  filterSample,
  fitBudget,
  parseDatasetMeta,
  planAnalysis,
  quoteIdent,
  quoteValue,
  resolveTimeRange,
  runInsights,
  suggestFields,
  suggestQuestions,
} from '../src/analysis.js'

const NOW = new Date(2026, 10, 14, 15, 30, 0) // 2026-11-14 15:30 local

const META_TEXT = `数据集: 04_SKU日销售明细 (w65345e07b7c9494eb5fa8e6)
- 类型: CSV | 状态: FINISHED
- 路径: 根目录>Guan CLI 测试>鲜珍坊经营数据>04_SKU日销售明细
- 行数: 1.097292e+06 | 列数: 5
- 更新: 2026-05-11 17:10:03+0800


字段列表 (5列, 3维度, 2度量):
  - 日期 (DATE/DIM)
  - 门店ID (STRING/DIM)
  - SKU编码 (STRING/DIM)
  - 销售数量 (LONG/METRIC)
  - 销售金额 (DOUBLE/METRIC)
`

const FIELDS = parseDatasetMeta(META_TEXT).fields

// #region parsing

test('parseDatasetMeta extracts name, scale, and role-tagged fields', () => {
  const meta = parseDatasetMeta(META_TEXT)
  assert.equal(meta.name, '04_SKU日销售明细')
  assert.equal(meta.rowCount, 1097292)
  assert.equal(meta.columnCount, 5)
  assert.equal(meta.updatedAt, '2026-05-11 17:10:03+0800')
  assert.deepEqual(meta.fields.map((field) => `${field.name}:${field.role}`), [
    '日期:time', '门店ID:dimension', 'SKU编码:dimension', '销售数量:measure', '销售金额:measure',
  ])
  assert.equal(meta.fields[1].dataType, 'STRING')
})

// #region quoting

test('quoteIdent escapes embedded backticks', () => {
  assert.equal(quoteIdent('销售金额'), '`销售金额`')
  assert.equal(quoteIdent('we`ird'), '`we``ird`')
})

test('quoteValue keeps numbers and escapes strings', () => {
  assert.equal(quoteValue(42), '42')
  assert.equal(quoteValue(3.5), '3.5')
  assert.equal(quoteValue("O'Brien"), "'O''Brien'")
  assert.equal(quoteValue('2026-01-01'), "'2026-01-01'")
})

// #region time ranges

test('resolveTimeRange translates business shortcuts into concrete dates', () => {
  assert.deepEqual(resolveTimeRange({ type: 'last_n_days', days: 90 }, NOW), {
    start: '2026-08-17', end: '2026-11-14', label: '近 90 天',
  })
  assert.deepEqual(resolveTimeRange({ type: 'this_month' }, NOW), {
    start: '2026-11-01', end: '2026-11-14', label: '本月至今',
  })
  assert.deepEqual(resolveTimeRange({ type: 'last_month' }, NOW), {
    start: '2026-10-01', end: '2026-10-31', label: '上月',
  })
  assert.deepEqual(resolveTimeRange({ type: 'this_year' }, NOW), {
    start: '2026-01-01', end: '2026-11-14', label: '今年至今',
  })
  assert.deepEqual(resolveTimeRange({ type: 'between_dates', start: '2026-01-01', end: '2026-03-31' }, NOW), {
    start: '2026-01-01', end: '2026-03-31', label: '2026-01-01 至 2026-03-31',
  })
})

test('resolveTimeRange rejects invalid specs', () => {
  assert.throws(() => resolveTimeRange({ type: 'last_n_days', days: 0 }, NOW), /days/u)
  assert.throws(() => resolveTimeRange({ type: 'last_n_days', days: 99999 }, NOW), /days/u)
  assert.throws(() => resolveTimeRange({ type: 'between_dates', start: '2026-03-01', end: '2026-01-01' }, NOW), /不能晚于/u)
  assert.throws(() => resolveTimeRange({ type: 'between_dates', start: '03-01', end: '2026-01-01' }, NOW), /start 与 end/u)
  assert.throws(() => resolveTimeRange({ type: 'yesterday' }, NOW), /未知的时间范围类型/u)
})

test('resolveTimeRange crosses month and year boundaries correctly', () => {
  const janFirst = new Date(2026, 0, 1, 10, 0, 0)
  assert.deepEqual(resolveTimeRange({ type: 'last_month' }, janFirst), {
    start: '2025-12-01', end: '2025-12-31', label: '上月',
  })
  const leapFeb = new Date(2024, 1, 10)
  assert.deepEqual(resolveTimeRange({ type: 'last_month' }, leapFeb), {
    start: '2024-01-01', end: '2024-01-31', label: '上月',
  })
})

// #region suggestions

test('suggestFields finds substring and fuzzy candidates', () => {
  const hints = suggestFields('门店', FIELDS)
  assert.ok(hints.includes('门店ID'))
  assert.ok(suggestFields('销售金额', FIELDS).includes('销售金额'))
  assert.deepEqual(suggestFields('不存在的字段xyz', FIELDS), [])
  assert.deepEqual(suggestFields('', FIELDS), [])
})

// #region plan validation

const validSpec = {
  by: ['门店ID'],
  metric: [{ field: '销售金额', agg: 'sum' }],
  filters: [{ op: 'last_n_days', days: 90 }],
  sort: { field: 'm1', direction: 'desc' },
  limit: 10,
}

test('planAnalysis accepts a valid business spec', () => {
  const { errors, plan } = planAnalysis(validSpec, FIELDS, NOW)
  assert.deepEqual(errors, [])
  assert.equal(plan.by[0].name, '门店ID')
  assert.equal(plan.metrics[0].alias, 'm1')
  assert.equal(plan.filters[0].kind, 'time')
  assert.equal(plan.filters[0].field, '日期')
  assert.equal(plan.filters[0].start, '2026-08-17')
  assert.equal(plan.sort.field, 'm1')
  assert.equal(plan.limit, 10)
})

test('planAnalysis rejects unknown fields with suggestions', () => {
  const { errors, plan } = planAnalysis({ ...validSpec, by: ['门店'] }, FIELDS, NOW)
  assert.equal(plan, null)
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /不存在/u)
  assert.ok(errors[0].suggestions.includes('门店ID'))
})

test('planAnalysis rejects wrong roles: measure as dimension and vice versa', () => {
  const asDim = planAnalysis({ ...validSpec, by: ['销售金额'] }, FIELDS, NOW)
  assert.match(asDim.errors[0].message, /不能作为分组维度/u)
  const asMetric = planAnalysis({ ...validSpec, metric: [{ field: '门店ID', agg: 'sum' }] }, FIELDS, NOW)
  assert.match(asMetric.errors[0].message, /不能作为度量/u)
  const asTime = planAnalysis({ ...validSpec, filters: [{ field: '门店ID', op: 'last_n_days', days: 7 }] }, FIELDS, NOW)
  assert.match(asTime.errors[0].message, /不是时间字段/u)
})

test('planAnalysis requires an explicit field when time shortcuts are ambiguous', () => {
  const twoTimeFields = [
    ...FIELDS,
    { name: '下单时间', dataType: 'DATETIME', role: 'time' },
  ]
  const { errors } = planAnalysis(validSpec, twoTimeFields, NOW)
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /请显式指定/u)
})

test('planAnalysis validates filter operators and value types', () => {
  assert.match(planAnalysis({ ...validSpec, filters: [{ field: '销售金额', op: 'eq' }] }, FIELDS, NOW).errors[0].message, /需要一个值/u)
  assert.match(planAnalysis({ ...validSpec, filters: [{ field: '门店ID', op: 'gt', value: 'abc' }] }, FIELDS, NOW).errors[0].message, /数值/u)
  assert.match(planAnalysis({ ...validSpec, filters: [{ field: '销售金额', op: 'between', value: [1] }] }, FIELDS, NOW).errors[0].message, /between/u)
  assert.match(planAnalysis({ ...validSpec, filters: [{ field: '门店ID', op: 'regex', value: 'x' }] }, FIELDS, NOW).errors[0].message, /不支持/u)
})

test('planAnalysis defaults to descending rank on the first metric', () => {
  const { plan } = planAnalysis({ by: ['门店ID'], metric: [{ field: '销售金额', agg: 'sum' }] }, FIELDS, NOW)
  assert.deepEqual(plan.sort, { field: 'm1', direction: 'desc' })
  const whole = planAnalysis({ metric: [{ field: '销售金额', agg: 'sum' }] }, FIELDS, NOW)
  assert.equal(whole.plan.sort, undefined, 'whole-dataset stats need no ordering')
})

test('planAnalysis clamps limit and validates sort targets', () => {
  const clamped = planAnalysis({ ...validSpec, limit: 99999 }, FIELDS, NOW)
  assert.equal(clamped.plan.limit, 500)
  const badSort = planAnalysis({ ...validSpec, sort: { field: '销售金额', direction: 'desc' } }, FIELDS, NOW)
  assert.match(badSort.errors[0].message, /排序字段/u)
  const badDir = planAnalysis({ ...validSpec, sort: { field: 'm1', direction: 'up' } }, FIELDS, NOW)
  assert.match(badDir.errors[0].message, /asc 或 desc/u)
})

test('planAnalysis supports count without a field and multiple metrics', () => {
  const { plan, errors } = planAnalysis({
    ...validSpec,
    metric: [{ agg: 'count' }, { field: '销售数量', agg: 'avg' }],
  }, FIELDS, NOW)
  assert.deepEqual(errors, [])
  assert.equal(plan.metrics[0].agg, 'count')
  assert.equal(plan.metrics[1].alias, 'm2')
})

test('planAnalysis requires at least one metric', () => {
  const { errors } = planAnalysis({ ...validSpec, metric: [] }, FIELDS, NOW)
  assert.match(errors[0].message, /至少需要一个度量/u)
})

// #region SQL generation

test('buildAggregationSql renders a server-side aggregation', () => {
  const { errors, plan } = planAnalysis(validSpec, FIELDS, NOW)
  assert.deepEqual(errors, [])
  const { sql, labels } = buildAggregationSql('04_SKU日销售明细', plan)
  assert.match(sql, /SELECT `门店ID` AS `门店ID`, SUM\(`销售金额`\) AS `m1`/u)
  assert.match(sql, /FROM `04_SKU日销售明细`/u)
  assert.match(sql, /WHERE `日期` >= '2026-08-17' AND `日期` <= '2026-11-14'/u)
  assert.match(sql, /GROUP BY `门店ID`/u)
  assert.match(sql, /ORDER BY `m1` DESC/u)
  assert.match(sql, /LIMIT 10/u)
  assert.deepEqual(labels.map((label) => label.column), ['门店ID', 'm1'])
})

test('buildAggregationSql injects value filters with escaped literals', () => {
  const { plan } = planAnalysis({
    ...validSpec,
    filters: [
      { field: '门店ID', op: 'in', value: ["S0001", "O'Neil"] },
      { field: '销售数量', op: 'between', value: [5, 50] },
      { field: 'SKU编码', op: 'contains', value: "A'B" },
    ],
  }, FIELDS, NOW)
  const { sql } = buildAggregationSql('ds', plan)
  assert.match(sql, /`门店ID` IN \('S0001', 'O''Neil'\)/u)
  assert.match(sql, /`销售数量` BETWEEN 5 AND 50/u)
  assert.match(sql, /`SKU编码` LIKE '%A''B%'/u)
})

test('buildAggregationSql omits GROUP BY for whole-dataset stats', () => {
  const { plan } = planAnalysis({ metric: [{ field: '销售金额', agg: 'sum' }] }, FIELDS, NOW)
  const { sql } = buildAggregationSql('ds', plan)
  assert.ok(!/GROUP BY/u.test(sql))
  assert.match(sql, /LIMIT 1/u, 'whole-dataset stats return a single bounded row')
})

test('buildFieldProfileSql builds dictionary and measure stats', () => {
  const dim = FIELDS.find((field) => field.name === '门店ID')
  const dict = buildFieldProfileSql('ds', dim)
  assert.match(dict.dictionarySql, /SELECT `门店ID` AS value, COUNT\(\*\) AS cnt/u)
  assert.match(dict.dictionarySql, /GROUP BY `门店ID`/u)
  assert.equal(dict.statsSql, null)
  const measure = FIELDS.find((field) => field.name === '销售金额')
  const stats = buildFieldProfileSql('ds', measure)
  assert.match(stats.statsSql, /MIN\(`销售金额`\)/u)
  assert.match(stats.statsSql, /AVG\(`销售金额`\)/u)
})

test('buildTimeRangeSql selects min and max of the time field', () => {
  assert.match(buildTimeRangeSql('ds', '日期'), /SELECT MIN\(`日期`\) AS min, MAX\(`日期`\) AS max/u)
})

// #region sample path

const SAMPLE_ROWS = [
  { '门店ID': 'S0001', '销售金额': '100', '日期': '2026-11-01' },
  { '门店ID': 'S0001', '销售金额': '200', '日期': '2026-11-02' },
  { '门店ID': 'S0002', '销售金额': '50', '日期': '2026-11-01' },
  { '门店ID': 'S0002', '销售金额': '900', '日期': '2026-11-05' },
]

test('aggregateSample groups string-valued rows numerically', () => {
  const { plan } = planAnalysis(validSpec, FIELDS, NOW)
  const { rows } = aggregateSample(SAMPLE_ROWS, plan)
  assert.deepEqual(rows, [
    { '门店ID': 'S0002', m1: 950 },
    { '门店ID': 'S0001', m1: 300 },
  ])
})

test('aggregateSample sorts by metric alias and counts without a field', () => {
  const { plan } = planAnalysis({
    by: ['门店ID'], metric: [{ agg: 'count' }], sort: { field: 'm1', direction: 'asc' },
  }, FIELDS, NOW)
  const { rows } = aggregateSample(SAMPLE_ROWS.slice(0, 3), plan)
  assert.deepEqual(rows.map((row) => `${row['门店ID']}:${String(row.m1)}`), ['S0002:1', 'S0001:2'])
})

test('filterSample mirrors the SQL predicates', () => {
  const { plan } = planAnalysis({
    ...validSpec,
    filters: [
      { field: '门店ID', op: 'in', value: ['S0002'] },
      { field: '销售金额', op: 'gte', value: 100 },
    ],
  }, FIELDS, NOW)
  const filtered = filterSample(SAMPLE_ROWS, plan.filters)
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]['销售金额'], '900')
})

// #region insights and shaping

test('runInsights flags concentration and disparity in business language', () => {
  const metrics = [{ alias: 'm1', field: '销售金额', agg: 'sum' }]
  const concentrated = [
    { '门店ID': 'S0006', m1: 900 },
    { '门店ID': 'S0001', m1: 300 },
    { '门店ID': 'S0002', m1: 200 },
    { '门店ID': 'S0003', m1: 100 },
    { '门店ID': 'S0004', m1: 50 },
  ]
  const findings = runInsights(concentrated, metrics, '按 门店ID 分组的前 5 组')
  assert.ok(findings.some((finding) => finding.type === 'concentration'))
  assert.ok(findings.some((finding) => finding.type === 'disparity'))
  assert.equal(runInsights([{ '门店ID': 'A', m1: 1 }], metrics, 'x').length, 0)
})

test('suggestQuestions and buildSummary speak business language', () => {
  const questions = suggestQuestions(FIELDS)
  assert.ok(questions.some((question) => question.includes('门店ID') && question.includes('销售数量')))
  assert.ok(questions.some((question) => question.includes('趋势')))
  assert.match(buildSummary(FIELDS), /2 个维度、2 个度量/u)
  assert.match(buildSummary(FIELDS), /日期/u)
})

test('fitBudget sheds optional payload in order and reports it', () => {
  const payload = {
    rows: Array.from({ length: 100 }, (_unused, index) => ({ dim: `d${String(index)}`, m1: index })),
    insights: [{ type: 'x', message: 'y' }],
    suggestedQuestions: ['q1'],
    sql: 'SELECT 1',
  }
  const { payload: fitted, shed } = fitBudget(payload, 800)
  assert.ok(shed.length > 0)
  assert.equal(fitted.suggestedQuestions, undefined)
  assert.ok(fitted.rows.length < 100)
  assert.equal(fitted.rowTruncated.kept, fitted.rows.length)
  const tiny = fitBudget({ rows: [{ a: 1 }], insights: [] }, 100_000)
  assert.deepEqual(tiny.shed, [])
})

// #region misc

test('planAnalysis is deterministic for identical input', () => {
  const a = planAnalysis(validSpec, FIELDS, NOW)
  const b = planAnalysis(validSpec, FIELDS, NOW)
  assert.deepEqual(a, b)
})

// #region dashboard context merging

import { dashboardFiltersForDataset, isContextFresh } from '../src/analysis.js'

const RUNTIME_SELECTOR = {
  selectorId: 'sel_1',
  name: '区域',
  operator: 'IN',
  values: ['华东', '华南'],
  targets: [{ dsId: 'ds_1', cdId: 'cd_1', fdId: 'fd_1', name: '门店区域' }],
}
const DOM_SELECTOR = { selectorId: 'sel_2', name: '门店ID', operator: 'EQ', values: ['S0001'] }

test('dashboardFiltersForDataset maps runtime targets onto whitelist fields', () => {
  const { filters, skipped } = dashboardFiltersForDataset(
    { selectors: [RUNTIME_SELECTOR] },
    'ds_1',
    [{ name: '门店区域', role: 'dimension' }, { name: '销售金额', role: 'measure' }],
  )
  assert.deepEqual(filters, [{ field: '门店区域', op: 'in', value: ['华东', '华南'] }])
  assert.deepEqual(skipped, [])
})

test('dashboardFiltersForDataset falls back to selector-name matching', () => {
  const { filters } = dashboardFiltersForDataset(
    { selectors: [DOM_SELECTOR] },
    'ds_1',
    [{ name: '门店ID', role: 'dimension' }],
  )
  assert.deepEqual(filters, [{ field: '门店ID', op: 'eq', value: 'S0001' }])
})

test('dashboardFiltersForDataset skips unresolvable, unknown, and explicit fields', () => {
  const { filters, skipped } = dashboardFiltersForDataset(
    { selectors: [
      RUNTIME_SELECTOR,
      { selectorId: 'sel_x', name: '神秘筛选', operator: 'EQ', values: ['a'] },
      { selectorId: 'sel_n', name: '区域', operator: 'XX', values: ['a'] },
    ] },
    'ds_1',
    [{ name: '门店区域', role: 'dimension' }, { name: '销售金额', role: 'measure' }],
    ['门店区域'],
  )
  assert.deepEqual(filters, [])
  assert.equal(skipped.length, 3)
  assert.match(skipped[0].reason, /已有显式筛选/u)
  assert.match(skipped[1].reason, /无法映射/u)
  assert.match(skipped[2].reason, /不支持/u)
})

test('dashboardFiltersForDataset handles numeric operators and between', () => {
  const { filters, skipped } = dashboardFiltersForDataset(
    { selectors: [
      { selectorId: 'a', name: '销售金额', operator: 'GE', values: ['100'] },
      { selectorId: 'b', name: '销售数量', operator: 'BT', values: ['5', '50'] },
      { selectorId: 'c', name: '销售数量', operator: 'GT', values: ['abc'] },
    ] },
    'ds_1',
    [{ name: '销售金额', role: 'measure' }, { name: '销售数量', role: 'measure' }],
  )
  assert.deepEqual(filters, [
    { field: '销售金额', op: 'gte', value: 100 },
    { field: '销售数量', op: 'between', value: [5, 50] },
  ])
  assert.equal(skipped.length, 1)
  assert.match(skipped[0].reason, /不是数值/u)
})

test('isContextFresh bounds the acting window', () => {
  const now = 1_730_000_000_000
  assert.equal(isContextFresh(now - 60_000, now), true)
  assert.equal(isContextFresh(now - 6 * 60_000, now), false)
  assert.equal(isContextFresh(0, now), false)
})
