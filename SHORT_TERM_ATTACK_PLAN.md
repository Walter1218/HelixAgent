# HelixAgent 短期攻坚方向：高质量任务交付保障体系

> 版本：v1.0
> 适用范围：未来 3-4 个月（约 13-14 周）
> 目标：补齐当前质量保障体系的主要短板，让 Cardinal、OpenSpec、Trace、Goal Judge 等模块从"注册集成"走向"真正生效"，形成可验证的交付质量闭环。

---

## 一、当前核心问题

HelixAgent 已搭建质量保障的"骨架"，但多数机制尚未有效运行：

| 模块 | 当前状态 | 主要问题 |
|------|---------|---------|
| **Cardinal** | 已接入 `processor.ts` | 调用时仅传入 `taskId/taskTitle/tokensUsed/totalBudget`，导致 5 条规则中 4 条基本无法触发 |
| **OpenSpecHook** | 已接入 `processor.ts` | 检测失败仅 `logWarning`，不阻止代码写入，也不反馈给模型修正 |
| **Trace** | 已接入 `processor.ts` | 事件存在内存 `Ref` 中，进程重启丢失，无法持久复盘 |
| **Goal** | 已接入 `prompt.ts` | `/goal` 设置未暴露，`judgeEnabled` 分支实际只是轮数计数（≥12 break） |
| **AlignmentGuard** | 已接入 `prompt.ts` | 主链路只调用 `detectRabbitHole`，`detectFileDrift`/`detectDistraction` 未使用 |
| **AST** | 已接入主链路 | 结果仅用于日志，未作为质量门禁；依赖图用正则解析 import，准确率有限 |
| **Workflow** | 已接入 `runLoop` 生命周期 | 只是 session 运行状态记录；`workflow` 工具默认关闭，且只是异步 shell 执行器 |
| **测试体系** | 已有存在性/集成测试 | 缺少端到端"agent 执行 → 自动验收"的行为测试 |

项目自身在 `DELIVERY_ASSURANCE_PLAN.md` 中也承认：文档与代码脱节、注册≠集成。当前已从"注册≠集成"演进为"集成≠有效"。

---

## 二、攻坚目标

用 4 个月左右，把 HelixAgent 从"模块多但生效少"提升到：

> **执行有监控、违规有阻断、交付有判定、过程可追溯。**

具体表现为：

1. agent 写入危险代码时能被实时阻断。
2. agent 偏离 spec 时能收到反馈并修正。
3. 每次任务执行的关键事件都被持久记录。
4. 任务完成度由 judge 模型判定，而非轮数硬截断。
5. 有自动化端到端测试验证上述能力。

---

## 三、分阶段攻坚计划

### Phase 1：Cardinal 风险管控生效（2 周）

**目标**：让 Cardinal 的 5 条规则在主链路中真正触发，危险/异常操作可被 block/pause/stop/warn。

#### 1.1 补齐 Cardinal 调用上下文

**文件**：`packages/opencode/src/session/processor.ts`

在 `case "tool-call"` 中，把当前调用：

```ts
const cardinalDecision = yield* cardinal.evaluate({
  taskId: ctx.sessionID,
  taskTitle: ctx.assistantMessage.agent,
  tokensUsed: ctx.assistantMessage.tokens?.input ?? 0,
  totalBudget: 1_000_000,
})
```

改造为通过 `buildCardinalContext` 构建完整上下文：

```ts
const cardinalContext = yield* buildCardinalContext(value.name ?? "unknown", input)
const cardinalDecision = yield* cardinal.evaluate(cardinalContext)
```

`buildCardinalContext` 至少提供：

| 字段 | 来源 |
|------|------|
| `taskId` | `ctx.sessionID` |
| `taskTitle` | `ctx.assistantMessage.agent` |
| `diff` | 当前 `snapshot.patch()` 结果 |
| `changedFiles` | `extractChangedFilesFromToolInput(toolName, input)` |
| `estimatedFiles` | 从 input.path/paths 估算 |
| `consecutiveFailures` | 当前 assistant message 下状态为 error 的 tool part 数量 |
| `alignmentAlerts` | `ctx.alignmentAlertCount`（需 Phase 1.4 累积） |
| `tokensUsed` / `totalBudget` | 当前 token 使用量与预算 |

#### 1.2 增强 Cardinal 规则实现

**文件**：`packages/opencode/src/session/cardinal.ts`

- `security`：扩展危险 pattern，覆盖 `eval`、`Function("...")`、`child_process`、`rm -rf`、`DROP TABLE`、`DELETE FROM`、常见密钥格式等。
- `excessive_changes`：当 `changedFiles.length > estimatedFiles * 2` 时触发 pause。
- `consecutiveFailures`：连续失败 ≥3 次触发 pause。
- `alignment`：当 `alignmentAlerts >= 3` 时触发 stop。
- `token_limit`：保持当前逻辑，threshold 为 budget 的 20%。

#### 1.3 统一 Cardinal 决策处理

**文件**：`packages/opencode/src/session/processor.ts`

为 `block / stop / pause / warn` 分别实现行为：

| 级别 | 行为 |
|------|------|
| `block` | `failToolCall`，写入类工具不会生效，并记录 trace |
| `stop` | 设置 `ctx.shouldBreak = true`，终止当前 runLoop |
| `pause` | 弹出 permission 确认，用户/配置决定是否继续 |
| `warn` | 记录日志和 trace，不阻断 |

#### 1.4 让 AlignmentGuard 结果可累积

**文件**：`packages/opencode/src/session/prompt.ts`

在 runLoop 末尾调用 `detectFileDrift` 和 `detectDistraction`，把异常次数写入 session 状态，供 Cardinal `alignment` 规则读取。

#### 1.5 测试

**新增**：`packages/opencode/test/session/cardinal-integration.test.ts`

- agent 写入 `eval(...)` → 最终被阻断。
- 小需求改大量文件 → Cardinal pause 触发。
- 同一工具连续失败 3 次 → Cardinal pause 触发。

#### 验收标准
- [ ] Cardinal 调用时 5 个字段全部传齐。
- [ ] security / excessive_changes / consecutiveFailures / alignment / token_limit 至少 4 条能在主链路触发。
- [ ] block / stop / pause / warn 四种级别行为正确。
- [ ] 新增 3 个集成测试通过。
- [ ] `bun typecheck` 通过。

---

### Phase 2：OpenSpec 成为真正的验收门禁（2 周）

**目标**：spec 不合规时，代码不会悄无声息地写入；模型能收到反馈并修正。

#### 2.1 实现 `ast` verification 类型

**文件**：`packages/opencode/src/openspec/spec.ts`

当前 `ast` 类型直接 fallback 到 manual。改造为：

```ts
if (req.verification.type === "ast") {
  return yield* checkAstRequirement(req)
}
```

`checkAstRequirement` 解析 `target` 为 `file:pattern`，读取文件内容后用正则/AST 检查 pattern 是否存在。

#### 2.2 tool-call 阶段做 pre-check

**文件**：`packages/opencode/src/session/processor.ts`

在 Cardinal 之后，对 write/edit/apply_patch/multiedit 工具调用 OpenSpec pre-check。结果写入 tool part metadata，供模型感知。

#### 2.3 tool-result 阶段反馈给模型

**文件**：`packages/opencode/src/session/processor.ts`

当前不合规只 `logWarning`。改造为：当 `!result.allApproved` 时，向 session 插入一条 text part，列出缺失要求，要求模型修正。

#### 2.4 支持按任务描述匹配 spec

**文件**：`packages/opencode/src/openspec/hook.ts`

`checkAfterToolCall` 除了按文件路径匹配，还应按工具名、任务描述关键词匹配相关 spec。

#### 2.5 确保 CLI spec 命令可用

**文件**：`packages/opencode/src/cli/cmd/spec.ts`

- `opencode spec list`
- `opencode spec show <path>`
- `opencode spec verify <path>`

#### 2.6 测试

**新增**：`packages/opencode/test/openspec/integration.test.ts`

- 带 spec 的项目，agent 实现功能但缺少某个 requirement → 模型收到反馈。
- `ast` verification 检查函数存在性 → 返回正确结果。

#### 验收标准
- [ ] `ast` verification 可用。
- [ ] tool-call 有 pre-check，tool-result 有反馈。
- [ ] spec 不合规时模型能收到缺失要求。
- [ ] CLI spec 命令可用。
- [ ] 新增 2 个集成测试通过。
- [ ] `bun typecheck` 通过。

---

### Phase 3：Trace 持久化与可观测性（2 周）

**目标**：trace 数据进程重启不丢失，支持历史查询、TUI 展示、Evolution 导出。

#### 3.1 新增数据库表

**新增**：
- `packages/core/src/trace/trace.sql.ts`
- `packages/core/src/database/migration/20260707_add_trace_event.ts`

表结构：

```sql
CREATE TABLE trace_event (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  duration INTEGER,
  metadata TEXT,
  timestamp INTEGER NOT NULL
);
```

#### 3.2 Trace service 改为数据库实现

**文件**：`packages/opencode/src/trace/trace.ts`

把内存 `Ref.make<TraceEvent[]>([])` 替换为 SQLite 读写。`emit` 插入，`getTraces` 按 `session_id` 查询并按时间排序。

#### 3.3 补齐 trace emit 的 duration

**文件**：`packages/opencode/src/session/processor.ts`

当前 `tool-call` 时 emit pending 状态，没有 duration。改造为：

- `tool-call`：emit `pending`（duration 为 undefined）。
- `tool-result` / `tool-error`：emit `success` / `failed`，并计算 duration。

#### 3.4 TUI TracePanel 读数据库

**文件**：`packages/opencode/src/cli/cmd/tui/component/panel-trace.tsx`

从 Trace service 查询历史事件，支持按 session 展示和刷新。

#### 3.5 测试

**新增**：`packages/opencode/test/trace/persistence.test.ts`

- emit 事件 → dispose runtime → 新 runtime 仍能读到。

#### 验收标准
- [ ] TraceEvent 表和 migration 存在。
- [ ] Trace 数据写入 SQLite。
- [ ] 所有 trace emit 带 duration。
- [ ] TUI TracePanel 展示历史 trace。
- [ ] Evolution 基于持久化 trace 导出 DPO pairs。
- [ ] 新增持久化测试通过。
- [ ] `bun typecheck` 通过。

---

### Phase 4：Goal Judge 模型落地（2 周）

**目标**：把 Goal 从轮数计数器升级为真正的完成度 judge。

#### 4.1 暴露 `/goal` 设置入口

**文件**：`packages/opencode/src/session/prompt.ts`、命令注册、TUI

- CLI 支持 `/goal <condition>` 调用 `goal.set()`。
- HTTP API 支持设置 goal。
- TUI GoalIndicator 可展示和设置目标。

#### 4.2 实现 judge 模型调用

**新增**：`packages/opencode/src/session/goal-judge.ts`

```ts
export interface Verdict {
  ok: boolean
  impossible: boolean
  reason: string
}

export const judgeGoalCompletion = Effect.fn("Goal.judgeGoalCompletion")(...)
```

输入：session 近期 messages、变更文件、测试结果。
输出：`{ ok, impossible, reason }`。

#### 4.3 接入 runLoop

**文件**：`packages/opencode/src/session/prompt.ts`

替换当前的 `bumpReact >= 12` 逻辑：

- `ok`：清空 goal，结束 runLoop。
- `impossible`：清空 goal，结束 runLoop，输出原因。
- 其他：把 `reason` 注入上下文，继续执行。

#### 4.4 配置 judge 模型

在 `opencode.json` 支持：

```json
{
  "judge": {
    "model": "kimi-for-coding/k2p7",
    "maxTokens": 4096
  }
}
```

#### 4.5 测试

**新增**：`packages/opencode/test/session/goal-judge.test.ts`

- mock judge 返回 ok → runLoop 结束。
- mock judge 返回 impossible → runLoop 结束并输出原因。
- mock judge 返回继续 → 上下文包含 reason。

#### 验收标准
- [ ] `/goal` 可设置目标。
- [ ] judge 模型实际被调用。
- [ ] ok / impossible / 继续 三种分支正确。
- [ ] judge 模型可配置。
- [ ] 新增 2 个测试通过。
- [ ] `bun typecheck` 通过。

---

### Phase 5：端到端质量验收测试体系（2 周）

**目标**：建立可自动验证的质量门禁场景测试。

#### 5.1 测试夹具

**新增**：`packages/opencode/test/e2e/quality-gates/fixture.ts`

封装：
- 创建临时项目（可带 spec、初始代码）。
- mock LLM server 驱动 agent。
- 运行任务。
- 验证最终文件系统状态和 trace 事件。

#### 5.2 场景测试

**新增目录**：`packages/opencode/test/e2e/quality-gates/`

| 文件 | 场景 | 验证 |
|------|------|------|
| `security-block.test.ts` | 要求写入 `eval(...)` | Cardinal 阻断，最终文件无 eval |
| `excessive-changes.test.ts` | 小需求改多文件 | Cardinal pause 触发 |
| `consecutive-failures.test.ts` | 同一命令反复失败 | Cardinal pause 触发 |
| `spec-compliance.test.ts` | 带 OpenSpec 的功能开发 | 不合规时模型收到反馈并修正 |
| `file-drift.test.ts` | agent 改无关文件 | AlignmentGuard 检测并反馈 |
| `goal-completion.test.ts` | 明确目标的任务 | Goal judge 判定 ok 结束 |

#### 5.3 CI 集成

在 `packages/opencode/package.json` 增加：

```json
{
  "scripts": {
    "test:quality-gates": "bun test test/e2e/quality-gates"
  }
}
```

#### 验收标准
- [ ] 至少 6 个质量验收场景测试。
- [ ] 测试在 CI 稳定通过。
- [ ] 新增代码破坏质量门禁时测试失败。
- [ ] `bun typecheck` 通过。

---

### Phase 6：AST 语义升级（可选，3-4 周）

**目标**：用真实 AST parser 替代正则解析，提供准确的依赖影响分析。

#### 6.1 接入真实 parser

推荐 oxc，已有相关生态。替代 `ast.ts` 中的正则 import 提取。

#### 6.2 语义依赖图

实现 `buildDependencyGraphWithOxc`：
- 准确识别 import/export
- 识别函数、类、导出项
- 建立 file -> dependents 图

#### 6.3 语义变化检测

- 公共函数签名变化 → 找出调用方。
- 导出删除 → 找出 importer。
- 新增未使用代码 → warn。

#### 6.4 反馈给 Cardinal

把 AST 分析结果作为 Cardinal 输入，例如：
- 修改公共 API 但没改测试 → pause。
- 删除被依赖的导出 → block。

#### 验收标准
- [ ] AST 用真实 parser。
- [ ] 能检测函数签名变化和导出删除。
- [ ] AST 结果可反馈给 Cardinal。
- [ ] 新增 3 个测试通过。
- [ ] `bun typecheck` 通过。

---

## 四、阶段依赖与推荐执行顺序

```
Phase 1 (Cardinal) ─┐
                    ├──→ Phase 2 (OpenSpec) ──→ Phase 4 (Goal Judge)
Phase 3 (Trace) ────┘              │
                                   ↓
                         Phase 5 (质量验收测试)
                                   │
                                   ↓
                         Phase 6 (AST 语义升级，可选)
```

**推荐启动顺序**：

1. **Phase 1 + Phase 3 并行启动**。
   - Cardinal 解决最高频的安全/异常问题。
   - Trace 是其他阶段的基础设施。
2. **Phase 2** 补齐 spec 驱动开发闭环。
3. **Phase 4** 让目标驱动判定落地。
4. **Phase 5** 固化验收能力。
5. **Phase 6** 视资源决定是否投入。

---

## 五、各阶段解决的核心问题对照

| 阶段 | 解决的核心问题 |
|------|---------------|
| Phase 1 | 危险操作无法被实时阻断；异常执行状态无法感知 |
| Phase 2 | agent 不按 spec 交付；代码污染无法回环修正 |
| Phase 3 | 执行过程不可追溯；无法复盘和持续改进 |
| Phase 4 | 任务完成度无法判定；容易提前结束或无限循环 |
| Phase 5 | 质量保障能力缺乏自动化验证；回归风险高 |
| Phase 6 | 变更影响分析不准确；容易误改依赖 |

---

## 六、不能解决的问题（需管理预期）

即使完成以上阶段，以下问题仍需要持续投入：

1. **LLM 本身的幻觉和理解偏差**：只能更早发现，无法根除。
2. **业务语义正确性**：spec 能验证结构，但无法验证业务逻辑是否真正满足用户真实意图。
3. **spec/verification 写得不全**：agent 可能绕过不完整的验收条件。
4. **大规模多 agent 协作一致性**：Team/Workflow 当前仍偏浅，需要额外设计。

---

## 七、关键风险与应对

| 风险 | 应对 |
|------|------|
| Cardinal 误报导致正常操作被阻断 | 先做 warn 模式灰度，确认误报率后再启用 block |
| OpenSpec 增加每次 tool 调用延迟 | 异步执行 + 缓存 spec 解析结果 |
| Trace 数据库写入量过大 | 采样率配置 + 自动清理旧 trace |
| Goal Judge 增加 token 成本 | 支持配置 cheap model，默认关闭 |
| 端到端测试不稳定 | 用 mock LLM server，避免真实模型抖动 |

---

## 八、验收总纲

全部阶段完成后，HelixAgent 应具备以下能力：

- [ ] 写入危险代码时被阻断或要求确认。
- [ ] 偏离 spec 时模型收到反馈并修正。
- [ ] 关键执行事件持久化，可跨进程查询。
- [ ] 目标完成度由 judge 模型判定。
- [ ] 有 6+ 个端到端场景测试持续验证。
- [ ] 所有新增代码 `bun typecheck` 通过。

---

## 九、下一步建议

1. 团队确认本规划优先级。
2. 指定 Phase 1 和 Phase 3 的负责人，立即启动。
3. 为每个阶段创建独立分支（按 `AGENTS.md` 命名规范）。
4. 每阶段完成后跑一次 `test:quality-gates`（Phase 5 完成后）。

---

*文档结束*
