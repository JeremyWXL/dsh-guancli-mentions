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

模型可用的只读工具：

- `guancli_environments`：列出已鉴权环境；
- `guancli_asset_inspect`：读数据集/看板定义（看板拿到 cardId）；
- `guancli_dataset_preview`：预览数据集行数据（默认 50 行，硬上限 200）；
- `guancli_card_preview`：在页面上下文里预览卡片（同上）。

## 安全边界

- 候选与校验都只认 `guancli auth list` 里有效的环境；不在其中的环境一律拒绝。
- 只读：仅 `ds preview` / `card preview` / `ds get` / `page get`，没有 SQL、没有写入、没有 ETL。
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
node --test test/mention.test.mjs test/cli.test.mjs test/client.test.mjs
```

## 边界

- 每次关键词搜索是两条 `guancli ... search`（数据集 + 看板，各约 1 秒）；空查询不做搜索。
- 支持 dataset 与 page；卡片通过看板上下文查询；指标、ETL 不在本版范围。
- 草稿 chip 使用宿主通用引用样式（`appearance` 枚举只有 `session|file|folder`）。
