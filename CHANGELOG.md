# Changelog

## 0.2.0

- 授权模型改为**环境级**：不再要求会话绑定观远 Agent，只认 `guancli auth list` 里已鉴权的 BI 环境。
- `@` 候选改为按环境检索数据集与看板（每类最多 8 条），支持 `@环境名/关键词` 切换环境并按会话记忆。
- mention 自带环境：`@[名称](dsh-guancli:dataset:<env>:<id>)`，模型步骤前复核环境仍处于鉴权状态。
- 新增只读工具：`guancli_environments`、`guancli_asset_inspect`、`guancli_dataset_preview`、`guancli_card_preview`，未绑定 Agent 的会话也能分析引用资产。
- 空状态不再静默：空查询、无匹配、无鉴权环境、缺 gateway、搜索失败、需重启各有说明行。

## 0.1.0

- 首个可用版本：`@` 候选按会话绑定的观远 Agent 授权快照生成，`agent/pre-step` 注入资产上下文。
