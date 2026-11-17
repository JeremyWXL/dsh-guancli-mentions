# 页面筛选范围编辑器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每个 `@页面` 引用携带独立数据范围，支持查看真实筛选器、枚举和联动，编辑后按原卡片映射查询。

**Architecture:** `src/scope.js` 负责纯数据解析、摘要、联动和卡片筛选换算；Host 持有会话内草稿范围并在发送时冻结。Client 在候选阶段取得范围摘要，通过 `openReference` 打开编辑器；Agent 只使用 `scopeId + cardId` 查询已冻结范围。

**Tech Stack:** Node.js ESM、`node:test`、React 18、DSH input-trigger/slot API、现有 `guancli` CLI。

**约束:** 保留当前未提交改动，不创建提交，不修改 BI 页面配置。DSH chip 标签是插入时缓存；初始终显示真实默认摘要，编辑后的最新摘要由范围编辑器展示，宿主没有公开的原位 chip 标签更新接口。

---

### Task 1: 范围引用语法

**Files:**
- Modify: `src/mention.js`
- Test: `test/mention.test.mjs`

- [ ] 写失败测试：旧引用保持兼容；页面引用可携带 `?scope=<id>`，解析结果为 `scopeId`，数据集不接受该字段。
- [ ] 运行 `node --test test/mention.test.mjs`，确认新断言失败。
- [ ] 将 mention 正则的页面 ID 与可选 query 分开解析，扩展 `formatMention(label, type, env, id, scopeId)`；`buildContextText` 增加各页范围独立及 `scopeId` 查询约定。
- [ ] 重跑测试，确认旧测试与新测试通过。

### Task 2: 页面筛选器纯模型

**Files:**
- Create: `src/scope.js`
- Create: `test/scope.test.mjs`

- [ ] 用真实页面结构写夹具：`DS_ELEMENTS`、`CALENDAR`、`TIME_MACRO`、显式 `columnMappings`、`autoLink`、筛选器到筛选器的联动目标。
- [ ] 写失败测试覆盖：`createPageScope` 提取筛选器和默认值；`summarizeScope` 输出名称和值；`filtersForCard` 只返回目标卡片的条件；上游条件可传给下游枚举查询；未知卡片、未知筛选器、非法操作符和含逗号多值 fail closed。
- [ ] 运行 `node --test test/scope.test.mjs`，确认模块不存在导致失败。
- [ ] 实现以下纯函数，所有输入输出保持 JSON 可序列化：

```js
createPageScope({ scopeId, sessionId, profile, page, source = 'default' })
summarizeScope(scope)
updateScopeSelections(scope, selections)
filtersForCard(scope, cardId)
filtersForOptions(scope, selectorId)
validateScopeSelection(scope, selectorId, values, options)
```

- [ ] 筛选条件统一使用 `{ field, modifier?, operator, values }`；另提供 `formatCardFilter(filter)` 生成 CLI 的 `字段 [粒度] 操作符 值`。
- [ ] 重跑纯模型测试并确认通过。

### Task 3: CLI 页面与显式筛选支持

**Files:**
- Modify: `src/cli.js`
- Test: `test/cli.test.mjs`

- [ ] 写失败测试：`getPage` 调用 `--profile <p> --raw page get <id> --brief`，JSON 结果原样返回；`previewCard` 可接收 `filters` 并逐项展开为 `--filter`；枚举预览不得误加 `--with-default-filters`。
- [ ] 运行 `node --test test/cli.test.mjs`，确认新增测试失败。
- [ ] 保留现有默认筛选参数，新增：

```js
getPage({ profile, pageId, signal })
previewCard({ profile, pageId, cardId, limit, filters = [], withDefaultFilters = true, signal })
```

当 `withDefaultFilters=false` 时不传 `--page-id`，因为当前 CLI 只允许它和默认筛选或报表字段一起使用。
- [ ] 重跑 CLI 测试并确认通过。

### Task 4: Host 范围生命周期与 RPC

**Files:**
- Modify: `index.js`
- Modify: `test/host.test.mjs`

- [ ] 写失败 RPC 测试：页面候选带 `scopeId` 和摘要；`scope.get` 只返回同会话范围；`scope.options` 返回 `{value,label}` 枚举并应用上游联动；`scope.save` 校验选项、更新摘要和修订号；伪造会话、范围、筛选器和枚举值被拒绝。
- [ ] 运行 `node --test test/host.test.mjs`，确认新动作返回 `UNKNOWN_ACTION`。
- [ ] 在 `Runtime` 增加有界 `Map` 范围仓库，使用 `randomUUID` 生成 ID；页面候选串行读取页面详情，避免同 profile 认证会话冲突。元数据失败时保留候选项并明确标记默认范围，不伪造摘要。
- [ ] 增加 `scope.get`、`scope.options`、`scope.save`；草稿可在发送前修订，`enrichMessages` 第一次消费后冻结，冻结后拒绝继续保存。
- [ ] 对编辑范围解析全部有效选择：固定默认值直接采用，`FIRST_PICK` 取真实首个候选，日期 `MAX` 取真实最大值；无值表示不添加筛选。无法解析的非空默认条件必须报错。
- [ ] 重跑 Host 测试并确认通过。

### Task 5: Agent 上下文与卡片查询

**Files:**
- Modify: `index.js`
- Modify: `src/mention.js`
- Test: `test/host.test.mjs`
- Test: `test/mention.test.mjs`

- [ ] 写失败测试：带范围的页面上下文包含摘要和 `scopeId`；`guancli_card_preview` 用 `scopeId + cardId` 调用；范围与卡片不匹配时拒绝；编辑范围使用显式筛选而非默认筛选，未编辑范围继续 `--with-default-filters`。
- [ ] 改造工具参数，使 `profile/pageId` 仅服务旧调用，`scopeId` 与旧范围参数互斥；优先引导模型使用范围查询。
- [ ] 对编辑范围调用 `filtersForCard`，传给 `previewCard({ withDefaultFilters: false, filters })`；未编辑范围保持原调用。
- [ ] 运行 Host、mention、CLI 全部相关测试。

### Task 6: chip 摘要与范围编辑器

**Files:**
- Modify: `client.js`
- Modify: `package.json`
- Modify: `test/client.test.mjs`
- Modify: `locale/zh.json`
- Modify: `locale/en.json`

- [ ] 写失败 Client 测试：页面 `onPick` 生成含 `scopeId` 的引用和摘要标签；`openReference` 只接管页面；RPC 加载失败可见；枚举选择来自 Host；修改上游后重新获取下游选项并清除失效值；保存提交当前修订。
- [ ] 运行 `node --test test/client.test.mjs`，确认新断言失败。
- [ ] 在 package 的 Client 注入中声明 slots 和 UI primitives；在 `conversation.input.overlay` 注册编辑器，使用 `Modal`、原生 select/date input 和明确错误状态。
- [ ] 实现 `openReference(session, {ref})`，按 `scopeId` 调用 `scope.get`；按筛选器顺序串行加载枚举，避免同 profile 并发冲突。
- [ ] DS_ELEMENTS 使用真实 `{value,dvt}`；TIME_MACRO 使用页面 `content.options`；CALENDAR 使用日期/区间输入；树、文本匹配及无法安全换算的类型只读并说明。
- [ ] 上游变化后串行刷新枚举，保留下游仍合法值并移除失效值；保存调用 `scope.save`，成功后展示最新摘要和修订号。
- [ ] 保持现有八语言 key 一致；新增编辑器文案至少提供中英文，其余语言沿用现有完整字典约束。
- [ ] 运行 Client 测试并确认通过。

### Task 7: 文档与端到端验证

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] 更新引用语法、范围生命周期、支持的筛选器、只读限制和查询工具参数；版本升级并记录变更。
- [ ] 运行 `node --test test/*.test.mjs`，要求全部通过。
- [ ] 使用 `demo` 环境页面 `x261b055c06be45ad89eae3a` 验证真实枚举和联动；选择 `uc59965a8fd624a27a1d49c8` 卡片做只读预览，核对实际生效筛选。
- [ ] 在 DSH Desktop 实际加载插件，验证候选摘要、chip 点击、编辑保存、发送后 Agent 上下文和卡片预览；记录宿主不支持原位标签刷新这一边界。
- [ ] 运行 `git status --short`，删除验证产生的临时文件，不提交或覆盖用户已有改动。
