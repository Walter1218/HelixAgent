# HelixAgent 主链路接入执行计划

> 目标：将 6 个已注册但未接入主链路的服务（Evolution、Team、AST、Workflow、OpenSpecHook、Scheduler）接入核心执行路径
> 创建日期: 2026-06-30
> 状态: 待执行
> 前置文档: `HELIX_AGENT_STATUS.md`

---

## 一、总体策略

### 1.1 接入原则

1. **遵循 Effect v4 约定**：使用 `Effect.gen`、`Effect.fn`、`Effect.forkIn(scope)`，遵循 `AGENTS.md` 中的 Effect 规则
2. **错误隔离**：所有新增调用必须 `Effect.catchAll` / `Effect.ignore` / `Effect.forkIn(scope)`，不得影响主链路
3. **异步执行**：非关键路径（AST 分析、Evolution 导出、Team 摘要、OpenSpec 检查）必须异步
4. **生命周期完整**：Workflow 必须覆盖 runLoop 所有退出点
5. **独立提交**：每个模块一个 commit，可独立回滚
6. **node deps 同步**：prompt.ts / processor.ts / tool/*.ts 的 LayerNode deps 必须声明新增服务

### 1.2 接入顺序

```
Step 1: Workflow（影响 prompt.ts runLoop 结构，最先做）
Step 2: Team（改动 tool/actor.ts + tool/task.ts）
Step 3: AST（改动 processor.ts + prompt.ts）
Step 4: OpenSpecHook（改动 app-runtime.ts + processor.ts）
Step 5: Evolution（改动 prompt.ts）
Step 6: Scheduler（待明确调用点）
```

**顺序理由**：
- Workflow 改动 runLoop 外层包装，影响最大，先做可减少后续冲突
- Team 与 Actor/Task 相关，但改动独立
- AST 和 OpenSpecHook 都需要在 `processor.ts` tool-result 中提取变更文件，相邻做便于统一处理
- Evolution 在 runLoop 末尾调用，依赖 Workflow 建立的 runLoop 结构
- Scheduler 当前无明确调用点，最后处理

---

## 二、Step 1: Workflow 接入

### 2.1 目标

为每个 Session 创建 WorkflowRun 记录，跟踪开始、结束、异常、取消状态。

### 2.2 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 外层包装 Workflow 生命周期；cancel 函数更新状态 |

### 2.3 具体改动

#### 2.3.1 import

```ts
import { Workflow } from "@/workflow/workflow"
```

#### 2.3.2 在 layer 中 yield 服务

```ts
const workflow = yield* Workflow.Service
```

#### 2.3.3 拆分 runLoop

因为 `state.ensureRunning` 会把同一个 session 的并发 `loop` 调用合并到同一个实际执行的 `runLoop` 上，Workflow 生命周期必须绑定到真正执行的那次 `runLoop`，而不是 `loop` 调用本身。因此把原 `runLoop` 改名为 `runLoopBody`，再用新的 `runLoop` 包装生命周期：

```ts
const runLoopBody: (sessionID: SessionID) => Effect.Effect<SessionV1.WithParts> = Effect.fn("SessionPrompt.runBody")(
  function* (sessionID: SessionID) {
    // ... 原 runLoop 的全部内容 ...
    return yield* lastAssistant(sessionID)
  },
)

const runLoop: (sessionID: SessionID) => Effect.Effect<SessionV1.WithParts> = Effect.fn("SessionPrompt.run")(
  function* (sessionID: SessionID) {
    const session = yield* sessions.get(sessionID).pipe(Effect.orDie)
    const run = yield* workflow.startRun({
      sessionID,
      name: session.title,
    })

    return yield* runLoopBody(sessionID).pipe(
      Effect.onExit((exit) =>
        Exit.match(exit, {
          onSuccess: () => workflow.completeRun(run.runID, "completed"),
          onFailure: (cause) =>
            Cause.hasInterruptsOnly(cause)
              ? workflow.completeRun(run.runID, "cancelled")
              : workflow.completeRun(run.runID, "failed", Cause.pretty(cause)),
        }).pipe(Effect.ignore)
      ),
    )
  },
)
```

**要点**：
- `Effect.onExit` 在 `runLoopBody` 无论成功、失败、被取消都会执行
- 使用 `Cause.hasInterruptsOnly(cause)` 判断是否为纯中断（用户取消）
- `Workflow.Service` 已在 layer 中 `yield` 到 `workflow` 变量

#### 2.3.4 loop 调用无需修改

```ts
const loop: (input: LoopInput) => Effect.Effect<SessionV1.WithParts> = Effect.fn("SessionPrompt.loop")(
  function* (input: LoopInput) {
    return yield* state.ensureRunning(input.sessionID, lastAssistant(input.sessionID), runLoop(input.sessionID))
  },
)
```

#### 2.3.5 cancel 函数无需改动

`SessionRunState.cancel` 会中断运行中的 `runLoop` fiber，触发 `Effect.onExit` 的 `cancelled` 分支。不要在这里调用 `workflow.cancelRunBySession(sessionID)`，因为它会按 `session_id` 批量更新，可能误伤 `tool/workflow.ts` 创建的独立 workflow run。

保持原实现：

```ts
const cancel = Effect.fn("SessionPrompt.cancel")(function* (sessionID: SessionID) {
  yield* Effect.logInfo("cancel", { "session.id": sessionID })
  yield* state.cancel(sessionID)
})
```

#### 2.3.6 更新 node deps

在 `prompt.ts` 文件底部的 `LayerNode.make` 中 `deps` 数组添加：

```ts
Workflow.node,
```

### 2.5 Workflow Service 与 Workflow Tool 的关系

- **Workflow Service**：跟踪 Session 生命周期（本次接入）
- **Workflow Tool**：允许 LLM 启动独立脚本工作流（已存在，本次不改）

两者都会创建 `workflow_run` 表记录。Session 级别的 run 用 `name: session.title` 标识，Tool 级别的 run 用 `name: params.name` 标识，不会冲突。

### 2.6 验收标准

```bash
# 1. 编译通过
bun typecheck

# 2. prompt.ts 中有 workflow 调用
rg -n "yield\* workflow\." packages/opencode/src/session/prompt.ts

# 3. node deps 已声明
rg -n "Workflow\.node" packages/opencode/src/session/prompt.ts

# 4. 新 session 创建后 workflow_run 表有 running 记录
# 5. session 结束后状态变为 completed/failed/cancelled
```

---

## 三、Step 2: Team 接入

### 3.1 目标

当通过 actor tool 或 task tool 创建子 agent 时，将其记录到 Team 中。

### 3.2 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/tool/actor.ts` | 修改 | spawn 后加入团队 |
| `packages/opencode/src/tool/task.ts` | 修改 | 创建子 session 后加入团队 |
| `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 末尾异步输出团队摘要 |

### 3.3 具体改动

#### 3.3.1 tool/actor.ts

Team 是可选依赖：tool 在 Team 可用时记录成员，不可用时不阻塞主链路。使用 `Effect.serviceOption` 避免把 Team 硬编码为 tool 的必需上下文。

```ts
import { Team } from "@/team/team"
import { Option } from "effect"

// 在 init Effect 中
const maybeTeam = yield* Effect.serviceOption(Team.Service)

// 在 spawn case 中
case "spawn": {
  const actor = yield* actorSpawn.spawn({...})
  yield* actorRegistry.register(actor)

  yield* Option.match(maybeTeam, {
    onNone: () => Effect.void,
    onSome: (team) =>
      team.addMemberToOwnerSession(ctx.sessionID, {
        sessionID: actor.actorID,
        agent: params.subagent_type ?? "build",
        role: "actor",
        joinedAt: Date.now(),
      }).pipe(Effect.ignore),
  })

  return { title: `Spawned ${actor.actorID}`, output: JSON.stringify(actor), metadata: {} }
}
```

#### 3.3.2 tool/task.ts

同上，使用 `Effect.serviceOption`：

```ts
import { Team } from "@/team/team"
import { Option } from "effect"

// 在 init Effect 中
const maybeTeam = yield* Effect.serviceOption(Team.Service)

// 在创建 nextSession 并注册 actorRegistry 后
yield* actorRegistry.register({...})

yield* Option.match(maybeTeam, {
  onNone: () => Effect.void,
  onSome: (team) =>
    team.addMemberToOwnerSession(ctx.sessionID, {
      sessionID: nextSession.id,
      agent: next.name,
      role: "task",
      joinedAt: Date.now(),
    }).pipe(Effect.ignore),
})
```

#### 3.3.3 prompt.ts runLoop 末尾

在 `return yield* lastAssistant(sessionID)` 之前，使用已 `yield` 的 `team` 服务输出摘要：

```ts
yield* team.formatTeamByOwnerSession(sessionID).pipe(
  Effect.flatMap((summary) =>
    summary ? Effect.logInfo("team summary", { "session.id": sessionID, summary }) : Effect.void,
  ),
  Effect.catch(() => Effect.void),
)
```

#### 3.3.4 更新 node deps / defaultLayer

- `tool/actor.ts` 和 `tool/task.ts` 不需要把 Team 加入 `Tool.define` 的上下文类型
- `prompt.ts`：
  - `LayerNode.make` deps 添加 `Team.node`
  - `SessionPrompt.defaultLayer` 的 `Layer.mergeAll` 添加 `Team.defaultLayer`

### 3.4 验收标准

```bash
# 1. 编译通过
bun typecheck

# 2. tool/actor.ts 和 tool/task.ts 中有 Team serviceOption 和 addMemberToOwnerSession 调用
rg -n "serviceOption\(Team\.Service\)|addMemberToOwnerSession" packages/opencode/src/tool/actor.ts packages/opencode/src/tool/task.ts

# 3. prompt.ts 中有 team 调用
rg -n "formatTeamByOwnerSession" packages/opencode/src/session/prompt.ts

# 4. 调用 actor/task tool 后 team_member 表有记录
```

---

## 四、Step 3: AST 接入

### 4.1 目标

在文件被工具修改后，自动计算 blast radius。

### 4.2 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/ast/ast.ts` | 修改 | 新增 `getChangedFilesFromSession` |
| `packages/opencode/src/session/processor.ts` | 修改 | tool-result 中提取变更文件 |
| `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 末尾异步执行 AST 分析 |

### 4.3 具体改动

#### 4.3.1 ast.ts 增强

AST 服务内部使用 `Ref<Map<SessionID, Set<string>>>` 作为临时存储，避免改动 session metadata：

```ts
const changedFilesCache = yield* Ref.make<Map<string, Set<string>>>(new Map())

const recordChangedFiles = Effect.fn("AST.recordChangedFiles")(function* (
  sessionID: string,
  files: string[],
) {
  const cache = yield* Ref.get(changedFilesCache)
  const existing = cache.get(sessionID)
  if (existing) {
    for (const file of files) existing.add(file)
  } else {
    cache.set(sessionID, new Set(files))
  }
})

const getChangedFiles = Effect.fn("AST.getChangedFiles")(function* (sessionID: string) {
  const cache = yield* Ref.get(changedFilesCache)
  const files = cache.get(sessionID)
  return files ? Array.from(files) : []
})

const clearChangedFiles = Effect.fn("AST.clearChangedFiles")(function* (sessionID: string) {
  const cache = yield* Ref.get(changedFilesCache)
  cache.delete(sessionID)
})
```

在 `Interface` 中暴露这三个方法。

#### 4.3.2 processor.ts tool-result

AST 在 processor 中是可选依赖，使用 `Effect.serviceOption`：

```ts
import { AST } from "@/ast/ast"
import { Option } from "effect"

// 在 layer 中
const maybeAST = yield* Effect.serviceOption(AST.Service)

// 顶层 helper
function extractChangedFilesFromToolInput(toolName: string, input: unknown): string[] {
  if (toolName !== "write" && toolName !== "edit" && toolName !== "apply_patch" && toolName !== "multiedit") {
    return []
  }
  if (!isRecord(input)) return []
  const path = input.path
  if (typeof path === "string") return [path]
  const paths = input.paths
  if (Array.isArray(paths)) return paths.filter((p): p is string => typeof p === "string")
  return []
}

// 在 case "tool-result" 中，completeToolCall 之后
const changedFiles = extractChangedFilesFromToolInput(
  value.name ?? "unknown",
  toolCall?.part.state.input,
)
if (changedFiles.length > 0) {
  yield* Option.match(maybeAST, {
    onNone: () => Effect.void,
    onSome: (ast) => ast.recordChangedFiles(ctx.sessionID, changedFiles).pipe(Effect.ignore),
  })
}
```

#### 4.3.3 prompt.ts runLoop 末尾

AST 在 prompt.ts 中同样使用 `Effect.serviceOption`。在 `return yield* lastAssistant(sessionID)` 之前：

```ts
yield* Option.match(maybeAST, {
  onNone: () => Effect.void,
  onSome: (ast) =>
    Effect.gen(function* () {
      const changedFiles = yield* ast.getChangedFiles(sessionID)
      if (changedFiles.length === 0) return
      const radii = yield* ast.analyzeChangedFiles(changedFiles, ctx.worktree).pipe(
        Effect.catch(() => Effect.succeed([] as AST.BlastRadius[])),
      )
      for (const radius of radii) {
        yield* Effect.logInfo("ast: blast radius", {
          "session.id": sessionID,
          file: radius.file,
          dependents: radius.dependents.length,
          depth: radius.depth,
        })
      }
      yield* ast.clearChangedFiles(sessionID)
    }).pipe(Effect.catch(() => Effect.void), Effect.forkIn(scope)),
})
```

#### 4.3.4 更新 node deps / defaultLayer

- `processor.ts`：LayerNode deps 添加 `AST.node`；`SessionProcessor.defaultLayer` 添加 `Layer.provide(AST.defaultLayer)`
- `prompt.ts`：LayerNode deps 添加 `AST.node`；`SessionPrompt.defaultLayer` 的 `Layer.mergeAll` 添加 `AST.defaultLayer`

### 4.4 验收标准

```bash
# 1. 编译通过
bun typecheck

# 2. ast.ts 有 recordChangedFiles / getChangedFiles / clearChangedFiles
rg -n "recordChangedFiles|getChangedFiles|clearChangedFiles" packages/opencode/src/ast/ast.ts

# 3. processor.ts 和 prompt.ts 中有 AST serviceOption 调用
rg -n "serviceOption\(AST\.Service\)|recordChangedFiles|getChangedFiles|analyzeChangedFiles" packages/opencode/src/session/processor.ts packages/opencode/src/session/prompt.ts

# 4. node deps 已声明
rg -n "AST\.node" packages/opencode/src/session/processor.ts packages/opencode/src/session/prompt.ts

# 5. 修改 util 文件后日志输出 blast radius
```

---

## 五、Step 4: OpenSpecHook 接入

### 5.1 目标

在文件修改类工具执行成功后，自动触发 spec 合规检查。

### 5.2 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/effect/app-runtime.ts` | 修改 | 注册 OpenSpecHook.defaultLayer |
| `packages/opencode/src/session/processor.ts` | 修改 | tool-result 后调用 checkAfterToolCall |

### 5.3 具体改动

#### 5.3.1 app-runtime.ts 注册

```ts
import { OpenSpecHook } from "@/openspec/hook"
```

在 AppLayer 中添加：

```ts
OpenSpecHook.defaultLayer,
```

#### 5.3.2 processor.ts

OpenSpecHook 在 processor 中是可选依赖，使用 `Effect.serviceOption`：

```ts
import { OpenSpecHook } from "@/openspec/hook"
import { Option } from "effect"

// 在 layer 中
const maybeOpenSpecHook = yield* Effect.serviceOption(OpenSpecHook.Service)

// 在 case "tool-result" 中，completeToolCall 之后（复用 AST 的 changedFiles）
if (changedFiles.length > 0) {
  yield* Option.match(maybeOpenSpecHook, {
    onNone: () => Effect.void,
    onSome: (hook) =>
      Effect.forEach(changedFiles, (file) =>
        hook.checkAfterToolCall(value.name ?? "unknown", file).pipe(
          Effect.flatMap((result) =>
            result.allApproved
              ? Effect.void
              : Effect.logWarning("openspec: compliance check failed", {
                  "session.id": ctx.sessionID,
                  tool: value.name,
                  file,
                  affectedSpecs: result.affectedSpecs.map((s) => s.filePath),
                  missing: result.results.flatMap((r) => r.missingRequirements),
                }),
          ),
          Effect.catch(() => Effect.void),
        ),
      ).pipe(Effect.ignore),
  })
}
```

#### 5.3.3 更新 defaultLayer

- `processor.ts` 的 `SessionProcessor.defaultLayer` 添加 `Layer.provide(OpenSpecHook.defaultLayer)`
- `app-runtime.ts` 的 `AppLayer` 添加 `OpenSpecHook.defaultLayer`（已包含 OpenSpec、OpenSpecJudge）

> 注意：`OpenSpecHook` 没有导出 `node`，因此不需要更新 LayerNode deps。

### 5.4 验收标准

```bash
# 1. 编译通过
bun typecheck

# 2. app-runtime.ts 中注册了 OpenSpecHook
rg -n "OpenSpecHook\.defaultLayer" packages/opencode/src/effect/app-runtime.ts

# 3. processor.ts 中有 OpenSpecHook serviceOption 和 checkAfterToolCall 调用
rg -n "serviceOption\(OpenSpecHook\.Service\)|checkAfterToolCall" packages/opencode/src/session/processor.ts

# 4. SessionProcessor.defaultLayer 提供了 OpenSpecHook
rg -n "OpenSpecHook\.defaultLayer" packages/opencode/src/session/processor.ts
```

---

## 六、Step 5: Evolution 接入

### 6.1 目标

在 Session 结束后，自动从 Trace 中导出 DPO 训练数据。

### 6.2 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 末尾异步调用 exportSession |

### 6.3 具体改动

#### 6.3.1 import

```ts
import { Evolution } from "@/evolution/evolution"
```

#### 6.3.2 在 layer 中 yield 可选服务

Evolution 是可选依赖，使用 `Effect.serviceOption`：

```ts
const maybeEvolution = yield* Effect.serviceOption(Evolution.Service)
```

#### 6.3.3 runLoop 末尾调用

在 `return yield* lastAssistant(sessionID)` 之前：

```ts
const evolutionMsgs = yield* MessageV2.filterCompactedEffect(sessionID).pipe(
  Effect.provideService(Database.Service, database),
)
const lastUserMsg = evolutionMsgs.findLast((m) => m.info.role === "user")
if (lastUserMsg) {
  const evolutionConfig = yield* modeRegistry.getEvolutionConfig(lastUserMsg.info.agent)
  if (evolutionConfig.evolutionEnabled) {
    yield* Option.match(maybeEvolution, {
      onNone: () => Effect.void,
      onSome: (evolution) =>
        evolution.exportSession(sessionID).pipe(
          Effect.flatMap((result) =>
            result.pairCount > 0
              ? Effect.logInfo("evolution: exported dpo pairs", {
                  "session.id": sessionID,
                  pairs: result.pairCount,
                  outputPath: result.outputPath,
                })
              : Effect.void,
          ),
          Effect.catch(() => Effect.void),
        ),
    })
  }
}
```

#### 6.3.4 更新 node deps / defaultLayer

- `prompt.ts` LayerNode deps 添加 `Evolution.node`
- `SessionPrompt.defaultLayer` 的 `Layer.mergeAll` 添加 `Evolution.defaultLayer`

### 6.4 验收标准

```bash
# 1. 编译通过
bun typecheck

# 2. prompt.ts 中有 Evolution serviceOption 和 exportSession 调用
rg -n "serviceOption\(Evolution\.Service\)|exportSession" packages/opencode/src/session/prompt.ts

# 3. node deps 已声明
rg -n "Evolution\.node" packages/opencode/src/session/prompt.ts

# 4. Session 结束后 .dogfooding/dpo_pairs/ 生成 JSONL
```

---

## 七、Step 6: Scheduler 接入

### 7.1 实现方案

在 `tool/todo.ts` 和 `prompt.ts` 两个点接入：

1. **Todo 优先级排序**：`tool/todo.ts` 更新 todo 列表后，将 pending/in_progress 的 todo 包装为 `Scheduler.Task`，调用 `selectTasks` 输出 selected/deferred 结果。
2. **Token 预算控制**：`prompt.ts` 的 `runLoopBody` 每轮迭代开始时累加上一轮的 token 使用量，超过 `dailyBudget` 时主动 `break`，将剩余工作Deferred到后续子任务。

### 7.2 tool/todo.ts

```ts
import { Scheduler } from "@/scheduler/scheduler"
import { Option } from "effect"

// 在 init Effect 中
const maybeScheduler = yield* Effect.serviceOption(Scheduler.Service)

// 在 execute 中，更新 todo 后
yield* Option.match(maybeScheduler, {
  onNone: () => Effect.void,
  onSome: (scheduler) =>
    Effect.gen(function* () {
      const now = Date.now()
      const normalizePriority = (priority: string): Scheduler.Task["priority"] => {
        if (priority === "high" || priority === "low") return priority
        return "medium"
      }
      const normalizeStatus = (status: string): Scheduler.Task["status"] =>
        status === "in_progress" ? "running" : (status as Scheduler.Task["status"])
      const tasks = params.todos
        .filter((t) => t.status === "pending" || t.status === "in_progress")
        .map((t, index) => ({
          id: `todo-${ctx.sessionID}-${index}`,
          title: t.content,
          description: t.content,
          priority: normalizePriority(t.priority ?? "medium"),
          status: normalizeStatus(t.status),
          estimatedTokens: 100000,
          createdAt: now,
          updatedAt: now,
        }))
      if (tasks.length === 0) return
      const result = yield* scheduler.selectTasks(tasks, Scheduler.DEFAULT_SCHEDULE_CONFIG)
      yield* Effect.logInfo("scheduler: todo prioritization", {
        "session.id": ctx.sessionID,
        selected: result.selected.map((t) => t.title),
        deferred: result.deferred.map((t) => t.title),
        totalTokens: result.totalTokens,
      })
    }).pipe(Effect.catch(() => Effect.void)),
})
```

### 7.3 prompt.ts runLoop

```ts
// 在 runLoopBody 开始处
let accumulatedTokens = 0

// 每轮迭代开始，lastFinished 可用后
const { user: lastUser, assistant: lastAssistant, finished: lastFinished, tasks } = MessageV2.latest(msgs)

if (lastFinished) {
  accumulatedTokens +=
    lastFinished.tokens.input + lastFinished.tokens.output + lastFinished.tokens.reasoning
}

const budgetExceeded = Option.match(maybeScheduler, {
  onNone: () => false,
  onSome: () => accumulatedTokens > Scheduler.DEFAULT_SCHEDULE_CONFIG.dailyBudget,
})
if (budgetExceeded) {
  yield* Effect.logWarning("scheduler: daily token budget exceeded, deferring to subtasks", {
    "session.id": sessionID,
    accumulatedTokens,
    budget: Scheduler.DEFAULT_SCHEDULE_CONFIG.dailyBudget,
  })
  break
}
```

### 7.4 更新 defaultLayer / node deps

- `tool/todo.ts` 不需要更新 `Tool.define` 上下文类型（使用 `Effect.serviceOption`）
- `ToolRegistry.defaultLayer` 添加 `Layer.provide(Scheduler.defaultLayer)`
- `ToolRegistry.node` deps 添加 `Scheduler.node`
- `prompt.ts`：
  - `LayerNode.make` deps 添加 `Scheduler.node`
  - `SessionPrompt.defaultLayer` 的 `Layer.mergeAll` 添加 `Scheduler.defaultLayer`
- `app-runtime.ts` 的 `AppLayer` 添加 `Scheduler.defaultLayer`（若尚未存在）

### 7.5 验收标准

```bash
# 1. 编译通过
bun typecheck

# 2. tool/todo.ts 和 prompt.ts 中有 Scheduler 调用
rg -n "serviceOption\(Scheduler\.Service\)|selectTasks|dailyBudget" packages/opencode/src/tool/todo.ts packages/opencode/src/session/prompt.ts

# 3. node deps / defaultLayer 已声明
rg -n "Scheduler\.node|Scheduler\.defaultLayer" packages/opencode/src/tool/registry.ts packages/opencode/src/session/prompt.ts packages/opencode/src/effect/app-runtime.ts

# 4. 创建 todo 后日志输出 selected/deferred
# 5. token 超过预算后 runLoop 主动退出
```

---

## 八、跨模块共享逻辑

### 8.1 变更文件提取函数

AST 和 OpenSpecHook 都需要从 tool-result 中提取变更文件。在 `processor.ts` 中提取为共享函数，**从 tool input 的 `path` / `paths` 字段解析**，比从 output 文本解析更可靠：

```ts
function extractChangedFilesFromToolInput(toolName: string, input: unknown): string[] {
  if (
    toolName !== "write" &&
    toolName !== "edit" &&
    toolName !== "apply_patch" &&
    toolName !== "multiedit"
  ) {
    return []
  }
  if (!isRecord(input)) return []
  const path = input.path
  if (typeof path === "string") return [path]
  const paths = input.paths
  if (Array.isArray(paths)) return paths.filter((p): p is string => typeof p === "string")
  return []
}
```

### 8.2 错误隔离模式

所有新增调用统一使用以下模式：

- **同步场景**：`.pipe(Effect.catch(() => Effect.void))` 或 `Effect.ignore`
- **异步场景**：`.pipe(Effect.catch(() => Effect.void), Effect.forkIn(scope))`
- **可选依赖**：`Effect.serviceOption(Service)` + `Option.match(...)`

---

## 九、node deps / defaultLayer 更新汇总

### 9.1 prompt.ts

`LayerNode.make` deps 添加：

```ts
Workflow.node,
Team.node,
AST.node,
Evolution.node,
Scheduler.node,
```

`SessionPrompt.defaultLayer` 的 `Layer.mergeAll` 添加：

```ts
Workflow.defaultLayer,
Team.defaultLayer,
AST.defaultLayer,
Evolution.defaultLayer,
Scheduler.defaultLayer,
```

### 9.2 processor.ts

`LayerNode.make` deps 添加：

```ts
AST.node,
```

`SessionProcessor.defaultLayer` 添加：

```ts
Layer.provide(AST.defaultLayer),
Layer.provide(OpenSpecHook.defaultLayer),
```

> `OpenSpecHook` 没有导出 `node`，因此不加入 LayerNode deps。

### 9.3 app-runtime.ts

`AppLayer` 中已存在 `OpenSpec.defaultLayer` 和 `OpenSpecJudge.defaultLayer`，添加：

```ts
OpenSpecHook.defaultLayer,
```

### 9.4 tool/actor.ts / tool/task.ts

不需要更新 `Tool.define` 上下文类型；Team 通过 `Effect.serviceOption` 可选获取。

### 9.5 tool/registry.ts

`defaultLayer` provideMerge 块添加：

```ts
Layer.provide(Scheduler.defaultLayer),
```

`LayerNode.make` deps 添加：

```ts
Scheduler.node,
```

---

## 十、执行时间表

| 时间 | 任务 | 验证方式 |
|------|------|---------|
| Day 1 上午 | Step 1: Workflow | typecheck + workflow_run 表记录 |
| Day 1 下午 | Step 2: Team | typecheck + team_member 表记录 |
| Day 2 上午 | Step 3: AST | typecheck + blast radius 日志 |
| Day 2 下午 | Step 4: OpenSpecHook | typecheck + spec 合规日志 |
| Day 3 上午 | Step 5: Evolution | typecheck + DPO JSONL 生成 |
| Day 3 下午 | Step 6: Scheduler 决策 | 是否接入 + 调用点确认 |
| Day 4 | 全量回归 + 文档更新 | 所有验证命令通过 |

---

## 十一、验收清单（每个 Step 后必须执行）

```bash
# 1. 编译
bun typecheck

# 2. 调用点验证
rg -n "yield\* <module>\." packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts packages/opencode/src/tool/*.ts --type ts

# 3. node deps 验证
rg -n "<Module>\.node" packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts

# 4. 错误隔离验证
rg -n "Effect\.(catchAll|ignore|forkIn)" packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts

# 5. 无新增 stub
rg -n "not implemented" packages/opencode/src/tool/*.ts --type ts
```

---

## 十二、测试策略

### 12.1 单元测试

- AST: 测试 `calculateBlastRadius` 和 `parseImports`
- Team: 测试 `addMemberToOwnerSession` 去重
- Workflow: 测试 `startRun` / `completeRun` 状态转换
- Evolution: 测试 `filterDirtyTraces` 和 `matchPairs`
- OpenSpecHook: 测试 `checkAfterToolCall` 的 spec 匹配逻辑

### 12.2 集成测试

- 创建新 Session，验证 workflow_run 记录生成
- 调用 actor tool，验证 team_member 记录生成
- 修改 util 文件，验证 AST blast radius 日志
- 创建符合 spec 的修改，验证 OpenSpec 合规检查日志
- 结束一个长 Session，验证 DPO JSONL 导出

### 12.3 手动验证

```bash
# 启动 TUI
tmux new-session -d -s opencode-dev 'bun dev'

# 创建新 session 并执行简单任务
# 检查数据库：workflow_run, team_member 表
# 检查日志输出：ast, openspec, evolution
# 检查 .dogfooding/dpo_pairs/ 目录
```

## 十三、风险与回滚

### 13.1 风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| runLoop 包装引入异常 | Workflow 的 Effect.ensuring 可能改变错误传播 | 每个退出点单独测试 |
| AST 分析阻塞响应 | 大项目扫描慢 | 使用 Effect.forkIn(scope) 异步执行 |
| OpenSpec 误报 | 文件类工具都可能触发 | 默认仅告警，不阻断 |
| Team DB 写入失败 | 不影响主工具执行 | Effect.catchAll + Effect.void |

### 13.2 回滚

每个 Step 独立 commit：

```bash
git revert <step-commit-hash>
```

---

## 十四、相关文档

- `HELIX_AGENT_STATUS.md` — 当前系统状态
- `DEAD_CODE_MAIN_CHAIN_INTEGRATION_PLAN.md` — 原始集成规划
- `DELIVERY_ASSURANCE_PLAN.md` — 交付流程与质量保障
