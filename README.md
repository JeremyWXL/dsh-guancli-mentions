# @local/dsh-guancli-mentions

在 DeepSeek Harness 的对话输入框里用 `@` 直接指定**当前 guancli 已鉴权环境中的观远数据集与看板**，并让模型针对它们做分析。

授权模型是**环境级**的：不需要会话绑定任何观远 Agent。只要 `guancli auth login` 过某个 BI 环境，该环境的数据集与看板就能被 `@`、能被查询。

插件是自包含的：唯一外部应用依赖是本机 `guancli`，环境发现、资产搜索和详情 inspect 都由本插件直接调用 CLI。DSH 宿主仅提供 `webServer`、`tools`、`dsh-llm`、`dsh-tools` 与 Client UI 服务，不需要额外的观远 DSH 插件。

## 组成

| 半边 | 文件 | 职责 |
|---|---|---|
| Browser | `client.js` | 注册 `@` source；按「观远数据集 / 观远看板」分节；空状态给出可执行的解释行 |
| Host | `index.js` | 环境发现与缓存、候选检索、`agent/pre-step` 解析引用并注入上下文、八个只读查询工具 |
| 范围 | `src/scope.js` | 页面筛选摘要、真实枚举、联动规则与逐卡片范围换算 |
| 共用 | `src/mention.js` | mention 语法（含环境与 scopeId）、查询分段、环境选择、上下文渲染 |
| CLI | `src/cli.js` | guancli runner（`auth list`、`search`/`get`、preview、URL 与聚合查询），JSON 归一化，`shell:false` 参数数组 |

## 环境是怎么定的

1. 你显式写 `@环境名/关键词` → 用该环境，并记住当前会话的选择；
2. 否则用当前会话上次用的环境；
3. 否则用 `guancli auth list` 里带 `*` 的默认环境；
4. 都没有 → 提示先 `guancli auth login`。

`@` 空查询时会直接告诉你当前环境名和已鉴权环境列表，所以不用记。

## 引用与查询

```
@[销售明细](dsh-guancli:dataset:demo:<dsId>)
@[经营看板](dsh-guancli:page:demo:<pageId>?scope=<scopeId>)
```

页面候选会读取真实筛选器和默认值，chip 显示有效范围摘要。点击页面 chip 可打开范围编辑器：普通枚举来自对应筛选器卡片，修改上游后按原联动关系刷新下游；日历与时间宏可编辑，不能安全换算的类型保持只读。编辑只影响本次引用，发送后冻结；`guancli_analyze_dataset` 与 `guancli_card_preview` 都可通过 `scopeId` 使用该范围，不会修改 BI 原页面。

DSH 的 chip 标签是插入时缓存，编辑后的最新摘要显示在编辑器中，原 chip 标签不会原位刷新。

Host 在模型步骤前：解析 mention → 复核该环境仍处于鉴权状态 → 用该环境凭据直接执行 `guancli ds get` / `page get -f json` → 保留原 wire mention，并追加一条 `<referenced-assets>` 上下文（类型、环境、ID、字段口径，带不可信内容警告）。

已发送消息中的引用渲染为**可点击链接**（📊 看板 / 🗂️ 数据集）：点击后通过 `guancli url` 解析 BI 前端地址，并在右侧栏内置浏览器中直接打开这张看板/数据集详情页（`sidebarRight.openTab('browser', …)`）。

## 看板实时状态联动

点击引用在侧边栏打开看板后，插件会自动向该 webview 注入看板探针：你在看板上的筛选选择、卡片点击（含下钻聚焦）都会被捕获，作为"当前看板状态"供模型使用。

- 用户说"**当前看板/这张看板/现在的筛选**"时，Host 自动把最新状态快照注入模型上下文；
- 模型也可随时调用 `guancli_dashboard_context` 读取；
- 分析时设 `withDashboardFilters: true`，`guancli_analyze_dataset` 会把你看板里选中的筛选自动合并进聚合查询：筛选器名按页面定义精确映射到绑定字段（年/季/月粒度自动转时间字段的日期区间），映射不到目标数据集的筛选在 `dashboardFiltersSkipped` 说明，探针未捕获到的页面筛选器在 `dashboardNotes` 提示。

### 卡片口径：筛选器只作用于它绑定的卡片

看板的全局筛选器并不是全页生效的——BI 给每个筛选器存了一份联动范围（`settings.asFilter.targetCdIds`），有的只驱动两三张卡片。按数据集合并筛选会把这些"只对部分卡片生效"的条件套到全量上，于是工具取到数和卡片显示值对不上。

- `guancli_card_context(profile, pageId, cardId)`：列出这张卡片**实际受哪些筛选器驱动**（各自映射到哪个字段）、哪些筛选器并不作用于它、以及卡片**自带的固定筛选**（卡片定义里的 `zoneData.filters`，例如某张「客单价」卡被硬编码为只算同店，而旁边的卡片不是）。
- `guancli_analyze_dataset(..., cardId, withDashboardFilters: true)`：只重放这张卡片绑定的筛选器 + 卡片自带固定筛选；未联动的筛选器进 `dashboardFiltersSkipped` 并说明原因。结果附 `dashboardCardContext`：`boundSelectors` / `unboundSelectors` / `embeddedFilters`。
- 卡片与 `datasetId` 不匹配时直接拒绝，并告出卡片真正的数据集，避免"用错库却不自知"。

限制：探针依赖 BI 前端运行时消息与 DOM 结构（与官方 companion 插件同一口径）；快照超过 5 分钟视为过期，需在看板上再做一次操作刷新。`selectorPrecise=false` 表示快照来自宽口径 DOM 猜测，可能漏采/误采。数据集级计算字段（看板卡片实际显示的度量，如 `销售金额=[实际成交额(券后)]*76`）从页面定义挖掘，并入数据集 overview，行级公式可直接作为 metric 聚合。

模型可用的只读工具（7 个）：

**理解资产（先看清再提问）**
- `guancli_asset_overview`：数据集/看板业务总览——字段按维度/度量/时间角色标注、附样例值、数据规模、时间跨度与建议问题。分析前必先调用。
- `guancli_field_profile`：枚举字段取值字典（含计数）或数值分布。写筛选前先查，不再猜值。

**业务分析（查询即聚合，核心）**
- `guancli_analyze_dataset`：语义化聚合。`by` 分组 + `metric` 度量（sum/count/avg/min/max）+ 业务筛选（`last_n_days`/`this_month`/`between_dates` 等时间快捷方式）+ 排序 + 行数。聚合在 BI 侧完成，110 万行实测 2 秒内返回 TopN；结果附自动洞察、建议下一步与可审计 SQL。

**环境与原语（保留）**
- `guancli_environments` / `guancli_asset_inspect`：列环境；读原始定义。
- `guancli_dataset_preview` / `guancli_card_preview`：⚠️ 仅用于验证字段含义或看样例行，**不要用于统计分析**（默认 20 行、硬上限 200）。

分析调用示例：

```json
{
  "profile": "demo", "datasetId": "ds_xx",
  "by": ["门店ID"],
  "metric": [{"field": "销售金额", "agg": "sum"}],
  "filters": [{"field": "门店ID", "op": "in", "value": ["S0001"]}, {"op": "last_n_days", "days": 90}],
  "limit": 10
}
```

by/metric/filters 的字段必须来自 `guancli_asset_overview` 的字段清单；写错会拒绝并给出拼写建议。未指定排序时默认按首度量降序。

## 安全边界

- 候选与校验都只认 `guancli auth list` 里有效的环境；不在其中的环境一律拒绝。
- 只读：`ds search` / `page search` / `ds get` / `page get` / `ds preview` / `card preview`，以及插件自己生成并经字段白名单校验的聚合 SQL（模型不接触裸 SQL）；没有写入、没有 ETL。
- 参数走数组 + `shell: false`；输出 2 MiB 上限；查询行数硬上限 200。
- 本地 RPC 仅 Loopback + 同源 POST + JSON（≤64 KiB），拒绝跨站。
- 资产定义以「不可信背景」注入，`<` 全部转义，超 6 KB 截断并标注。

## 自检

```bash
curl -s -X POST http://127.0.0.1:43129/guancli-mentions/v1/rpc \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:43129' \
  -d '{"action":"health"}'
# {"version":"0.8.2","backend":"guancli","environmentCount":10,"tools":"ready",...}

curl -s -X POST http://127.0.0.1:43129/guancli-mentions/v1/rpc \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:43129' \
  -d '{"action":"candidates","input":{"sessionId":"s","query":"销售"}}'
```

```bash
node --test
```

完整测试包含 ask-widget、Client、Host、CLI、probe、mention 与分析工具回归。

## 取数口径排障（先看这一节）

模型取数"看着有数、其实口径错了"的绝大多数情况属于下面四类。每类都有明确的信号，看到信号先按对应步骤处理，不要凭数值猜。

### 1. 结果是 0 行 / 与看板对不上 → 先查日期筛选是否打架

看板常同时挂 年份、季度、月份 三个筛选器，都绑到同一个时间字段。它们逐个 AND 叠加：区间不重叠就是 **0 行**。

从 0.8.1 起不再静默返回空集：`guancli_analyze_dataset` 会抛 `DASHBOARD_FILTER_CONFLICT`，报文里列出每个参与的筛选器及其区间。**这是筛选冲突，不是没有数据**。处理顺序：

1. 与用户确认此刻页面上真正生效的是哪个筛选器（年/季/月并存时通常只有一个在起作用，其余是历史遗留）；
2. 或者用 `filters` 显式钉住一个区间：`{field:"销售日期", op:"between_dates", start:"2020-02-01", end:"2020-02-29"}`；
3. 或者传 `cardId` + `withDashboardFilters: true`，只重放这张卡片绑定的筛选器。

即使交集非空（例如 `年份=2020` + `月份=2020-03`），合并结果也会收敛成 `2020-03-01~2020-03-31` 一个窗口，`dashboardFiltersApplied` 里每条都带 `selector` 说明来源控件。

### 2. `guancli_card_preview` 的数与屏幕不一致 → 它只跑页面默认值

旧版 `card preview` 调用固定带 `--with-default-filters`，取的是**页面默认值**，不是用户当前选中的值；带 `scopeId` 的调用则按编辑器确认的范围显式筛选。用户通过其他途径改过筛选后，默认预览与屏幕可能不同。

- 返回值里的 `filterBasis` 写明基准，`selectorComparison` 给出每个筛选器的「默认值 vs 当前选中值」，不一致时另有 `divergence` 警示，**此时不要用这份数据去印证屏幕上的数**；
- 要与卡片显示对齐，只能用 `guancli_analyze_dataset(..., cardId, withDashboardFilters: true)`。

### 3. `selectorPrecise: false` → 筛选值本身可能不准

宽口径 DOM 采集会漏采或误采（典型症状：采到"季度=2020Q2"与"月份=2020-02"这种自相矛盾的组合）。此时 `dashboardNotes` 会显式告警。结论交给用户前必须核对，尤其不要直接引用这类筛选值下判断。

### 4. 卡片度量的期次/公式错 → 属于看板内容，不要替它圆场

见过两类真实问题：`本期`列实际取到了上一年的值（期次宏错位）；两个序列的公式被复制成完全相同（"本期=同期"）。这类问题会让模型无论如何取数都对不上，正确处理是把证据（口径对比）交回给看板维护方，而不是调整查询去凑数。

### 空结果的自检清单

`rowCount=0` 时结果会附 `emptyResultHint`，列出实际生效的条件。逐项核对：

1. 区间是否落在数据集时间范围内（`guancli_asset_overview` 的 `timeRange`）；
2. 枚举值是否真的存在（`guancli_field_profile`，别猜写法）；
3. 多个时间筛选是否互相抵消（见第 1 条）；
4. 维度组合是否本身无数据（换掉一个维度看是否恢复）。

## 边界

- 每次关键词搜索是两条 `guancli ... search`（数据集 + 看板，各约 1 秒）；空查询不做搜索。
- 支持 dataset 与 page；卡片通过看板上下文查询；指标、ETL 不在本版范围。
- 草稿 chip 使用宿主通用引用样式（`appearance` 枚举只有 `session|file|folder`）。
