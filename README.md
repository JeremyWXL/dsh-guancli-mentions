# @local/dsh-guancli-mentions

在 DeepSeek Harness 的对话输入框里用 `@` 直接指定**当前 guancli 已鉴权环境中的观远数据集与看板**，并让模型针对它们做分析。

授权模型是**环境级**的：不需要会话绑定任何观远 Agent。只要 `guancli auth login` 过某个 BI 环境，该环境的数据集与看板就能被 `@`、能被查询。

## 组成

| 半边 | 文件 | 职责 |
|---|---|---|
| Browser | `client.js` | 注册 `@` source；按「观远数据集 / 观远看板」分节；空状态给出可执行的解释行 |
| Host | `index.js` | 环境发现与缓存、候选检索、`agent/pre-step` 解析引用并注入上下文、四个只读查询工具 |
| 共用 | `src/mention.js` | mention 语法（含环境）、查询分段、环境选择、上下文渲染 |
| CLI | `src/cli.js` | 极简 guancli runner（`auth list` 解析 + `preview` 类只读查询），`shell:false` 参数数组 |

## 环境是怎么定的

1. 你显式写 `@环境名/关键词` → 用该环境，并记住当前会话的选择；
2. 否则用当前会话上次用的环境；
3. 否则用 `guancli auth list` 里带 `*` 的默认环境；
4. 都没有 → 提示先 `guancli auth login`。

`@` 空查询时会直接告诉你当前环境名和已鉴权环境列表，所以不用记。

## 引用与查询

```
@[销售明细](dsh-guancli:dataset:demo:<dsId>)
@[经营看板](dsh-guancli:page:demo:<pageId>)
```

Host 在模型步骤前：解析 mention → 复核该环境仍处于鉴权状态 → 用该环境凭据 `inspect` 资产 → 改写为可读 `@名称` 并追加一条 `<referenced-assets>` 上下文（类型、环境、ID、字段口径，带不可信内容警告）。

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
- 只读：`ds get` / `ds preview` / `page get` / `card preview`，以及插件自己生成并经字段白名单校验的聚合 SQL（模型不接触裸 SQL）；没有写入、没有 ETL。
- 参数走数组 + `shell: false`；输出 2 MiB 上限；查询行数硬上限 200。
- 本地 RPC 仅 Loopback + 同源 POST + JSON（≤64 KiB），拒绝跨站。
- 资产定义以「不可信背景」注入，`<` 全部转义，超 6 KB 截断并标注。

## 自检

```bash
curl -s -X POST http://127.0.0.1:43129/guancli-mentions/v1/rpc \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:43129' \
  -d '{"action":"health"}'
# {"version":"0.2.0","gateway":true,"environmentCount":10,"tools":"ready",...}

curl -s -X POST http://127.0.0.1:43129/guancli-mentions/v1/rpc \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:43129' \
  -d '{"action":"candidates","input":{"sessionId":"s","query":"销售"}}'
```

```bash
node --test test/mention.test.mjs test/analysis.test.mjs test/cli.test.mjs test/client.test.mjs test/host.test.mjs
```

## 边界

- 每次关键词搜索是两条 `guancli ... search`（数据集 + 看板，各约 1 秒）；空查询不做搜索。
- 支持 dataset 与 page；卡片通过看板上下文查询；指标、ETL 不在本版范围。
- 草稿 chip 使用宿主通用引用样式（`appearance` 枚举只有 `session|file|folder`）。
