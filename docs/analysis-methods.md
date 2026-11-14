# 观远资产分析方法集设计方案

> 目标：在 `@local/dsh-guancli-mentions` 插件中内置"调用观远 BI 资产做分析"的方法，
> 解决两类问题——**一次性数据量超限**（硬约束）与**非技术业务用户的使用体验**（软约束）。

## 1. 现状与问题

现有 4 个工具（`environments` / `asset_inspect` / `dataset_preview` / `card_preview`）是按 API 粒度切的，
存在三个结构性问题：

| 问题 | 后果 | 根因 |
|---|---|---|
| **拉明细做分析** | 110 万行的表 preview 上限 200 行，分析结论只基于前 200 行，且模型在上下文里做加减乘除，token 浪费严重 | preview 返回的是行，不是答案 |
| **无法翻页** | `ds preview` 没有 offset 参数，200 行之后的数据模型永远看不到 | CLI 能力边界（已实测确认） |
| **参数技术化** | filters 是 `field/operator/values` 结构化 JSON，业务用户不会写；字段名要写对才行 | 工具面向开发者设计 |

实测确认的关键事实（demo 环境）：

- `ds execute-sql` **真实可用**：110 万行明细 `GROUP BY` 聚合 **3 秒返回 10 行**（BI 侧执行 Spark SQL）。
- `ds get --brief` 返回字段元信息含**类型 + 角色**（`DATE/DIM`、`DOUBLE/METRIC`）、总行数、更新时间。
- `analyze topn/report` 是本地原语（对已有表格做分组排名/占比），可作降级路径的加工器。
- `execute-sql` 的列错误会返回字段建议（`UNRESOLVED_COLUMN ... Did you mean ...`），可做拼写纠正。
- 限制：`execute-sql` 需要 BI ≥ 8.2.0-hf12 且域设置开启"高级 SQL 查询"；直连数据集可能不支持。

## 2. 设计原则

1. **查询即聚合**：一次工具调用必须返回"能回答业务问题的量"（聚合行），而不是"原始数据的样本"。
   聚合发生在 BI 侧（SQL）或本地样本上（analyze 原语），**绝不把明细搬进模型上下文再算**。
2. **SQL 由 Host 生成**：模型只给业务参数（维度、度量、筛选、时间），SQL 由插件拼接——
   字段必须来自资产总览白名单，值参数化转义，模型不接触裸 SQL，注入面为零。
3. **三级降级链**：服务端聚合 → 本地样本聚合 → 受控明细预览。每级都明确标注口径（全量/样本）。
4. **工具按业务意图组织**，不按 API 组织：业务用户问"哪个门店卖得最好"，模型一步调 `analyze_dataset`。

## 3. 方法集（三层 7 个方法 + 2 个保留）

### 第 0 层：环境（保留）

| 工具 | 说明 |
|---|---|
| `guancli_environments` | 现有，保留 |

### 第 1 层：理解资产（探索，先看清再提问）

**`guancli_asset_overview`** — 资产总览（替代 `asset_inspect` 成为首选）

- 输入：`profile` + `assetType` + `assetId`
- 返回：
  - **字段表**：每个字段的名称、类型、角色（`dimension` / `measure` / `time`）、示例值 2-3 个
  - **规模**：总行数、列数、更新时间、时间字段的数据范围（min/max）
  - **可回答的问题类型**：基于字段角色推断（"含 3 个维度和 2 个度量，可做按门店/按日期的销售数量与销售金额统计"）
  - **建议的下一步**：2-3 条业务问题模板（guided analytics 入口）
- 数据源：`ds get --brief`（字段角色）+ `ds preview --limit 3`（示例值）+ 时间范围探测

**`guancli_field_profile`** — 字段画像

- 输入：`profile` + `datasetId` + `field`
- 返回：取值分布（枚举字段 Top 值 + 计数，即**合法取值字典**）、数值字段的 min/max/avg/空值率
- 用途：模型写筛选/分组前不再猜值；业务用户问"渠道有哪些"时直接答
- 实现：`execute-sql` 一条 `GROUP BY field ORDER BY cnt DESC LIMIT 20`（枚举）或聚合统计（数值）

### 第 2 层：业务分析（核心，聚合优先）

**`guancli_analyze_dataset`** — 语义化聚合分析

```
输入：
  profile, datasetId
  by:        ["门店ID", ...]        # 分组维度，可选多个；必须是 overview 白名单里的 dimension
  metric:    [{field: "销售金额", agg: "sum"}]   # 聚合函数 sum/count/avg/min/max；白名单 measure
  filters:   [{field: "日期", op: "last_n_days", value: 90}]   # 简化操作符，见下
  sort:      {field: "amt", direction: "desc"}
  limit:     默认 20，硬上限 500（聚合结果行数天然有界）

filters 操作符（业务语言）：
  eq/ne/contains/in            匹配
  gt/gte/lt/lte/between        数值与日期
  last_n_days / this_month / last_month / this_year / between_dates   时间快捷方式
```

- 执行：Host 翻译成 `SELECT dim, SUM(metric) ... WHERE ... GROUP BY ... ORDER BY ... LIMIT n`
- 返回：
  - 聚合结果（`--typed` JSON 数字）
  - `truncated` 标志与**为什么会截断**的解释 + 建议（加筛选/换更粗粒度）
  - **自动洞察**：结果上跑固定规则（Top1 集中度 >40%、组间差异 >3 倍、环比波动 >20%），以"发现"列表附在结果后
  - **建议下一步**：2-3 条业务问题模板
- 降级：execute-sql 不可用（环境未开 SQL 开关）→ `preview 取 500 行样本 + analyze topn 本地聚合`，
  结果明确标注 `scope: "sample"` 与样本量

**`guancli_trend`** — 趋势分析

- 输入：`profile, datasetId, metric, time_field?, granularity(day/week/month), time_range, compare(环比/同比/无)`
- 时间字段自动探测（overview 的 `time` 角色字段），粒度用 Spark 的 `date_trunc`
- 返回：时间桶 + 度量 + 同环比变化率；附波动洞察（峰值/谷值/异常点）

**`guancli_compare`** — 对比分析

- 输入：`profile, datasetId, metric, dimension, values: ["华东", "华南"], time_range?`
- 返回：各维度值的度量、占比、差值与比率；单维度自动做组内 TopN 对比

**`guancli_card_analyze`** — 卡片/看板分析

- 输入：`profile, pageId, cardId, （可选）by 覆盖、filters`
- 优先：inspect 卡片 → 拿到底层数据集 → 走 `analyze_dataset` 同一条 SQL 聚合路径
- 降级：`card preview` 样本 + `analyze` 本地加工，标注样本口径

### 第 3 层：明细验证（兜底，降权使用）

| 工具 | 变化 |
|---|---|
| `guancli_dataset_preview` | **保留但降权**：描述改为"仅用于验证字段含义、查看样例行，不作分析依据"。强制列投影（columns 必填其一，或 limit ≤ 20） |
| `guancli_card_preview` | 同上 |

## 4. 量控机制（硬约束清单）

| 机制 | 规则 |
|---|---|
| 聚合优先 | 分析层工具只返回聚合行；明细预览工具的描述与返回值中都标注"不作分析依据" |
| 行数上限 | 聚合：默认 20，硬上限 500；明细：默认 20，硬上限 200（比当前更严） |
| 字节预算 | 结果序列化超 64 KiB 即截断，报告截断原因与建议（超预算时优先砍掉示例值与字典） |
| 字段白名单 | `by` / `metric` / `filters` 引用的字段必须存在于该资产最近一次 `asset_overview` 的字段表中；不在 → 报错并给出 `Did you mean` 拼写建议（复用 BI 的 UNRESOLVED_COLUMN 提示） |
| 维度护栏 | `by` 只接受角色为 `dimension` 的字段；误传 `measure` 字段直接拒绝并解释 |
| 结果缓存 | 相同 profile+assetId+归一化参数 60 秒内命中缓存，避免模型重复拉取 |
| 明细无翻页 | 不承诺 offset；确需更多明细时引导"加筛选缩小范围"，而不是"翻下一页" |

## 5. 体验机制（软约束清单）

1. **字段业务化**：overview 按维度/度量/时间分组展示，附示例值——业务用户看到"销售金额（数值·例如 128.5）"就懂。
2. **取值字典**：`field_profile` 返回枚举字段的合法值清单，筛选值不再靠猜。
3. **智能时间**：`last_n_days: 90`、`this_month` 这类业务语言直接可用，Host 翻译成日期谓词。
4. **问题模板**：overview 与每次分析结果都附"可以继续问"的建议（如"按 `{dimension}` 看 `{metric}` 近 3 个月的趋势"）。
5. **自动洞察**：聚合结果上跑固定规则（Top1 集中度、组间倍数、环比波动），用业务语言输出"发现"。
6. **渲染友好**：金额千分位、数量单位、时间桶格式化，模型可直接转述。

## 6. 实现清单

| 模块 | 内容 |
|---|---|
| `src/analysis.js`（新） | 查询计划器：业务参数 → SQL 生成；时间翻译；字段白名单校验 + 拼写建议；洞察规则引擎；结果格式化与字节预算截断 |
| `src/cli.js` | 增加 `executeSQL()`（`--typed -f json`，limit 控制）、`datasetFields()`（get --brief 解析） |
| `index.js` | 注册 7 个新工具；`asset_overview`/`field_profile` 结果进 60s 缓存（兼作白名单存储） |
| `src/mention.js` | `ASSET_USAGE` 文案更新为指向新方法（引用上下文里告诉模型正确的下一步工具） |
| 自检 | `health` 增加 `sqlSupport: boolean`（启动时 `SELECT 1` 探测，决定默认路径与降级提示） |

### 工具描述策略（引导模型走对路径）

- 分析类工具描述首句即业务场景："回答'哪个/各 X 的 Y 怎么样'类问题，返回聚合统计而非明细"。
- `dataset_preview` 描述改为"仅用于查看样例、验证字段含义；分析请用 `guancli_analyze_dataset`"。
- 引用注入的 `ASSET_USAGE` 同步更新，让模型拿到引用后的第一个动作是 `asset_overview` 而非 preview。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| 环境未开 SQL 开关（execute-sql 403/500） | 启动探测 `sqlSupport`；降级 `preview 样本 + analyze 本地`，结果标注 `scope: "sample"`；提示用户联系 BI 管理员开启 |
| 直连数据集不支持 SQL | 同上降级链 |
| BI 版本 < 8.2.0-hf12 | 同上；`guancli server-version` 可读版本，health 里报告 |
| 模型引用 overview 白名单之外的字段 | Host 侧校验拒绝 + `Did you mean`；不执行 |
| SQL 注入 | 模型不接触裸 SQL；字段走白名单，字符串值一律参数转义（单引号加倍） |
| 枚举字段基数过高（如用户 ID 当维度） | `field_profile` 返回 cardinality 估算；`analyze` 对高基数字段给出警告并建议 TopN |

## 8. 测试计划

- `test/analysis.test.mjs`：查询计划器单测——SQL 生成（含转义）、时间翻译（边界：月末/跨年）、
  白名单校验与拼写建议、字节预算截断、洞察规则触发
- `test/host.test.mjs` 扩展：假 runner 走通"analyze 成功 / SQL 不支持降级 / 字段不在白名单 / 高基数警告"
- 真实环境冒烟（demo）：`asset_overview` → `analyze_dataset(by=门店ID)` → `trend` 全链路

## 9. 分期建议

- **一期（核心闭环）**：`asset_overview` + `field_profile` + `analyze_dataset` + SQL 探测与降级 + 量控机制 + 描述降权。覆盖 80% 业务问题。
- **二期**：`trend` + `compare` + `card_analyze` + 自动洞察规则扩充 + 建议下一步。
- **三期**：缓存命中率优化、问题模板个性化（按字段角色动态生成）。
