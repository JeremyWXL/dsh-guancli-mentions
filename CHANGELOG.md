# Changelog

## 0.5.13

- **网络侦察探针（可行性验证版）**：在 guest 页面 hook `fetch` / `XMLHttpRequest`，捕获 BI 页面自身 API 调用——紧凑清单行（method+path+body 字节数，按签名去重，≤120 条）+ 疑似查询接口的 JSON 请求体详情（≤30 条，单条 ≤12 KB）。理由：广播通道 `GUANDATA_DASHBOARD_CONTEXT` 在该 BI 版本前端全部 bundle 中 0 命中（不存在）；DOM 通道拿不到筛选器→字段映射。BI 每次筛选变化都经 HTTP 重新查询，请求体天然带完整 selector→field→dataset 映射。
- 探针升级/卸载时恢复原始 `fetch`/`XHR`（`stop()` 调 `unhookNetwork()`），不在页面残留钩子。
- client 侧新增 `__GUANCLI_NET_PROBE__` 解析与 3 秒批量上报（`kind:'net-batch'`，缓冲 ≤200 条）；Host `context.domProbe` 新增 `netProbe` 槽位，`debug.dom` 可读。
- ⚠️ 本次含 Host 变更（netProbe 槽位），**需重启 DSH Desktop 后生效**。

## 0.5.12

- 探针无条件心跳：每 20 秒（及 DOMContentLoaded 时）上报 `{href, pageId, readyState}`——探针再静默也能被定位（经 `probe-state` 槽可读）。

## 0.5.11

- 探针上报空值页面筛选器：侦察证实 demo BI 的 `SEL_select` 下拉在无选中值时占位符是"请选择"而非 `.ant-select-selection-item`，此前被误跳。现在页面筛选器（`SEL_` class）即使没有选中值也作为 selector 上报，标记 `applied: false`——模型可区分"未筛选"与"未采集"。

## 0.5.10

- `debug.dom` 分槽返回 `{domProbe, probeState}`：watcher 状态与 DOM 侦察不再互相覆盖；probe-state 增加 `probeVersion`（从注入脚本提取），一眼看出 webview 里跑的是哪版探针。

## 0.5.9

- 探针宽口径采集按真实 DOM 侦察结果精确化：
  - 新增 **segmented 段控件**采集（`.ant-segmented-item-selected`）——demo BI 的 LR=可用库存 这类筛选器是 segmented 而非下拉，选中项无语义歧义，允许无名上报（`widget: 'segmented'`）；
  - **布局黑名单**：`scale-selector` 容器（"自动铺满(70%)"画布缩放）显式排除；
  - 下拉 pill 聚合优先从 `SEL_` 筛选器容器取标签。

## 0.5.8

- 探针注入器状态自报：每次扫描经侦察通道（`context.domProbe`）上传 `{kind:'probe-state', probeScriptChars, environments, webviews, biWebviews, attached, injectErrors}`，`debug.dom` 可读——排查"探针为何没注入"不再需要肉眼盲猜。

## 0.5.7

- 修复引用渲染失效：pre-step 此前把消息中的 wire mention（`@[名称](dsh-guancli:…)`）改写成裸 `@名称`，渲染层匹配不到 URI，引用被文件引用规则误识别。现在 pre-step **保留原文**，可读性由追加的 referenced-assets 上下文承担——已发送消息中的看板/数据集链接恢复可点击。

## 0.5.6

- 看板首载"文件不存在"自愈：Electron 错误页 -6（ERR_FILE_NOT_FOUND）在 BI 页面新 tab 首载时复现、重载必恢复。现在 did-fail-load 命中该模式时自动 reload 一次（每 webview 限一次、0.8s 沉降延迟、非 BI 页面不介入）。
- 探针注入时机改为 dom-ready 优先：导航关键期的 executeJavaScript 是首载失败的最大嫌疑，注入现在主要挂在 dom-ready，导航事件保留作为兜底。

## 0.5.5

- 探针版本握手：标记从 boolean 改为 `{version, stop}` 对象——client 刷新后重新注入时，旧探针被显式拆除（移除全部监听/定时器）再装新版，探针更新从此对"已打开的看板页面"也生效（此前必须导航 webview 才能换探针）。`PROBE_VERSION` 随 package.json 版本自动生成。

## 0.5.4

- 宽口径采集过滤无标签控件：画布布局控件（如"自动铺满(70%)"）没有可推导的筛选器标签，不再作为 selector 上报；有标签的（实测 `LR=可用库存` 这类真筛选器）保留。等待 DOM 侦察报告后进一步按 class 精确化。

## 0.5.3

- 修复侦察通道与宽口径采集的逻辑矛盾：DOM 侦察原本只在 selectors 为空时触发，而 0.5.2 的宽口径采集使 selectors 几乎不再为空，侦察永久失效。现在精确采集（runtime 广播或 data-selector-id）失败、仅宽口径兜底时即触发侦察上报，上下文同时带 `selectorPrecise` 标记。

## 0.5.2

- **探针脚本内联到 client bundle**（`scripts/sync-probe.mjs` 从 src/probe.js 生成）：探针迭代从此只需安装 + 刷新页面，不再要求重启 Host；`probe.script` RPC 移除。同步由测试强制（client 内联值必须与 buildProbeScript() 逐字符一致）。
- **宽口径采集（第三信源）**：运行时消息与 `[data-selector-id]` DOM 都落空时，自动进入宽口径——按 combobox 聚合选中胶囊、有值 input、原生 select，指纹为容器 class+邻近标签，origin 标记 `dom-wide`。噪音优于沉默：合并层本就有字段白名单把关。
- 跨数据集筛选跳过原因增强：点名目标 dsId；字段名与目标数据集相同时提示"疑似同名不同 ID 数据集（口径可能不同）"。
- 工具描述写明采集边界（画布 DS_ELEMENTS 可采集性因 BI 版本而异、selectors 为空不等于没有筛选）。

## 0.5.1

- 修复探针关键 bug：BI 运行时广播的 `selectors` 为**空数组**时，探针直接采用空数组、DOM 兜底被短路（`Array.isArray([])` 为真）。改为：运行时 selectors 非空才采用，否则回退 DOM；两侧数据均带 `origin: 'runtime'|'dom'` 标记。用户遇到的"动态维度状态未捕获"即此 bug——探针读到了看板的默认配置而非 DOM 实际选中值。
- 新增 DOM 侦察：selectors 持续为空时，探针每 30 秒上报一份页面 DOM 侦察报告（input/select 清单、data-* 属性名、候选容器），经 `context.domProbe` 存入 Host，可用 `debug.dom` action 读取——用于适配不同 BI 版本的 DOM 结构。

## 0.5.0

**侧边栏看板实时状态（一二期合并交付）**——在 DSH 内置浏览器里操作观远看板，对话能跟上你的手势：

- **探针注入**（client）：轮询发现侧边栏 webview 加载了已鉴权环境的 BI 页面后，通过 `webview.executeJavaScript` 注入看板探针（单源 `src/probe.js`，经 `probe.script` RPC 下发）。探针监听 BI 前端广播的 `GUANDATA_DASHBOARD_CONTEXT` 运行时消息（pageId、页面名、选中筛选器含字段 targets、聚焦卡片），降级走 DOM 读取；600ms 防抖后经 `console-message` 事件回传 renderer，再经 `context.publish` 上报 Host。全程失败静默降级。
- **`guancli_dashboard_context` 工具**（新）：模型读取当前看板实时状态；快照超过 5 分钟标注 stale。
- **pre-step 自动注入**：用户消息命中"当前看板/这张看板/现在的筛选/聚焦卡片"等线索时，自动附加看板状态上下文（带不可信警告与工具使用约定）。
- **筛选自动合并**（`guancli_analyze_dataset` 新增 `withDashboardFilters`）：把探针读到的选中筛选映射到目标数据集字段并 AND 进查询——优先使用 BI 运行时消息携带的字段 targets，DOM 降级数据按筛选器名称匹配；无法映射的项在 `dashboardFiltersSkipped` 中说明原因，绝不静默丢弃；用户显式筛选同名字段时不覆盖。
- **environments RPC 返回环境 URL**，供探针按 BI host 匹配注入目标。
- 修复（工作区既有改动）：composer 提交时对 chip 走所属 source 的 codec 序列化，为 `@` 引用 source 补齐 `codec`（此前发送会报 `slash: no serializer for reference source "guancli"`）。

## 0.4.0

- 引用直连侧边栏：已发送消息中的看板/数据集 `@` 引用渲染为可点击链接（📊/🗂️ 图标），点击后通过 `guancli url` 解析 BI 前端地址并在右侧栏内置浏览器中打开（`sidebarRight.openTab('browser', { params: { url } })`）。
- RPC 新增 `pageUrl` action（page/dataset 均可解析）；打开失败仅警告不干扰对话。
- 客户端注册 `conversation.user.text.node`（key `guancli-asset`）与对应 userText 规则，8 语言文案齐全。

## 0.3.1

- 修复：客户端版本门写死 `0.2.` 前缀，导致 Host 升级到 0.3.x 后误报"需要重启"。改为 semver 下限比较（≥ 0.2.0），并补充 0.2.0/0.3.0/0.10.1/1.0.0 回归用例。

## 0.3.0

**内置分析方法集**（设计见 `docs/analysis-methods.md`）——查询即聚合，替代拉明细给模型算：

- 新增 `guancli_asset_overview`：数据集/看板业务总览，字段按维度/度量/时间角色标注并附样例值、数据规模、时间跨度、建议问题。
- 新增 `guancli_field_profile`：枚举字段取值字典（含计数）与数值字段分布；写筛选前先查，不再猜值。
- 新增 `guancli_analyze_dataset`：语义化聚合分析。by/metric/filters/sort/limit 全部业务语言（支持 `last_n_days`/`this_month`/`between_dates` 等时间快捷方式），Host 校验字段白名单后生成 SQL 在 BI 侧聚合，110 万行实测 2 秒内返回 TopN；结果附自动洞察、建议下一步与可审计 SQL。
- 量控：聚合行数默认 20/硬上限 500 + 64 KiB 字节预算双保险；字段不在白名单直接拒绝并给拼写建议；结果按序精简（建议→洞察→行）。
- 体验：未指定排序时默认按首度量降序（排名类问题开箱即用）；时间快捷方式可省略字段（自动绑定唯一时间字段）；preview 工具降权为"仅验证字段含义"，默认行数收紧到 20。
- 降级链：环境不支持服务端 SQL 时自动切到 500 行样本 + 本地聚合，结果标注 `scope: "sample"` 与原因；SQL 能力按环境惰性探测并在 health 中报告。
- 修复：`between` 一词二义拆分为值操作符 `between` 与时间快捷方式 `between_dates`。

## 0.2.0

- 授权模型改为**环境级**：不再要求会话绑定观远 Agent，只认 `guancli auth list` 里已鉴权的 BI 环境。
- `@` 候选改为按环境检索数据集与看板（每类最多 8 条），支持 `@环境名/关键词` 切换环境并按会话记忆。
- mention 自带环境：`@[名称](dsh-guancli:dataset:<env>:<id>)`，模型步骤前复核环境仍处于鉴权状态。
- 新增只读工具：`guancli_environments`、`guancli_asset_inspect`、`guancli_dataset_preview`、`guancli_card_preview`，未绑定 Agent 的会话也能分析引用资产。
- 空状态不再静默：空查询、无匹配、无鉴权环境、缺 gateway、搜索失败、需重启各有说明行。

## 0.1.0

- 首个可用版本：`@` 候选按会话绑定的观远 Agent 授权快照生成，`agent/pre-step` 注入资产上下文。
