# 死代码激活规划

> 将 HelixAgent 中已设计但未集成的死代码模块接入主链路
> 创建日期: 2026-06-29
> 最后更新: 2026-07-01
> **状态: Phase 1-6 代码集成已全部完成 (src/ typecheck 零错误)**

## 执行状态

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1: Trace + Metrics + TokenTracker | ✅ 已完成 | Service + Layer + 主链路调用 + **查询接口已补充** |
| Phase 2: Cardinal + AlignmentGuard + Shell Safety | ✅ 已完成 | Service + Layer + 主链路调用 |
| Phase 3: Goal + Actor + Task + ModeRegistry | ✅ 已完成 | Service + Layer + 主链路调用 + **inferMode 已补充** |
| Phase 4: Auto-Dream + Checkpoint Writer | ✅ 已完成 | Service + Layer + 主链路调用 |
| Phase 5: 6个死工具注册 | ✅ 已完成 | Tool.define + registry 注册 |
| Phase 6: Evolution + Scheduler + Team + AST + Workflow | ✅ 已完成 | Service + Layer + 主链路调用（Scheduler 仅 budget 检查） |

### 待处理

1. **30个测试文件类型错误**：新 Service 的 Layer 依赖未在测试中提供
2. **新增能力开发**：详见 `DEVELOPMENT_PLAN.md`（Memory Vector Store、History、Inbox、Judge+Max）

### 已补充的底层 API（2026-07-01）

| Service | 新增接口 | 用途 |
|---------|---------|------|
| Metrics | `getModelCalls(sessionID)`, `getToolCalls(sessionID)`, `getSummary(sessionID)` | TUI 外化 |
| TokenTracker | `getSessionUsage(sessionID)`, `getSessionStats(sessionID)` | TUI 外化 |
| ModeRegistry | `inferMode(agent)` | TUI 外化 |

### 已完成的 TUI 外化（2026-07-01）

| 组件 | 位置 | 数据来源 |
|------|------|---------|
| Token 指示器 | footer | TokenTracker.getSessionStats |
| Mode 指示器 | footer | session.agent + ModeRegistry.inferMode |
| Goal 指示器 | footer | Goal.get |
| Task 面板 | sidebar | TaskRegistry.listBySession |
| Actor 面板 | sidebar | ActorRegistry.listBySession |

---

## 总览

共 **6 个 Phase**，按依赖关系排序，每个 Phase 可独立验证。

```
Phase 1: Trace + Metrics + Token Tracker
    │
    ├──→ Phase 2: Cardinal + AlignmentGuard + Shell Safety
    │        │
    │        └──→ Phase 3: Goal + Actor + Task + ModeRegistry
    │                 │
    │                 └──→ Phase 4: Auto-Dream + Checkpoint Writer
    │
    ├──→ Phase 5: 6个死工具注册 (独立，可并行)
    │
    └──→ Phase 6: Evolution + Scheduler + Team + AST + Workflow
```

### 每个 Phase 的工作内容

每个 Phase 需要完成三层工作：

1. **Service 定义** — 将纯函数/接口转为 Effect Service（`Interface` → `Service` class → `layer` → `defaultLayer`）
2. **Layer 注册** — 在 `src/effect/app-runtime.ts` 的 `AppLayer` 中注册 `defaultLayer`
3. **主链路调用** — 在 `processor.ts`、`prompt.ts`、`shell.ts`、`registry.ts` 等主链路文件中实际调用 Service

仅完成前两层（注册）不等于集成。必须在主链路中添加调用点，组件才能真正工作。

### 预估工时

| Phase | 工时 | 复杂度 |
|-------|------|--------|
| 1 | 2 天 | 中 |
| 2 | 2 天 | 中 |
| 3 | 3 天 | 高 |
| 4 | 2 天 | 中 |
| 5 | 1 天 | 低 |
| 6 | 3 天 | 高 |
| **总计** | **13 天** | |

---

## Phase 1: 基础层集成（Trace + Metrics + Token Tracker）

**目标**：建立可观测性基础，为后续模块提供数据采集能力。

**依赖关系**：
```
Trace ← Metrics ← Token Tracker
         ↓
    (为 Phase 2-6 提供指标数据)
```

### 1.1 转换为 Effect Service

当前这三个模块只有纯函数/接口定义，需要添加 Effect Service。

**文件**: `src/trace/trace.ts`

在现有接口和工具函数之后、`export * as Trace` 之前添加：

```ts
import { Effect, Ref, Context, Layer } from "effect"

export interface Interface {
  readonly emit: (event: Omit<TraceEvent, "timestamp">) => Effect.Effect<void>
  readonly getTraces: (sessionID: string) => Effect.Effect<TraceEvent[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Trace") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* Ref.make<TraceEvent[]>([])
    const emit = Effect.fn("Trace.emit")(function* (event) {
      yield* Ref.update(events, (arr) => [...arr.slice(-9999), { ...event, timestamp: Date.now() }])
    })
    const getTraces = Effect.fn("Trace.getTraces")(function* (sessionID) {
      return (yield* Ref.get(events)).filter((e) => e.metadata?.sessionID === sessionID)
    })
    return Service.of({ emit, getTraces })
  })
)

export const defaultLayer = layer
```

**文件**: `src/metrics/metrics.ts`

同样模式。暴露 `recordModelCall`、`recordToolCall`、`recordAgentRequest`。内部持有 `Ref<ModelCallMetric[]>` 和 `Ref<ToolCallMetric[]>`。

**文件**: `src/token/tracker.ts`

同样模式。暴露 `recordUsage`、`getDailyBudget`、`canAfford`。内部持有 `Ref<TokenUsage[]>`，`getDailyBudget` 按当日日期聚合计算。

### 1.2 注册 Layer

**文件**: `src/effect/app-runtime.ts`

在 `Layer.mergeAll(...)` 中添加：

```ts
import { Trace } from "@/trace/trace"
import { Metrics } from "@/metrics/metrics"
import { TokenTracker } from "@/token/tracker"

export const AppLayer = Layer.mergeAll(
  // ... 现有 layer ...
  Trace.defaultLayer,
  Metrics.defaultLayer,
  TokenTracker.defaultLayer,
)
```

### 1.3 主链路调用 — processor.ts

**文件**: `src/session/processor.ts`

**依赖注入**（`Layer.effect` 内，约第83行）添加：

```ts
const trace = yield* Trace.Service
const metrics = yield* Metrics.Service
```

**`case "tool-call"` 处**（约第329行），在 `yield* ensureToolCall(value)` 和 `yield* updateToolCall(...)` 之后添加 Trace 埋点：

```ts
yield* trace.emit({
  id: `tool-${value.id}`,
  parentId: `session-${ctx.sessionID}`,
  type: "action",
  name: `tool.${value.name}`,
  status: "pending",
  metadata: { sessionID: ctx.sessionID, toolName: value.name, input },
})
```

**`case "tool-result"` 处**（约第381行），在 `yield* completeToolCall(value.id, output)` 之后添加：

```ts
yield* trace.emit({
  id: `tool-${value.id}`,
  type: "action",
  name: `tool.${value.name ?? "unknown"}`,
  status: "success",
  metadata: { sessionID: ctx.sessionID },
})
yield* metrics.recordToolCall({
  sessionID: ctx.sessionID,
  tool_name: value.name ?? "unknown",
  input_bytes: JSON.stringify(output.output).length,
  output_bytes: output.output.length,
  tool_call_id: value.id,
  tool_call_status: "success",
})
```

**`case "tool-error"` 处**（约第414行），在 `yield* failToolCall` 之后添加类似的 trace + metrics 调用（status 为 `"failed"`）。

**`case "step-finish"` 处**（约第433行），在 usage 计算之后添加：

```ts
yield* metrics.recordModelCall({
  sessionID: ctx.sessionID,
  finish_reason: value.reason,
  latency_ms: Date.now() - (ctx.assistantMessage.time.created ?? Date.now()),
  cached_read_tokens: usage.tokens.cache.read,
  model_id: ctx.model.id,
  provider: ctx.model.providerID,
  total_tokens_in: usage.tokens.input,
  total_tokens_out: usage.tokens.output,
})
```

### 1.4 主链路调用 — processor.ts step-finish 中记录 Token

**文件**: `src/session/processor.ts`

**依赖注入**添加（同 1.3）：

```ts
const tokenTracker = yield* TokenTracker.Service
```

**`case "step-finish"` 处**（约第433行），在 usage 计算之后、`yield* session.updateMessage` 之后添加：

```ts
yield* tokenTracker.recordUsage({
  session_id: ctx.sessionID,
  model_id: ctx.model.id,
  provider_id: ctx.model.providerID,
  input_tokens: usage.tokens.input,
  output_tokens: usage.tokens.output,
})
```

注：llm.ts 不直接处理 step-finish 事件，它只发出 LLMEvent 流。所有事件处理（包括 token 记录）都在 processor.ts 中完成。

### 1.5 验证

```bash
cd packages/opencode && bun typecheck
```

---

## Phase 2: 安全层集成（Cardinal + AlignmentGuard + Shell Safety）

**目标**：在工具执行前进行风险检测和偏移告警。

**依赖关系**：
```
Phase 1 (Trace)
    ↓
Cardinal + AlignmentGuard
    ↓
Shell Safety (tokenize + wrap)
```

### 2.1 转换为 Effect Service

**文件**: `src/session/cardinal.ts`

在现有函数之后添加 Service。内部依赖 `Trace.Service` 用于记录决策：

```ts
export interface Interface {
  readonly evaluate: (context: ExecutionContext) => Effect.Effect<CardinalDecision | null>
  readonly getRules: () => Effect.Effect<CardinalRule[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Cardinal") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const trace = yield* Trace.Service
    const evaluate = Effect.fn("Cardinal.evaluate")(function* (context) {
      const decision = evaluateCardinal(context)
      if (decision) {
        yield* trace.emit({
          id: `cardinal-${Date.now()}`,
          type: "decision",
          name: "cardinal.evaluate",
          status: decision.level === "block" ? "failed" : "success",
          metadata: { decision },
        })
      }
      return decision
    })
    return Service.of({ evaluate, getRules: () => Effect.succeed(DEFAULT_RULES) })
  })
)

export const defaultLayer = layer
```

**文件**: `src/observability/alignment-guard.ts`

同样模式。包装 `detectRabbitHole`、`detectDistraction`、`detectFileDrift`。

### 2.2 注册 Layer

**文件**: `src/effect/app-runtime.ts`

```ts
import { Cardinal } from "@/session/cardinal"
import { AlignmentGuard } from "@/observability/alignment-guard"

// 在 AppLayer 中添加：
Cardinal.defaultLayer,
AlignmentGuard.defaultLayer,
```

### 2.3 主链路调用 — processor.ts tool-call 前

**文件**: `src/session/processor.ts`

**依赖注入**添加：

```ts
const cardinal = yield* Cardinal.Service
```

**`case "tool-call"` 处**（约第329行），在 `yield* ensureToolCall(value)` 之后、trace.emit 之后添加：

```ts
const cardinalDecision = yield* cardinal.evaluate({
  taskId: ctx.sessionID,
  taskTitle: ctx.assistantMessage.agent,
  diff: undefined, // 从 snapshot 获取
  changedFiles: undefined,
  tokensUsed: ctx.assistantMessage.tokens?.input ?? 0,
  totalBudget: 1_000_000,
})
if (cardinalDecision?.level === "block") {
  yield* failToolCall(value.id, new Error(`Cardinal blocked: ${cardinalDecision.reason}`))
  return
}
if (cardinalDecision?.level === "pause") {
  const agent = yield* agents.get(ctx.assistantMessage.agent)
  yield* permission.ask({
    permission: "cardinal",
    patterns: [cardinalDecision.reason],
    sessionID: ctx.sessionID,
    metadata: { decision: cardinalDecision },
    always: ["*"],
    ruleset: agent.permission,
  })
}
```

### 2.4 主链路调用 — prompt.ts runLoop 中检测偏移

**文件**: `src/session/prompt.ts`

**依赖注入**添加：

```ts
const alignment = yield* AlignmentGuard.Service
```

**runLoop 每步结束后**（约第1333行 `if (outcome === "break") break` 之前）添加：

```ts
const recentCommands = msgs
  .slice(-10)
  .flatMap((m) => m.parts.filter((p) => p.type === "tool" && p.tool === "shell"))
  .map((p) => (p.state as any).input?.command ?? "")
const isRabbitHole = yield* alignment.detectRabbitHole(recentCommands)
if (isRabbitHole) {
  yield* Effect.logWarning("alignment: rabbit hole detected", { "session.id": sessionID })
}
```

### 2.5 主链路调用 — shell.ts tokenize 检查

**文件**: `src/tool/shell.ts`

在 `execute` 函数开头（约第610行 `const instanceCtx = yield* InstanceState.context` 之后）添加：

```ts
import { tokenize } from "./shell-tokenize"

const parsed = tokenize(params.command)
if (!parsed.ok) {
  return yield* Effect.fail(new Error(`Shell parse error: ${parsed.error.detail}`))
}
```

### 2.6 验证

```bash
cd packages/opencode && bun typecheck
cd packages/opencode && bun test test/phase2/phase2.test.ts
```

---

## Phase 3: 控制层集成（Goal + Actor + Task + ModeRegistry）

**目标**：实现目标驱动执行、Actor 并发、任务追踪、模式管理。

**依赖关系**：
```
Phase 1 (Trace) + Phase 2 (Cardinal)
    ↓
Goal + ModeRegistry
    ↓
Actor + Task
```

### 3.1 已有 Service 定义，仅需注册 Layer

以下模块已有完整的 Service + Layer 定义，无需修改模块本身：

- `src/session/goal.ts` — `Goal.Service` + `Goal.defaultLayer`
- `src/actor/registry.ts` — `ActorRegistry.Service` + `ActorRegistry.defaultLayer`
- `src/task/registry.ts` — `TaskRegistry.Service` + `TaskRegistry.defaultLayer`
- `src/session/mode-registry.ts` — `ModeRegistry.Service` + `ModeRegistry.defaultLayer`
- `src/actor/spawn.ts` — `ActorSpawn.Service` + `ActorSpawn.defaultLayer`
- `src/actor/waiter.ts` — `ActorWaiter.Service` + `ActorWaiter.defaultLayer`

### 3.2 注册 Layer

**文件**: `src/effect/app-runtime.ts`

```ts
import { Goal } from "@/session/goal"
import { ActorRegistry } from "@/actor/registry"
import { TaskRegistry } from "@/task/registry"
import { ModeRegistry } from "@/session/mode-registry"
import { ActorSpawn } from "@/actor/spawn"
import { ActorWaiter } from "@/actor/waiter"

// 在 AppLayer 中添加：
Goal.defaultLayer,
ActorRegistry.defaultLayer,
TaskRegistry.defaultLayer,
ModeRegistry.defaultLayer,
ActorSpawn.defaultLayer,
ActorWaiter.defaultLayer,
```

### 3.3 主链路调用 — prompt.ts Goal 评估

**文件**: `src/session/prompt.ts`

**依赖注入**添加：

```ts
const goal = yield* Goal.Service
const modeRegistry = yield* ModeRegistry.Service
```

**runLoop 每步结束后**（约第1333行之前）添加 Goal 评估：

```ts
const currentGoal = yield* goal.get(sessionID)
if (currentGoal) {
  const agentInfo = yield* agents.get(lastUser.agent)
  const evolutionConfig = yield* modeRegistry.getEvolutionConfig(lastUser.agent)
  if (evolutionConfig.judgeEnabled) {
    const verdict = yield* evaluateGoal({
      goal: currentGoal.condition,
      transcript: msgs,
      model: judgeModel,
    })
    if (verdict.ok) {
      yield* goal.clear(sessionID)
      break
    }
    if (verdict.impossible) {
      yield* goal.clear(sessionID)
    }
    const reactCount = yield* goal.bumpReact(sessionID)
    if (reactCount >= 12) {
      yield* goal.clear(sessionID)
      break
    }
  }
}
```

注意：`evaluateGoal` 是一个需要实现的辅助函数，它使用 judge model（小模型）评估目标是否达成。需要在 `prompt.ts` 中实现或从单独模块导入。

### 3.4 主链路调用 — task.ts ActorRegistry

**文件**: `src/tool/task.ts`

**依赖注入**添加：

```ts
const actorRegistry = yield* ActorRegistry.Service
```

**spawn subagent 成功后**（约第142行，`nextSession` 创建之后）添加：

```ts
yield* actorRegistry.register({
  sessionID: ctx.sessionID,
  actorID: nextSession.id,
  mode: "subagent",
  status: "pending",
  agent: next.name,
  description: params.description,
  contextMode: "state",
  background: runInBackground,
  lastTurnTime: Date.now(),
  turnCount: 0,
  time: { created: Date.now(), updated: Date.now() },
})
```

**subagent 完成后**添加 updateStatus。有两个完成路径：

- **foreground 模式**（约第316行，`Effect.acquireUseRelease` 的 use 块中，结果返回后）
- **background 模式**（约第234行，`notify` 函数中 `result.info?.status === "completed"` 时）

```ts
yield* actorRegistry.updateStatus(ctx.sessionID, nextSession.id, {
  status: "idle",
  lastOutcome: result?.status === "error" ? "failure" : "success",
})
```

### 3.5 主链路调用 — todo.ts TaskRegistry

**文件**: `src/tool/todo.ts`

**依赖注入**添加：

```ts
const taskRegistry = yield* TaskRegistry.Service
```

**todowrite 执行时**（`yield* todo.update(...)` 之后）添加：

```ts
for (const todoItem of params.todos) {
  if (todoItem.status === "pending" || todoItem.status === "in_progress") {
    yield* taskRegistry.create({
      sessionID: ctx.sessionID,
      title: todoItem.content,
    })
  }
}
```

### 3.6 验证

```bash
cd packages/opencode && bun typecheck
cd packages/opencode && bun test test/phase3/phase3.test.ts
```

---

## Phase 4: 记忆层集成（Auto-Dream + Checkpoint Writer）

**目标**：实现自动记忆整合和会话检查点。

**依赖关系**：
```
Phase 1 (Trace) + Phase 3 (Goal + Task)
    ↓
Checkpoint Writer
    ↓
Auto-Dream + Auto-Distill
```

### 4.1 改造 auto-dream.ts 为 Effect Service

**文件**: `src/session/auto-dream.ts`

当前文件只有简单的常量和纯函数。需要改造为 Effect Service，使用 `Ref` 持有上次触发时间状态：

```ts
import { Effect, Ref, Context, Layer } from "effect"

export const AUTO_DREAM_TITLE = "Auto Dream"
export const AUTO_DISTILL_TITLE = "Auto Distill"

export const DREAM_TASK = [
  "Run one automatic dream memory consolidation pass for the current project.",
  "",
  "Use the memory files as the working index and the raw opencode trajectory database as the source of truth.",
  "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
  "Consolidate only durable, verified information into project memory.",
].join("\n")

export const DISTILL_TASK = [
  "Run one automatic distill pass for the current project.",
  "",
  "Review the past month of sessions and identify repeated manual workflows worth packaging.",
  "Use the raw opencode trajectory database as the source of truth and memory files to spot cross-session patterns.",
  "Inventory existing skills, agents, and commands first so you reuse or extend instead of duplicating.",
  "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
  "Produce a compact shortlist, then create only the high-confidence missing assets.",
].join("\n")

export interface Interface {
  readonly shouldAutoDream: (intervalDays?: number) => Effect.Effect<boolean>
  readonly shouldAutoDistill: (intervalDays?: number) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AutoDream") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const lastDreamTime = yield* Ref.make(0)
    const lastDistillTime = yield* Ref.make(0)

    const shouldAutoDream = Effect.fn("AutoDream.shouldAutoDream")(function* (intervalDays = 7) {
      const now = Date.now()
      const last = yield* Ref.get(lastDreamTime)
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000
      if (now - last < intervalMs) return false
      yield* Ref.set(lastDreamTime, now)
      return true
    })

    const shouldAutoDistill = Effect.fn("AutoDream.shouldAutoDistill")(function* (intervalDays = 30) {
      const now = Date.now()
      const last = yield* Ref.get(lastDistillTime)
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000
      if (now - last < intervalMs) return false
      yield* Ref.set(lastDistillTime, now)
      return true
    })

    return Service.of({ shouldAutoDream, shouldAutoDistill })
  })
)

export const defaultLayer = layer

export * as AutoDream from "./auto-dream"
```

### 4.2 新建 checkpoint.ts Service

**文件**: `src/session/checkpoint.ts`（新建）

```ts
import { Effect, Context, Layer } from "effect"
import { SessionStatus } from "./status"
import { spawnRef } from "@/actor/spawn-ref"

export interface Interface {
  readonly tryStartCheckpointWriter: (sessionID: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionCheckpoint") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const status = yield* SessionStatus.Service

    const tryStartCheckpointWriter = Effect.fn("SessionCheckpoint.tryStartCheckpointWriter")(
      function* (sessionID: string) {
        const sessionStatus = yield* status.get(sessionID)
        if (sessionStatus.type !== "idle") return
        if (!spawnRef.current) return

        yield* spawnRef.current.spawn({
          mode: "subagent",
          sessionID,
          agentType: "checkpoint-writer",
          task: "Write checkpoint for current session",
          context: "state",
          tools: "INHERIT",
          background: true,
        })
      }
    )

    return Service.of({ tryStartCheckpointWriter })
  })
)

export const defaultLayer = layer

export * as SessionCheckpoint from "./checkpoint"
```

### 4.3 注册 Layer

**文件**: `src/effect/app-runtime.ts`

```ts
import { AutoDream } from "@/session/auto-dream"
import { SessionCheckpoint } from "@/session/checkpoint"

// 在 AppLayer 中添加：
AutoDream.defaultLayer,
SessionCheckpoint.defaultLayer,
```

### 4.4 主链路调用 — prompt.ts runLoop 结束后

**文件**: `src/session/prompt.ts`

**依赖注入**添加：

```ts
const autoDream = yield* AutoDream.Service
const checkpoint = yield* SessionCheckpoint.Service
```

**runLoop 结束后**（约第1337行 `yield* compaction.prune` 之后、`return yield* lastAssistant` 之前）添加：

```ts
// 异步触发 checkpoint
yield* checkpoint.tryStartCheckpointWriter(sessionID).pipe(Effect.ignore, Effect.forkIn(scope))

// 检查并触发 auto-dream
const dreamTrigger = yield* autoDream.shouldAutoDream()
if (dreamTrigger) {
  yield* Effect.logInfo("triggering auto-dream", { "session.id": sessionID })
  const dreamSession = yield* sessions.create({ title: "Auto Dream", agent: "dream" })
  yield* prompt({
    sessionID: dreamSession.id,
    agent: "dream",
    parts: [{ type: "text", text: DREAM_TASK }],
  }).pipe(Effect.ignore, Effect.forkIn(scope))
}

const distillTrigger = yield* autoDream.shouldAutoDistill()
if (distillTrigger) {
  yield* Effect.logInfo("triggering auto-distill", { "session.id": sessionID })
  const distillSession = yield* sessions.create({ title: "Auto Distill", agent: "distill" })
  yield* prompt({
    sessionID: distillSession.id,
    agent: "distill",
    parts: [{ type: "text", text: DISTILL_TASK }],
  }).pipe(Effect.ignore, Effect.forkIn(scope))
}
```

注意：auto-dream 和 auto-distill 使用 `Effect.forkIn(scope)` 异步执行，不阻塞用户等待。

### 4.5 验证

```bash
cd packages/opencode && bun typecheck
cd packages/opencode && bun test test/phase2/phase2.test.ts
```

---

## Phase 5: 工具层集成（6 个死工具注册）

**目标**：将 6 个已定义的工具注册到 ToolRegistry。

注意：`shell-tokenize.ts` 和 `shell-wrap.ts` 是工具辅助模块，不是独立工具，不需要注册为工具。它们在 Phase 2 中被 shell.ts 调用。

### 5.1 转换工具定义为 Tool.define 格式

当前这 6 个工具只是简单的 JSON 对象（`{ id, description, parameters }`），需要转为 `Tool.define` 格式（添加 `execute` 方法）。

**文件**: `src/tool/actor.ts`

```ts
import * as Tool from "./tool"
import { Schema, Effect } from "effect"
import { ActorRegistry } from "@/actor/registry"
import { ActorSpawn } from "@/actor/spawn"
import { ActorWaiter } from "@/actor/waiter"

export const Parameters = Schema.Struct({
  operation: Schema.Literals(["run", "spawn", "status", "wait", "cancel", "send"]),
  subagent_type: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  prompt: Schema.optional(Schema.String),
  actor_id: Schema.optional(Schema.String),
  to_actor_id: Schema.optional(Schema.String),
  content: Schema.optional(Schema.String),
  timeout_ms: Schema.optional(Schema.Number),
})

export const ActorTool = Tool.define(
  "actor",
  Effect.gen(function* () {
    const actorRegistry = yield* ActorRegistry.Service
    const actorSpawn = yield* ActorSpawn.Service
    const actorWaiter = yield* ActorWaiter.Service

    return {
      description: "Spawn and manage subagents for parallel task execution.",
      parameters: Parameters,
      execute: (params, ctx) =>
        Effect.gen(function* () {
          switch (params.operation) {
            case "spawn": {
              const actor = yield* actorSpawn.spawn({
                mode: "subagent",
                sessionID: ctx.sessionID,
                agentType: params.subagent_type ?? "build",
                task: params.prompt ?? "",
                description: params.description,
                context: "state",
                tools: "INHERIT",
                background: false,
              })
              yield* actorRegistry.register(actor)
              return { title: `Spawned ${actor.actorID}`, output: JSON.stringify(actor), metadata: {} }
            }
            case "status": {
              if (!params.actor_id) return { title: "error", output: "actor_id required", metadata: {} }
              const result = yield* actorWaiter.status({ actorID: params.actor_id })
              return { title: `Status: ${result.status}`, output: JSON.stringify(result), metadata: {} }
            }
            // ... 其他操作
            default:
              return { title: "unsupported", output: `Operation ${params.operation} not yet implemented`, metadata: {} }
          }
        }),
    }
  })
)
```

类似地转换：`history.ts`, `memory.ts`, `workflow.ts`, `screenshot.ts`, `multiedit.ts`。

每个工具需要根据其现有 `parameters` 定义实现对应的 `execute` 逻辑。对于功能复杂的工具（如 workflow），可以先实现一个 stub 返回 "not implemented"。

### 5.2 添加 RuntimeFlags

**文件**: `src/effect/runtime-flags.ts`

在 `Service` 定义中添加新的 flag：

```ts
experimentalActorTool: enabledByExperimental("OPENCODE_EXPERIMENTAL_ACTOR_TOOL"),
experimentalHistoryTool: enabledByExperimental("OPENCODE_EXPERIMENTAL_HISTORY_TOOL"),
experimentalMemoryTool: enabledByExperimental("OPENCODE_EXPERIMENTAL_MEMORY_TOOL"),
experimentalWorkflowTool: enabledByExperimental("OPENCODE_EXPERIMENTAL_WORKFLOW_TOOL"),
```

### 5.3 注册到 ToolRegistry

**文件**: `src/tool/registry.ts`

**顶部**添加 import：

```ts
import { ActorTool } from "./actor"
import { HistoryTool } from "./history"
import { MemoryTool } from "./memory"
import { WorkflowTool } from "./workflow"
import { ScreenshotTool } from "./screenshot"
import { MultiEditTool } from "./multiedit"
```

**`Effect.all` 中**（约第198行）添加：

```ts
actor: Tool.init(ActorTool),
history: Tool.init(HistoryTool),
memory: Tool.init(MemoryTool),
workflow: Tool.init(WorkflowTool),
screenshot: Tool.init(ScreenshotTool),
multiedit: Tool.init(MultiEditTool),
```

**`builtin` 数组中**（约第219行）添加：

```ts
...(flags.experimentalActorTool ? [tool.actor] : []),
...(flags.experimentalHistoryTool ? [tool.history] : []),
...(flags.experimentalMemoryTool ? [tool.memory] : []),
...(flags.experimentalWorkflowTool ? [tool.workflow] : []),
tool.screenshot,
tool.multiedit,
```

### 5.4 验证

```bash
cd packages/opencode && bun typecheck
cd packages/opencode && bun test
```

---

## Phase 6: 高级功能集成（Evolution + Scheduler + Team + AST + Workflow）

**目标**：集成剩余的高级功能模块。

### 6.1 添加 Service 定义

为以下模块添加 Effect Service（同 Phase 1 模式）：

| 模块 | 文件 | Service Tag |
|------|------|-------------|
| Evolution | `src/evolution/evolution.ts` | `@opencode/Evolution` |
| Scheduler | `src/scheduler/scheduler.ts` | `@opencode/Scheduler` |
| Team | `src/team/team.ts` | `@opencode/Team` |
| AST | `src/ast/ast.ts` | `@opencode/AST` |
| Workflow | `src/workflow/workflow.ts` | `@opencode/Workflow` |

每个模块在现有纯函数之后添加 `Interface`、`Service` class、`layer`、`defaultLayer`。

### 6.2 注册 Layer

**文件**: `src/effect/app-runtime.ts`

```ts
import { Evolution } from "@/evolution/evolution"
import { Scheduler } from "@/scheduler/scheduler"
import { Team } from "@/team/team"
import { AST } from "@/ast/ast"
import { Workflow } from "@/workflow/workflow"

// 在 AppLayer 中添加：
Evolution.defaultLayer,
Scheduler.defaultLayer,
Team.defaultLayer,
AST.defaultLayer,
Workflow.defaultLayer,
```

### 6.3 主链路调用 — edit.ts/write.ts AST

**文件**: `src/tool/edit.ts`

**依赖注入**添加：

```ts
const ast = yield* AST.Service
```

**edit 成功后**（文件修改完成、返回结果之前）添加：

```ts
const blastRadius = yield* ast.calculateBlastRadius(params.filePath)
yield* Effect.logInfo("ast: blast radius", {
  file: params.filePath,
  dependents: blastRadius.dependents.length,
  depth: blastRadius.depth,
})
```

**文件**: `src/tool/write.ts` — 同样模式。

注意：`calculateBlastRadius` 需要依赖图数据（`Map<string, string[]>`）。AST Service 的实现需要维护一个项目级的依赖图，或者通过静态分析动态构建。这是 Phase 6 中复杂度最高的部分。

### 6.4 验证

```bash
cd packages/opencode && bun typecheck
cd packages/opencode && bun test
```

---

## 验证计划

### 每 Phase 三层验证

| 层级 | 方法 | 目的 |
|------|------|------|
| L1 类型检查 | `bun typecheck` | 确保编译通过，无类型错误 |
| L2 单元测试 | `bun test test/effect/*` | 验证 Service 可实例化、方法可调用 |
| L3 集成测试 | `bun test test/phase*` + grep 主链路调用 | 验证主链路实际调用了 Service |

### 每 Phase 验收标准

| Phase | L1 | L2 | L3 |
|-------|----|----|-----|
| 1 | 0 errors | Trace emit/getTraces 可调用；Metrics record 可调用；TokenTracker recordUsage/getDailyBudget 可调用 | processor.ts 中 grep 到 `Trace.Service`、`Metrics.Service` 和 `TokenTracker.Service` |
| 2 | 0 errors | Cardinal evaluate 阻止 eval/exec；AlignmentGuard detectRabbitHole 检测重复命令 | processor.ts 中 grep 到 `Cardinal.Service`；shell.ts 中 grep 到 `tokenize`；prompt.ts 中 grep 到 `AlignmentGuard.Service` |
| 3 | 0 errors | Goal set/get/clear 生命周期；ActorRegistry register/updateStatus；TaskRegistry create/start/done | prompt.ts 中 grep 到 `Goal.Service`；task.ts 中 grep 到 `ActorRegistry.Service`；todo.ts 中 grep 到 `TaskRegistry.Service` |
| 4 | 0 errors | AutoDream shouldAutoDream 首次返回 true、间隔内返回 false；Checkpoint tryStartCheckpointWriter 可调用 | prompt.ts 中 grep 到 `AutoDream.Service` 和 `SessionCheckpoint.Service` |
| 5 | 0 errors | 6 个工具转为 Tool.define 格式（有 execute 方法）；registry.ts builtin 数组包含新工具 | registry.ts 中 grep 到 `ActorTool`、`ScreenshotTool`、`MultiEditTool` 等 |
| 6 | 0 errors | AST calculateBlastRadius/extractContract 可调用 | edit.ts 中 grep 到 `AST.Service` |

### 最终全量验证

```bash
# 类型检查
cd packages/opencode && bun typecheck

# 全量测试
cd packages/opencode && bun test

# 验证 AppLayer 包含所有新 Layer
grep -c "defaultLayer" src/effect/app-runtime.ts

# 验证主链路调用完整性
grep -rn "Trace.Service\|Metrics.Service\|TokenTracker.Service" src/session/processor.ts
grep -rn "Cardinal.Service" src/session/processor.ts
grep -rn "Goal.Service\|AlignmentGuard.Service\|AutoDream.Service\|SessionCheckpoint.Service" src/session/prompt.ts
grep -rn "tokenize" src/tool/shell.ts
grep -rn "ActorTool\|HistoryTool\|ScreenshotTool\|MultiEditTool" src/tool/registry.ts
grep -rn "ActorRegistry.Service" src/tool/task.ts
grep -rn "TaskRegistry.Service" src/tool/todo.ts
grep -rn "AST.Service" src/tool/edit.ts src/tool/write.ts
```

---

## 风险点

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Goal 评估需要额外 LLM 调用 | 增加 token 消耗和延迟 | 通过 ModeRegistry 的 `judgeEnabled` flag 控制；使用小模型 |
| Cardinal 可能误 block 正常操作 | 阻断用户工作流 | `block` 仅用于明确安全风险（eval/exec/密钥）；`pause` 级别让用户确认 |
| Auto-Dream 在用户等待时触发 | 用户体验差 | 使用 `Effect.forkIn(scope)` 异步执行，不阻塞主循环 |
| 循环依赖（Actor ↔ SessionPrompt ↔ Checkpoint） | Layer 构建失败 | 使用 `spawnRef` late-bound reference 模式打破循环（已存在于 `src/actor/spawn-ref.ts`） |
| 性能影响 | 每个 tool call 增加 Trace/Metrics/Cardinal 开销 | 内存 Ref 存储，不做持久化；Cardinal 规则为简单条件判断，无 LLM 调用 |
| Effect Service 与现有纯函数并存 | 两套 API 混淆 | Service 内部调用现有纯函数，不删除原有导出；渐进迁移 |

---

## 死代码清单

### 核心模块（16个）

| 模块 | 文件 | 当前状态 | 需要改造 |
|------|------|---------|---------|
| trace | `src/trace/trace.ts` | 纯函数+接口 | 添加 Service |
| metrics | `src/metrics/metrics.ts` | 纯函数+接口 | 添加 Service |
| token | `src/token/tracker.ts` | 纯函数+接口 | 添加 Service |
| cardinal | `src/session/cardinal.ts` | 纯函数+接口 | 添加 Service |
| alignment-guard | `src/observability/alignment-guard.ts` | 纯函数+接口 | 添加 Service |
| evolution | `src/evolution/evolution.ts` | 纯函数+接口 | 添加 Service |
| scheduler | `src/scheduler/scheduler.ts` | 纯函数+接口 | 添加 Service |
| team | `src/team/team.ts` | 纯函数+接口 | 添加 Service |
| ast | `src/ast/ast.ts` | 纯函数+接口 | 添加 Service |
| workflow | `src/workflow/workflow.ts` | 纯函数+接口 | 添加 Service |
| goal | `src/session/goal.ts` | **已有 Service** | 仅需注册+调用 |
| mode-registry | `src/session/mode-registry.ts` | **已有 Service** | 仅需注册+调用 |
| actor | `src/actor/` | **已有 Service** | 仅需注册+调用 |
| task | `src/task/` | **已有 Service** | 仅需注册+调用 |
| shadow-worktree | `src/shadow-worktree/` | 已有模块 | 独立，不在此规划内 |
| auto-dream | `src/session/auto-dream.ts` | 纯函数+常量 | 改造为 Effect Service |
| checkpoint | `src/session/checkpoint.ts` | **不存在** | 新建 Service |

### 死工具（6个）

| 工具 | 文件 | 当前状态 |
|------|------|---------|
| actor | `src/tool/actor.ts` | JSON 对象 |
| history | `src/tool/history.ts` | JSON 对象 |
| memory | `src/tool/memory.ts` | JSON 对象 |
| workflow | `src/tool/workflow.ts` | JSON 对象 |
| screenshot | `src/tool/screenshot.ts` | JSON 对象 |
| multiedit | `src/tool/multiedit.ts` | JSON 对象 |

注：`shell-tokenize.ts` 和 `shell-wrap.ts` 是工具辅助模块（被 shell.ts 调用），不是独立工具，不需要注册为 Tool。

### 死 Prompt（1个）

| Prompt | 文件 | 用途 |
|--------|------|------|
| checkpoint-writer | `src/agent/prompt/checkpoint-writer.txt` | Checkpoint Writer subagent 的 system prompt |

### 死 Session 模块（2个）

| 模块 | 文件 | 用途 |
|------|------|------|
| checkpoint-templates | `src/session/checkpoint-templates.ts` | checkpoint.md 模板 |
| checkpoint-paths | `src/session/checkpoint-paths.ts` | checkpoint 文件路径工具函数 |

这两个模块被 checkpoint-writer subagent 使用，在 Phase 4 的 checkpoint.ts Service 触发后自然被激活。

---

## 代码规范

所有改造遵循项目 `AGENTS.md` 中的 Effect 规范：

- 使用 `export * as ModuleName from "./module-name"` 自引用模式
- Service 使用 `Context.Service<Service, Interface>()("@opencode/ModuleName")`
- Layer 使用 `Layer.effect(Service, Effect.gen(function* () { ... }))`
- Effect 方法使用 `Effect.fn("ModuleName.method")` 命名
- 避免 `namespace` 导出，使用顶层声明 + 自引用
- `defaultLayer` 提供适当的错误处理（`Layer.orDie` 或显式错误类型）

---

*本文档基于 2026-06-29 代码审查，如有架构更新需同步更新。*
