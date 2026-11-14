# Changelog

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
