# HelixAgent 代码审计与修复方案

> 审计日期: 2026-07-08
> 审计范围: packages/opencode/src 全部已集成模块
> 方法: 逐模块对比文档声明 vs 实际代码实现
> 核心发现: 15+ 模块"只观测不干预"，真正的硬门控仅 2 个

---

## 一、审计方法论

对每个模块，对比以下三个维度：

1. **文档声明** — README / HELIX_AGENT_STATUS / DEVELOPMENT_PLAN / MAIN_CHAIN_ASSESSMENT 中声称的能力
2. **实际实现** — 代码中真正做了什么
3. **集成效果** — 是否真正影响主链路行为（注入 prompt / 阻止执行 / 改变路由）

---

## 二、问题清单

### 🔴 P0: 功能完全失效

#### 2.1 Checkpoint Writer — 死代码

**文档声明**: "会话状态快照，自动保存断点"

**实际代码**:

```
// packages/opencode/src/actor/spawn-ref.ts:16
export const spawnRef: { current: ActorInterface | undefined } = { current: undefined }

// packages/opencode/src/session/checkpoint.ts:22
if (!spawnRef.current) return  // ← 永远为 true，直接退出
```

**问题**: `spawnRef.current` 在整个代码库中从未被赋值。注释声称 "Actor.layer populates this module-local reference on initialisation"，但实际没有任何代码执行 `spawnRef.current = ...`。

**影响**: 整个 checkpoint 基础设施（prompt 文件 `checkpoint-writer.txt` 44 行、模板 `checkpoint-templates.ts` 114 行、路径工具 `checkpoint-paths.ts` 29 行）全部是死脚手架。

**修复方案**:

```
方案 A（推荐，30 行改动）:
  1. 删除 spawn-ref.ts
  2. 在 checkpoint.ts 中直接 yield* ActorSpawn.Service
  3. 解除循环依赖的真正原因是 ActorSpawn 不应该依赖 SessionCheckpoint
     → 检查 ActorSpawn.layer 的依赖链，确保不经过 SessionCheckpoint

方案 B（最小改动，5 行）:
  1. 在 app-runtime.ts 中 ActorSpawn.defaultLayer 初始化后添加:
     import { spawnRef } from "@/actor/spawn-ref"
     spawnRef.current = xxx  // 但这需要拿到 ActorSpawn 的实例
  → 此方案不可行，因为 Layer 不提供实例提取

推荐方案 A，具体改动:
  // checkpoint.ts
  import { ActorSpawn } from "@/actor/spawn"
  // defaultLayer 改为:
  export const defaultLayer = layer.pipe(
    Layer.provide(SessionStatus.defaultLayer),
    Layer.provide(ActorSpawn.defaultLayer),
  )
```

---

#### 2.2 Cardinal `stop` 级别名不副实

**文档声明**: "4 级风险控制: Block / Pause / Stop / Warn"

**实际代码** (`packages/opencode/src/session/processor.ts:438-472`):

```typescript
if (cardinalDecision?.level === "block") {
  // 真正阻止: rollback + failToolCall
  return
}
if (cardinalDecision?.level === "pause") {
  // 真正暂停: permission.ask() 请求用户确认
}
if (cardinalDecision?.level === "stop") {
  yield* Effect.logWarning("Cardinal stop", { ... })  // ← 只打日志！
}
if (cardinalDecision?.level === "warn") {
  yield* Effect.logWarning("Cardinal warn", { ... })  // ← 只打日志！
}
```

**问题**: `stop` 和 `warn` 行为完全一致——都是只打日志。文档声称的 4 级控制实际只有 2 级有效。

**严重性**: 高。`stop` 被 AlignmentRule 使用（alignmentAlerts >= 3 时返回 stop），这意味着"连续 3 次偏离目标"的后果只是打日志，不会中断执行。

**修复方案**:

```typescript
// processor.ts:459-464 改为:
if (cardinalDecision?.level === "stop") {
  yield* Effect.logWarning("Cardinal stop", { ... })
  // 真正停止: 中断当前工具执行，注入反馈到模型
  yield* failToolCall(value.id, new Error(`Cardinal stopped: ${cardinalDecision.reason}`))
  // 注入合成消息提示模型重新评估方向
  yield* sessions.patchMessage(msg.id, {
    parts: [...msg.parts, {
      type: "text",
      text: `[Cardinal Stop] ${cardinalDecision.reason}. ${cardinalDecision.suggestion}`
    }]
  })
  return
}
```

---

### 🟡 P1: 功能严重缩水

#### 2.3 GoalJudge — 纯正则，无 LLM 调用

**文档声明**: "独立 Judge 评估目标可达性"

**实际代码** (`packages/opencode/src/session/goal-judge.ts:38-48`):

```typescript
// Simple heuristic pre-check (no LLM call for now)
// In the future, this could call an LLM to judge goal achievability
const impossiblePatterns = [/impossible/, /cannot be done/, /not feasible/, /unreachable/]
```

**问题**: 代码**明确注释**这是临时占位。只匹配目标文本中是否包含 "impossible" 等词。例如用户目标如果是 "implement OAuth2"，GoalJudge 永远返回 `ok: true`。

**修复方案**:

```typescript
// 方案: 用 LLM 做可达性评估
const preflight = Effect.fn("GoalJudge.preflight")(function* (input: PreflightInput) {
  if (!input.condition) return { ok: true, reason: "No goal set" }

  // 保留正则快速路径
  const condition = input.condition.toLowerCase()
  for (const pattern of impossiblePatterns) {
    if (pattern.test(condition)) {
      return { ok: false, impossible: true, reason: `Goal appears impossible: ${input.condition}` }
    }
  }

  // 新增: LLM 评估
  const recentContext = (input.recentMessages ?? []).slice(-5).join("\n")
  const llm = yield* LLM.Service
  const verdict = yield* llm.evaluateGoal({
    goal: input.condition,
    context: recentContext,
  })
  return verdict
})
```

---

#### 2.4 Auto-Dream/Distill — 计时器重启归零

**文档声明**: "7 天/30 天间隔触发"

**实际代码** (`packages/opencode/src/session/auto-dream.ts:35`):

```typescript
const lastDreamTime = yield* Ref.make(0)  // 内存 Ref，进程重启即归零
```

**问题**: 每次进程重启后计时器重置为 0，导致**每次启动后第一次 prompt 都触发 dream**。这不是 bug 而是设计缺陷——`Ref` 是纯内存的。

**修复方案**:

```typescript
// 方案: 用 SQLite 持久化最后触发时间
// 1. 新建数据库表
// CREATE TABLE IF NOT EXISTS helix_timer (
//   key TEXT PRIMARY KEY,
//   last_triggered INTEGER NOT NULL
// );

// 2. auto-dream.ts 改为:
const shouldAutoDream = Effect.fn("AutoDream.shouldAutoDream")(function* (intervalDays = 7) {
  const db = yield* Database.Service
  const now = Date.now()
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000

  const last = yield* db.select().from(helixTimerTable)
    .where(eq(helixTimerTable.key, "auto_dream"))
    .get()
    .pipe(Effect.catch(() => Effect.succeed(null)))

  if (last && now - last.last_triggered < intervalMs) return false

  yield* db.insert(helixTimerTable)
    .values({ key: "auto_dream", last_triggered: now })
    .onConflictDoUpdate({ target: helixTimerTable.key, set: { last_triggered: now } })
    .pipe(Effect.catch(() => Effect.void))

  return true
})
```

---

#### 2.5 Metrics — 空函数 + 数据丢失

**文档声明**: "完整的性能追踪，ModelCall/ToolCall/AgentRequest 指标"

**实际代码** (`packages/opencode/src/metrics/metrics.ts:95-97`):

```typescript
const recordAgentRequest = Effect.fn("Metrics.recordAgentRequest")(function* (_metric: AgentRequestMetric) {
  // 暂存，后续可持久化
})
```

**问题**:
1. `recordAgentRequest` 是**空函数体**，从未记录任何数据
2. `modelCalls` 和 `toolCalls` 是纯内存 `Ref`，进程重启数据全丢
3. `ttft_ms` 永远不填，导致 `avgTTFTMs` 算出 `NaN`

**修复方案**:

```typescript
// 方案 A（推荐）: SQLite 持久化
// 1. 新建迁移: 20260708_add_metrics_tables.ts
// CREATE TABLE metrics_model_call (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   session_id TEXT NOT NULL,
//   finish_reason TEXT,
//   ttft_ms REAL,
//   latency_ms REAL,
//   cached_read_tokens INTEGER,
//   model_id TEXT,
//   provider TEXT,
//   total_tokens_in INTEGER,
//   total_tokens_out INTEGER,
//   created_at INTEGER NOT NULL
// );
// CREATE TABLE metrics_tool_call (...);
// CREATE TABLE metrics_agent_request (...);

// 2. metrics.ts 改为从 Database.Service 读写
// 3. recordAgentRequest 实现实际写入

// 方案 B（最小改动）: 至少修复空函数
// 将 AgentRequestMetric 数据写入 toolCalls Ref 中
// 并在 getSummary 中正确计算 TTFT（跳过 undefined 值）
```

---

#### 2.6 TokenTracker — 预算门控是理论性的

**文档声明**: "日预算追踪，预算超限自动中断"

**实际代码** (`packages/opencode/src/token/tracker.ts`):

- `getDailyBudget()` / `canAfford()` 定义了但从未在主链路调用
- `prompt.ts:1161` 只用 Scheduler 的常量 `DEFAULT_SCHEDULE_CONFIG.dailyBudget`
- `purpose` 字段永远不填，导致 `byPurpose` 统计永远为空

**修复方案**:

```typescript
// prompt.ts:1161 改为使用 TokenTracker:
const budgetCheck = yield* Option.match(maybeTokenTracker, {
  onNone: () => Effect.succeed(false),
  onSome: (tracker) => tracker.canAfford(estimatedNextTurnTokens)
})
if (budgetCheck) {
  yield* Effect.logWarning("TokenTracker: budget would be exceeded", { sessionID })
  break
}

// 同时在 processor.ts step-finish 时填写 purpose:
yield* tokenTracker.recordUsage({
  ...usage,
  purpose: determinePurpose(event)  // 根据当前上下文判断 purpose
})
```

---

#### 2.7 Scheduler — 调度策略从未在主链路生效

**文档声明**: "priority_first / round_robin / shortest_job_first 任务调度"

**实际代码** (`packages/opencode/src/scheduler/scheduler.ts`):

- `selectTasks` 函数定义了但主循环 `prompt.ts` 从未调用
- 仅在 `tool/todo.ts:73` 被 todo 工具内部使用
- `prompt.ts:1161` 只用 Scheduler 的**常量**做预算检查，不调用任何调度方法

**修复方案**:

```typescript
// prompt.ts 主循环中，在每次迭代开始前:
const pendingTasks = yield* taskRegistry.listActive(sessionID)
if (pendingTasks.length > 0) {
  const scheduleResult = yield* scheduler.selectTasks(pendingTasks, config)
  if (scheduleResult.selected.length === 0) {
    // 所有任务都超出预算，中断循环
    break
  }
  // 将选中任务的信息注入到系统提示中
  const taskContext = scheduleResult.selected
    .map(t => `- [${t.priority}] ${t.title}`)
    .join("\n")
  // 注入为合成消息...
}
```

---

### 🟢 P2: 功能可用但价值有限

#### 2.8 AlignmentGuard `detectFileDrift` — 死代码

**实际代码**: `observability/alignment-guard.ts:57` 定义了 `detectFileDrift`，但生产代码中从未调用。仅在测试文件中引用。

**修复方案**:

```typescript
// prompt.ts 循环结束后（与 detectRabbitHole 并列）:
const currentGoal = yield* goal.get(sessionID)
if (currentGoal) {
  const changedFiles = yield* ast.getChangedFiles(sessionID)
  const drifted = yield* alignment.detectFileDrift(currentGoal.condition, new Set(changedFiles))
  if (drifted.length > 0) {
    yield* alignment.sendAlert({
      sessionID,
      level: "warn",
      reason: `File drift detected: ${drifted.join(", ")} not related to goal`,
      suggestion: "Review if these changes are necessary",
      files: drifted,
      timestamp: Date.now(),
    })
  }
}
```

---

#### 2.9 Team 系统 — 只读不决策

**实际代码**: Team 数据写入数据库也被读出（`prompt.ts:1611`），但仅用于 `Effect.logInfo` 打印日志。不影响任何模型行为。

**修复方案**:

```typescript
// prompt.ts 中，将 team summary 注入到模型上下文:
const teamSummary = yield* team.formatTeamByOwnerSession(sessionID)
if (teamSummary) {
  const activeMembers = teamSummary.members.filter(m => m.status === "running")
  if (activeMembers.length > 0) {
    // 注入为合成文本 part
    yield* session.updatePart(msg.id, {
      type: "text",
      text: `[Team Context] ${activeMembers.length} active sub-agents: ${activeMembers.map(m => m.agent).join(", ")}`
    })
  }
}
```

---

#### 2.10 AST Blast Radius — 只记录不干预

**实际代码** (`prompt.ts:1554-1582`): AST 分析结果只写日志和 trace，不用于决策。

**修复方案**:

```typescript
// prompt.ts 中，将 blast radius 信息注入到模型上下文:
if (blastRadius.length > 5) {
  const highImpactFiles = blastRadius.filter(r => r.depth <= 1)
  yield* session.updatePart(msg.id, {
    type: "text",
    text: `[Impact Warning] Changes affect ${blastRadius.length} files. High-impact: ${highImpactFiles.map(r => r.file).join(", ")}`
  })
}
```

---

#### 2.11 Evolution — 配对逻辑过于天真

**实际代码** (`packages/opencode/src/evolution/evolution.ts`): DPO 配对逻辑是"同名 tool 的成功/失败两两配对"，不考虑输入上下文或因果关系。

**修复方案**:

```typescript
// 改进配对逻辑:
// 1. 检查 tool 输入参数的相似度（而非仅看名称）
// 2. 确保 success 和 failure 来自同一任务上下文
// 3. 添加最小间隔过滤（避免配对时间跨度太大的样本）
function isCompatiblePair(a: ToolCallMetric, b: ToolCallMetric): boolean {
  if (a.tool_name !== b.tool_name) return false
  if (Math.abs(a.timestamp - b.timestamp) > 30 * 60 * 1000) return false // 30分钟窗口
  // 添加输入相似度检查...
  return true
}
```

---

## 三、"只观测不干预"问题总览

以下 15+ 模块遵循同一模式：**在主链路中调用 → 记录数据 → 写日志/trace → 但不回注到 prompt 或阻止行为**。

| 模块 | 观测了什么 | 应该做什么 | 修复 ROI |
|------|-----------|-----------|----------|
| **Cardinal stop** | 偏离目标 | 应中断循环或注入反馈 | 高 |
| **AlignmentGuard** | shell 命令模式 | 应注入反馈或暂停 | 高 |
| **AST** | 文件变更影响范围 | 应注入 prompt 警告 | 中 |
| **Team** | 子智能体状态 | 应注入上下文 | 中 |
| **SpecReport** | 规格合规 | 应注入反馈 | 中 |
| **Evolution** | DPO 配对 | 改进配对逻辑 | 低 |
| **Metrics** | 性能指标 | 持久化 + 暴露 API | 低 |
| **TokenTracker** | Token 消耗 | 预算门控 | 中 |
| **Scheduler** | 任务优先级 | 真正调度任务 | 中 |
| **GoalJudge** | 目标可达性 | LLM 评估 | 高 |
| **Auto-Dream** | 计时器 | 持久化 | 中 |
| **Checkpoint** | 会话状态 | 真正保存 | 高 |
| **detectFileDrift** | 文件漂移 | 接入主链路 | 低 |
| **Blast Radius** | 影响范围 | 注入警告 | 中 |
| **Memory** | 跨会话知识 | 自动注入 prompt | 高 |

---

## 四、修复优先级路线图

### Phase 1: 修复完全失效的功能 (预计 1-2 天)

| 序号 | 改动 | 文件 | 行数估计 |
|------|------|------|----------|
| 1.1 | Checkpoint Writer 接通 | `checkpoint.ts`, `spawn-ref.ts` | ~30 行 |
| 1.2 | Cardinal stop 级别真正停止 | `processor.ts:459` | ~15 行 |
| 1.3 | Metrics recordAgentRequest 实现 | `metrics.ts:95` | ~10 行 |
| 1.4 | Metrics TTFT NaN 修复 | `metrics.ts` | ~5 行 |

### Phase 2: 修复缩水功能 (预计 2-3 天)

| 序号 | 改动 | 文件 | 行数估计 |
|------|------|------|----------|
| 2.1 | GoalJudge LLM 评估 | `goal-judge.ts` | ~40 行 |
| 2.2 | Auto-Dream 计时器持久化 | `auto-dream.ts` + 新迁移 | ~50 行 |
| 2.3 | TokenTracker 预算门控接入 | `prompt.ts:161` | ~20 行 |
| 2.4 | Scheduler selectTasks 接入主链路 | `prompt.ts` | ~30 行 |

### Phase 3: 观测→闭环 (预计 3-5 天)

| 序号 | 改动 | 文件 | 行数估计 |
|------|------|------|----------|
| 3.1 | AST blast radius → 注入 prompt | `prompt.ts:1554` | ~20 行 |
| 3.2 | Team summary → 注入上下文 | `prompt.ts:1608` | ~15 行 |
| 3.3 | detectFileDrift 接入主链路 | `prompt.ts` | ~20 行 |
| 3.4 | Evolution 配对逻辑改进 | `evolution.ts` | ~40 行 |
| 3.5 | Metrics/TokenTracker SQLite 持久化 | 新迁移 + 两个文件 | ~100 行 |

---

## 五、架构层面的根本问题

### 5.1 循环依赖导致功能失效

`Actor → SessionPrompt → SessionCheckpoint → Actor` 循环依赖用 `spawnRef` 延迟引用解决，但从未赋值。

**根因**: 用 `Ref` + 延迟引用打破循环是反模式。Effect 的 Layer 系统支持 `Layer.Fn` 延迟求值，应该用它代替手动 late-binding。

**建议**: 长期重构为 `LayerNode.group` + `LayerNode.compile`，让编译期检测循环依赖。

### 5.2 "观测层"与"控制层"脱节

系统有丰富的观测能力（Trace 22 调用点、AST、Metrics、AlignmentGuard），但控制回路只有 2 个硬门控。

**建议**: 建立统一的 "Observation → Decision → Action" 管线:

```
Observations (Trace/AST/Metrics/AlignmentGuard)
     ↓
Decision Engine (Cardinal + GoalJudge + Scheduler)
     ↓
Actions (block/pause/inject-feedback/break-loop)
```

### 5.3 内存存储 vs 持久化

以下模块使用内存 `Ref`，进程重启数据全丢：
- Metrics (`Ref<ModelCallMetric[]>`)
- TokenTracker (`Ref<TokenUsage[]>`)
- AutoDream (`Ref<number>` 计时器)
- Goal (`Map<string, Goal>`)
- ActorRegistry (`Ref<Map>`)
- TaskRegistry (`Ref<Map>`)

**建议**: 状态要么用 SQLite 持久化，要么明确标注为"仅当前会话有效"。

### 5.4 文档与代码脱节

`HELIX_AGENT_STATUS.md` 声称 "26 个服务可正常运行"，`DEVELOPMENT_PLAN.md` 声称各阶段 "✅ 已完成"，但审计发现大部分只是注册到了 AppLayer，并未真正影响行为。

**建议**: 将"完成"定义从"注册到 AppLayer"改为"主链路中有可验证的效果"。每个模块应有集成测试证明其影响行为。

---

## 六、验证方案

修复完成后，用以下方式验证：

1. **单元测试**: 每个修复点添加测试，验证行为变化
2. **集成测试**: 真实 LLM 运行完整 prompt → response 循环，验证:
   - Cardinal stop 确实中断循环
   - GoalJudge 对不可能目标返回 impossible
   - Auto-Dream 在间隔内不重复触发
   - TokenTracker 预算超限中断循环
3. **TUI 冒烟**: `cd packages/opencode && bun dev` 验证黑屏/渲染正常
4. **回归测试**: `cd packages/opencode && bun test` 确保不破坏现有功能

---

## 七、TUI 外化缺失分析

### 7.1 当前 TUI 实际可见的能力

用户在实际运行的 TUI 中**能看到**的模块（`packages/tui/src/feature-plugins/sidebar/builtins.ts` 注册）:

| 侧边栏插件 | order | 展示内容 | 数据源 |
|-----------|------|---------|--------|
| Context | 100 | Token 用量、上下文 %、费用、Judge  verdict | `session.goal.verdict` |
| Trace | 150 | Judge 评估结果（✓/✗ + reason） | `session.goal.verdict` |
| MCP | 200 | MCP 服务器连接状态 | `/mcp/status` |
| LSP | 300 | LSP 服务器状态 | `/lsp/status` |
| Todo | 400 | 待办事项列表 | `/session/:id/todo` |
| Files | 500 | 变更文件列表 | `/session/:id/diff` |
| Footer | — | VCS 分支信息 | `/vcs/get` |

Footer 指示器: Mode、Goal 摘要、Token 用量、Permission 计数、LSP/MCP 状态

**总计: 10 个能力完整可见，5 个部分可见**

### 7.2 完全不可见的能力（18 个）

以下模块在后端完整实现并运行，但 TUI 中**完全看不到**:

| 模块 | 后端状态 | API/SDK | TUI 组件 | 用户感知 |
|------|---------|---------|---------|---------|
| **Cardinal 决策** | ✅ 每次 tool-call 执行 | ❌ 无 endpoint | ⚠️ 旧位置有组件，未接入 | 🔴 完全不知 |
| **AlignmentGuard 告警** | ✅ shell 命令实时检测 | ❌ 无 endpoint | ⚠️ 旧位置有组件，未接入 | 🔴 完全不知 |
| **AST Blast Radius** | ✅ 循环后分析 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Evolution/DPO** | ✅ 会话结束导出 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Team 结构** | ✅ 子 agent 注册 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Scheduler** | ✅ 任务排序 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Inbox** | ✅ Actor 间消息 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **OpenSpec 合规** | ✅ 工具调用后检查 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **SpecReport** | ✅ 验证报告生成 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Checkpoint** | ✅ 会话快照 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Memory 搜索** | ✅ FTS+Vector | ❌ 无 endpoint | ⚠️ 旧位置有组件，未接入 | 🔴 完全不知 |
| **History 搜索** | ✅ FTS 跨会话 | ❌ 无 endpoint | ⚠️ 旧位置有组件，未接入 | 🔴 完全不知 |
| **Spec 生成流水线** | ✅ 7 agent 管线 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Workflow 状态** | ✅ DB 追踪 | ❌ 无 endpoint | ❌ 无 | 🔴 完全不知 |
| **Trace 执行树** | ✅ 22 调用点 | ❌ 无 endpoint | ⚠️ 旧位置有组件，未接入 | 🔴 完全不知 |
| **Metrics 详情** | ✅ 模型/工具指标 | ✅ 有 endpoint | ❌ 无 UI | 🔴 数据拉取但不展示 |
| **Token 细分** | ✅ by-model/by-purpose | ✅ 有 endpoint | ⚠️ 仅展示总量 | 🔴 细分数据不展示 |
| **Judge 详细结果** | ✅ 8 项检查 | ❌ 无 endpoint | ⚠️ 仅展示 verdict | 🔴 仅显示 ✓/✗ |

### 7.3 根因: 两套 TUI 代码库（完全独立的两套实现）

项目存在**两个完全独立的 TUI 实现**，它们之间没有共享组件:

| 位置 | 状态 | 入口 | 说明 |
|------|------|------|------|
| `packages/tui/src/` | ✅ **实际运行** | `packages/opencode/src/cli/tui/layer.ts` → `import("@opencode-ai/tui")` | 基于 opentui 的完整 TUI，7 个 sidebar 插件 |
| `packages/opencode/src/cli/cmd/tui/component/` | ❌ **废弃原型** | `packages/opencode/src/cli/cmd/tui.ts` → `import("../tui/layer")` → 同一入口 | 18 个组件，从未接入 |

**关键发现**: 两个入口最终都走 `packages/opencode/src/cli/tui/layer.ts`，都调用 `@opencode-ai/tui`（即 `packages/tui/src/`）。旧位置 `cli/cmd/tui/component/` 的 18 个组件**从未被 import**。

`integration-guide.ts` 是一份"集成指南"，告诉开发者如何把这些旧组件接入实际 TUI，但**从未被执行过**——所有代码都是注释。

旧位置有很多**设计好的组件**但从未迁移到实际运行的 TUI 中:

```
旧位置 (packages/opencode/src/cli/cmd/tui/component/):
  alert-cardinal.tsx     ← Cardinal 告警框（26 行，完整）
  alert-alignment.tsx    ← Alignment 告警框（35 行，完整）
  panel-trace.tsx        ← 执行树面板（86 行，完整）
  dialog-memory.tsx      ← Memory 搜索对话框（58 行，完整）
  dialog-history.tsx     ← History 搜索对话框（65 行，完整）
  panel-tasks.tsx        ← 任务面板（含优先级）
  panel-actors.tsx       ← Actor 面板（含状态）
  panel-agents.tsx       ← Agent 选择面板
  panel-skills.tsx       ← 技能面板
  footer-integrated.tsx  ← 集成 footer（含所有指示器）
  sidebar-panels.tsx     ← 集成侧边栏（含所有面板）
  footer-indicators.tsx  ← 独立指示器集合
  indicator-mode.tsx     ← Mode 指示器
  indicator-goal.tsx     ← Goal 指示器
  indicator-tokens.tsx   ← Token 指示器

新位置 (packages/tui/src/feature-plugins/sidebar/):
  context.tsx            ← 仅展示 token/cost/judge verdict
  trace.tsx              ← 仅展示 judge verdict（不展示执行树！）
  todo.tsx               ← 仅展示 todo 列表（不含优先级/状态）
  files.tsx              ← 变更文件
  lsp.tsx                ← LSP 状态
  mcp.tsx                ← MCP 状态
  footer.tsx             ← VCS 信息
```

### 7.4 缺失的关键数据管道

要让 TUI 展示这些能力，需要打通 4 层管道:

```
后端服务 → HTTP API/SDK → Event/Sync Store → UI 组件
```

当前每一层都有断点:

| 断层 | 说明 | 影响模块 |
|------|------|---------|
| **无 API endpoint** | 协议 groups 中未定义 | Cardinal, Alignment, AST, Evolution, Team, Scheduler, Inbox, OpenSpec, Checkpoint, Memory, History, Workflow |
| **无 Event 类型** | event-manifest 中未定义 | 同上（只有 todo.updated 和 session.status 有事件） |
| **Sync Store 无数据** | 即使有 API，sync store 不缓存 | 同上 |
| **无 UI 组件** | 实际 TUI 中无组件 | Metrics 详情, Token 细分, Judge 详细 |

### 7.5 修复方案: TUI 外化

#### Phase 1: 接入已有组件（预计 1-2 天）

旧位置已有很多可用的 UI 组件，只需迁移并接入:

| 序号 | 改动 | 源文件 | 目标 | 行数 |
|------|------|--------|------|------|
| 1.1 | Cardinal 告警组件接入 | `alert-cardinal.tsx` | sidebar plugin | ~20 行 |
| 1.2 | Alignment 告警组件接入 | `alert-alignment.tsx` | sidebar plugin | ~20 行 |
| 1.3 | Memory 搜索对话框接入 | `dialog-memory.tsx` | command palette | ~30 行 |
| 1.4 | History 搜索对话框接入 | `dialog-history.tsx` | command palette | ~30 行 |
| 1.5 | Trace 执行树面板接入 | `panel-trace.tsx` | 替换现有 trace.tsx | ~10 行 |

#### Phase 2: 打通数据管道（预计 2-3 天）

| 序号 | 改动 | 文件 | 说明 |
|------|------|------|------|
| 2.1 | Cardinal 事件类型 | `event-manifest.ts` | 添加 `cardinal.decision` 事件 |
| 2.2 | Alignment 事件类型 | `event-manifest.ts` | 添加 `alignment.alert` 事件 |
| 2.3 | Cardinal API | `protocol/groups/` | 添加 `/session/:id/cardinal` 端点 |
| 2.4 | Alignment API | `protocol/groups/` | 添加 `/session/:id/alignment` 端点 |
| 2.5 | Sync Store 扩展 | `sync.tsx` | 缓存 cardinal/alignment 数据 |
| 2.6 | 后端事件发射 | `processor.ts` | 在 Cardinal/Alignment 决策时 emit 事件 |

#### Phase 3: 新建 UI 组件（预计 3-5 天）

| 序号 | 改动 | 说明 |
|------|------|------|
| 3.1 | Metrics 侧边栏面板 | 展示模型调用次数、延迟、工具成功率 |
| 3.2 | Token 细分 Footer | 在 footer 展示 by-model token 分布 |
| 3.3 | AST Impact 面板 | 展示变更影响范围（blast radius） |
| 3.4 | OpenSpec 合规面板 | 展示需求覆盖状态 |
| 3.5 | Team/Actor 面板 | 展示多智能体协作状态 |
| 3.6 | Checkpoint 指示器 | 展示会话快照状态 |

### 7.6 最高 ROI 的 TUI 外化

以下 3 个能力后端已运行、数据已有、旧组件已有，只需接通管道:

| 能力 | 后端运行中 | 旧组件可用 | 需新建 | 用户价值 |
|------|-----------|-----------|--------|---------|
| **Cardinal 告警** | ✅ 每次 tool-call | ✅ alert-cardinal.tsx | 仅事件+API | 高: 用户应知道何时被阻止 |
| **Alignment 告警** | ✅ shell 实时检测 | ✅ alert-alignment.tsx | 仅事件+API | 高: 用户应知道 agent 跑偏 |
| **Memory 搜索** | ✅ FTS+Vector | ✅ dialog-memory.tsx | 仅 API | 中: 跨会话知识检索 |
| **History 搜索** | ✅ FTS | ✅ dialog-history.tsx | 仅 API | 中: 跨会话上下文 |
| **Trace 执行树** | ✅ 22 调用点 | ✅ panel-trace.tsx | 仅 API | 低: 调试用 |

**建议优先做 Cardinal + Alignment 告警**——这两个模块每次工具调用都在运行，但用户完全不知道它们的存在。只需:
1. 在 processor.ts 中 Cardinal/Alignment 决策时 emit 事件
2. 在 event-manifest 注册事件类型
3. 将旧组件迁移到新 TUI 位置并注册为 sidebar plugin

总计约 50 行代码，就能让用户看到这些"沉默的守卫"。

---

## 八、新建 TUI 入口方案（不影响现有 TUI）

### 8.1 目标

创建一个新命令 `opencode tui-enhanced`（或 `helix enhanced`），使用那 18 个废弃组件 + 现有 7 个插件，提供完整的 HelixAgent 能力可视化。**现有的 `bun dev` / `opencode` 命令完全不受影响。**

### 8.2 可行性结论: ✅ 完全可行，零风险

| 维度 | 评估 |
|------|------|
| 架构支持 | ✅ `pluginHost` 是设计的扩展点，`TuiPluginHost` 类型支持自定义实现 |
| 插件系统 | ✅ `api.slots.register()` 允许任意位置注册 sidebar_content 等 slot |
| 组件可用 | ✅ 18 个旧组件全是自包含的 SolidJS 组件，只需包装为 TuiPlugin |
| 数据可用 | ⚠️ 14/18 组件的数据已在 sync store；4 个需要新 API（trace/skills/cardinal/alignment） |
| 隔离性 | ✅ 新命令独立进程、独立 worker，与现有 TUI 完全隔离 |
| 风险 | 🟢 零——不修改任何现有文件 |

### 8.3 架构设计

```
现有入口（不变）:
  opencode → cli/cmd/tui.ts → cli/tui/layer.ts → @opencode-ai/tui → 7 个 sidebar 插件

新入口（新增）:
  opencode tui-enhanced → cli/cmd/tui-enhanced.ts → cli/tui/layer.ts → @opencode-ai/tui
    → 7 个原有 sidebar 插件（自动加载）
    + 18 个增强插件（自定义 pluginHost 注入）
```

**关键**: 两个入口共享 `cli/tui/layer.ts` 和 `@opencode-ai/tui`，区别仅在于 `pluginHost`。

### 8.4 实现步骤

#### Step 1: 插件注入机制（~25 行改动）

**问题**: `api.slots.register()` 在 `init()` 完成后会 throw（"slots.register is only available in plugin context"），不能手动调用。

**方案**: 通过 `setExtraInternalPlugins()` 在 `load()` 流程中注入额外插件，走正规的 `activatePluginEntry()` 流程（有 error isolation + 自动 cleanup）。

```typescript
// packages/opencode/src/plugin/tui/internal.ts
let extraPlugins: ExtraPlugin[] = []
export function setExtraInternalPlugins(plugins: ExtraPlugin[]) { extraPlugins = plugins }
export function getExtraInternalPlugins(): ExtraPlugin[] { return extraPlugins }
```

```typescript
// packages/opencode/src/plugin/tui/runtime.ts（load() 函数中）
for (const item of getExtraInternalPlugins()) {
  const entry = { ... source: "internal", id: `enhanced:${item.id}`, ... }
  addPluginEntry(next, { ... entry, plugin: item.plugin })
}
// 然后被 for (const plugin of next.plugins) { await activatePluginEntry(...) } 自动激活
```

#### Step 2: 创建自定义 PluginHost（~30 行）

```typescript
// packages/opencode/src/plugin/tui/enhanced-host.ts
export function createEnhancedTuiPluginHost(plugins: NamedPlugin[]): TuiPluginHost {
  setExtraInternalPlugins(plugins)
  return createLegacyTuiPluginHost()
}
```

#### Step 3: 包装 12 个组件为 TuiPlugin（~300 行）

每个组件的包装模式:

```typescript
// packages/opencode/src/plugin/tui/enhanced/sidebar-tasks.tsx
import type { TuiPlugin } from "@opencode-ai/plugin/tui"

export const tasksPlugin: TuiPlugin = async (api) => {
  api.slots.register({
    order: 600,  // 在现有插件之后
    slots: {
      sidebar_content(_ctx, props) {
        const tasks = createMemo(() => api.state.session.task(props.session_id))
        return <Show when={tasks().length>0}>
          <box>
            <text><b>Tasks</b></text>
            <For each={tasks()}>{(task) =>
              <text>{task.title} [{task.status}]</text>
            }</For>
          </box>
        </Show>
      },
    },
  })
}
```

18 个组件分类处理:

| 组件类型 | 处理方式 | 数据源 |
|---------|---------|--------|
| `panel-tasks` | 直接包装为 sidebar_content plugin | `api.state.session.task()` 已有 |
| `panel-actors` | 直接包装为 sidebar_content plugin | `api.state.session.actor()` 已有 |
| `panel-agents` | 直接包装为 sidebar_content plugin | `api.state.agent` 已有 |
| `panel-skills` | 直接包装为 sidebar_content plugin | 暂无 API，先 placeholder |
| `panel-trace` | 直接包装为 sidebar_content plugin | 暂无 API，先 placeholder |
| `footer-integrated` | 包装为 sidebar_footer plugin | 混合数据源 |
| `indicator-mode` | 集成到 footer | `api.state.session.get().agent` |
| `indicator-goal` | 集成到 footer | `api.state.session.goal()` |
| `indicator-tokens` | 集成到 footer | `api.state.session.get().cost` |
| `dialog-mode` | 注册为 command palette 条目 | — |
| `dialog-memory` | 注册为 command palette 条目 | 暂无 API，先 placeholder |
| `dialog-history` | 注册为 command palette 条目 | 暂无 API，先 placeholder |
| `alert-cardinal` | 注册为事件监听器 | 暂无 event，先 placeholder |
| `alert-alignment` | 注册为事件监听器 | 暂无 event，先 placeholder |
| `sidebar-panels` | 组合为单个大 panel | 混合数据源 |
| `sidebar-integrated` | 组合为单个大 panel | 混合数据源 |
| `session-layout` | 不接入（太大，替换整个布局） | — |
| `footer-indicators` | 集成到 footer | 混合数据源 |

#### Step 3: 创建新 CLI 命令（~80 行）

```typescript
// packages/opencode/src/cli/cmd/tui-enhanced.ts
// 复制 tui.ts 的结构，改两处:
// 1. command: "tui-enhanced [project]"
// 2. pluginHost: createEnhancedTuiPluginHost()
```

#### Step 4: 注册命令（~2 行）

```typescript
// packages/opencode/src/index.ts
import { TuiEnhancedCommand } from "./cli/cmd/tui-enhanced"
// ...
.command(TuiEnhancedCommand)
```

### 8.5 文件清单

```
新增文件（不影响现有功能）:
  packages/opencode/src/cli/cmd/tui-enhanced.ts              # 新 CLI 命令
  packages/opencode/src/plugin/tui/enhanced-host.ts          # 自定义 PluginHost
  packages/opencode/src/plugin/tui/enhanced/index.ts         # 导出所有增强插件
  packages/opencode/src/plugin/tui/enhanced/sidebar-tasks.tsx    # 任务面板
  packages/opencode/src/plugin/tui/enhanced/sidebar-actors.tsx   # 会话信息面板
  packages/opencode/src/plugin/tui/enhanced/sidebar-agents.tsx   # Agent 展示
  packages/opencode/src/plugin/tui/enhanced/sidebar-skills.tsx   # 技能面板（占位）
  packages/opencode/src/plugin/tui/enhanced/sidebar-trace.tsx    # 执行树（占位）
  packages/opencode/src/plugin/tui/enhanced/sidebar-metrics.tsx  # Token 用量详情
  packages/opencode/src/plugin/tui/enhanced/footer.tsx           # 增强 footer
  packages/opencode/src/plugin/tui/enhanced/dialog-mode.tsx      # Mode 切换对话框
  packages/opencode/src/plugin/tui/enhanced/dialog-memory.tsx    # Memory 搜索（占位）
  packages/opencode/src/plugin/tui/enhanced/dialog-history.tsx   # History 搜索（占位）
  packages/opencode/src/plugin/tui/enhanced/alert-cardinal.tsx   # Cardinal 告警
  packages/opencode/src/plugin/tui/enhanced/alert-alignment.tsx  # Alignment 告警

修改文件:
  packages/opencode/src/index.ts                     # +2 行: import + .command()
  packages/opencode/src/plugin/tui/internal.ts      # +10 行: 支持额外插件注入
  packages/opencode/src/plugin/tui/runtime.ts       # +15 行: load() 中注入额外插件
  packages/helix-tui/bin/helix                      # 改为自动检测全局 opencode
```

### 8.6 数据缺失的 4 个组件处理

| 组件 | 缺失数据 | 临时方案 | 长期方案 |
|------|---------|---------|---------|
| `panel-trace` | Trace API | 显示"Trace API 待接入"占位 | 添加 `/session/:id/trace` 端点 |
| `panel-skills` | Skills API | 显示"Skills API 待接入"占位 | 添加 `/session/:id/skills` 端点 |
| `alert-cardinal` | cardinal event | 注册事件监听器（暂不触发） | 在 processor.ts emit 事件 |
| `alert-alignment` | alignment event | 注册事件监听器（暂不触发） | 在 processor.ts emit 事件 |

### 8.7 启动方式

```bash
# ═══ 本地开发 ═══
# 原有 TUI（不变）
helix
# 或
bun dev

# 增强 TUI（新）
helix tui-enhanced
# 或
bun dev tui-enhanced

# ═══ 全局环境（发布后）═══
# 原有 TUI（不变）
helix

# 增强 TUI（新）
helix tui-enhanced
# 或
opencode tui-enhanced

# ═══ 带参数 ═══
helix tui-enhanced --model anthropic/claude-sonnet-4-20250514
helix tui-enhanced --agent build
helix tui-enhanced --continue
helix tui-enhanced ~/my-project
```

**helix 脚本自动检测**：
- 全局环境（有 `opencode` 命令）→ 调用 `opencode tui-enhanced`
- 本地开发（无全局 opencode）→ fallback 到 `bun dev tui-enhanced`

详见 `packages/helix-tui/bin/helix`。

### 8.8 渐进式增强路径

```
Phase 1（1 天）: 新入口 + 14 个有数据的组件 → 即可用
  → 用户立刻看到 Tasks/Agents/Footer/Dialog 等增强面板

Phase 2（1 天）: 接通 4 个缺失数据的组件
  → 添加 Trace/Skills API
  → 添加 Cardinal/Alignment 事件发射

Phase 3（可选）: 合并回主 TUI
  → 如果增强 TUI 稳定，将 enhanced-host 的内容合并到 builtins.ts
  → 或者保持两个入口，一个轻量一个完整
```

### 8.9 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| 新组件崩溃 | SolidJS ErrorBoundary 已包裹每个 slot，单个组件崩溃不影响整体 |
| 数据缺失 | 占位组件显示友好提示，不显示错误 |
| 启动变慢 | 18 个轻量组件增加 <50ms |
| 内存增加 | ~10-20MB（可接受） |
| 与现有 TUI 冲突 | 完全独立进程，互不影响 |
| 维护成本 | 增强插件独立于核心 TUI，可独立迭代 |
