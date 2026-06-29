# HelixAgent 死代码主链路集成规划

> 将已注册但未在主链路中实际调用的 4 个 Effect 模块（Evolution、Team、AST、Workflow）接入 HelixAgent 的核心执行路径
> 创建日期: 2026-06-29
> 最后更新: 2026-06-29
> 状态: 规划中

---

## 一、问题定义

在 `DEAD_CODE_ACTIVATION_PLAN.md` 完成后，以下 16 个模块已全部注册到 `app-runtime.ts`：

- Trace、Metrics、TokenTracker
- Cardinal、AlignmentGuard
- Goal、Actor、Task、ModeRegistry
- Auto-Dream、Checkpoint Writer
- 6 个死工具
- Evolution、Scheduler、Team、AST、Workflow

但经检查，**Evolution、Team、AST、Workflow** 四个模块仅注册了 `defaultLayer`，未在 `processor.ts`、`prompt.ts`、`tool/*.ts` 等主链路文件中被实际调用。它们仍然是"激活但未工作"的代码。

本规划目标：把这 4 个模块作为独立的**核心能力**接入主链路，不依赖 auto-dev 集成。

---

## 二、模块集成总览

| 模块 | 当前状态 | 集成价值 | 主链路调用点 | 持久化要求 |
|------|---------|---------|-------------|-----------|
| **AST** | 纯函数，未调用 | 修改前计算影响范围、检测 breaking changes | `prompt.ts` post-processing / `processor.ts` tool-result | 不需要持久化（运行时分析） |
| **Evolution** | 纯函数，未调用 | 从 Trace 生成 DPO 训练数据 | `prompt.ts` runLoop 末尾 | 导出 JSONL 文件 |
| **Team** | 内存函数，未调用 | 多 actor 协作的团队追踪 | `tool/actor.ts` spawn | **数据库持久化** |
| **Workflow** | 内存函数，未调用 | Session/Workflow 生命周期跟踪 | `prompt.ts` runLoop 开始/结束 | **数据库持久化** |

---

## 三、集成方案

### 3.1 AST 模块 — 代码影响分析（完整版）

#### 3.1.1 目标

实现真正的 blast radius 计算：给定一个变更文件，能回答"修改它会级联影响哪些文件"。

#### 3.1.2 需要增强的能力

当前 `src/ast/ast.ts` 只有：
- `calculateBlastRadius(file, dependencies)` — 需要调用方传入依赖图
- `extractContract(content)` — 简单的正则提取

**需要新增**：
- `buildDependencyGraph(rootPath: string): Effect.Effect<Map<string, string[]>>`
  - 扫描项目 TypeScript/TSX 文件
  - 解析 `import` / `export` 语句
  - 建立文件级依赖图（谁依赖谁）
- `getChangedFilesFromSession(sessionID: string): Effect.Effect<string[]>`
  - 从 session messages 中提取被 tool 修改过的文件路径

#### 3.1.3 主链路调用点

**调用点 A：tool-result 后提取变更文件**

在 `src/session/processor.ts` 的 `case "tool-result"` 分支中，当文件类 tool（`write` / `edit` / `apply_patch` / `multi_edit`）成功执行后，从其结果中提取被修改的文件路径：

```ts
// processor.ts case "tool-result"
// 从 tool 结果中提取变更文件（不同 tool 格式不同）
const changedFiles = extractChangedFilesFromToolResult(value.result, value.name)
// 暂存到 session metadata 或内存中，供 post-processing 使用
```

**调用点 B：Session 结束后批量分析**

在 `src/session/prompt.ts` 的 `runLoop` 末尾 post-processing 区域：

```ts
// prompt.ts runLoop 末尾
const changedFiles = yield* ast.getChangedFilesFromSession(sessionID)
if (changedFiles.length > 0) {
  const fs = yield* FileSystem.FileSystem
  const rootPath = process.cwd()
  const dependencyGraph = yield* ast.buildDependencyGraph(rootPath)
  for (const file of changedFiles) {
    const radius = yield* ast.calculateBlastRadius(file, dependencyGraph)
    yield* Effect.logInfo("ast: blast radius", {
      file,
      dependents: radius.dependents.length,
      depth: radius.depth,
    })
  }
}
```

**调用点 C：Contract 变化检测（breaking changes）**

在 `prompt.ts` post-processing 中：

```ts
for (const file of changedFiles) {
  if (file.endsWith(".ts") || file.endsWith(".tsx")) {
    const content = yield* FileSystem.readFileString(file)
    const contract = yield* ast.extractContract(content)
    // 与 session 开始前的 contract 对比
    // 检测删除的 exports / classes / functions
  }
}
```

#### 3.1.4 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/ast/ast.ts` | 修改 | 新增 `buildDependencyGraph`、`getChangedFilesFromSession` |
| `packages/opencode/src/session/processor.ts` | 修改 | 在 `tool-result` 中添加 blast radius 检查 |
| `packages/opencode/src/session/prompt.ts` | 修改 | 在 runLoop 末尾添加批量 AST 分析 |

#### 3.1.5 依赖分析实现策略

**方案 A：基于文本解析（MVP）**
- 使用 `FileSystem.FileSystem` 读取文件内容
- 用正则匹配 `import ... from "./relative-path"` 和 `export ...`
- 优点：无需额外依赖，性能好，符合 Effect 架构
- 缺点：无法处理动态 import、路径别名、barrel exports
- **建议**：先实现此方案

**方案 B：基于 TypeScript Compiler API（完整版）**
- 使用项目中已有的 `typescript` 包（开发依赖）创建 Program
- 调用 `ts.preProcessFile` 或 `ts.createSourceFile` 解析 import
- 优点：准确，支持别名、类型导入、barrel re-exports
- 缺点：增加初始化时间，需要读取 tsconfig.json
- **注意**：需确认 `typescript` 包是否在生产依赖中可用

**建议**：先做方案 A 作为 MVP，后续迭代到方案 B。

**缓存策略**：`buildDependencyGraph` 的结果可以缓存到 `Ref` 中，避免每次 Session 重建。在文件系统 watcher 检测到文件变更时，标记缓存失效。

---

### 3.2 Evolution 模块 — DPO 训练数据飞轮

#### 3.2.1 目标

在每次 Session 结束后，自动从 Trace 中提取成功/失败对，过滤脏数据，导出为 JSONL，用于模型偏好对齐训练。

#### 3.2.2 主链路调用点

在 `src/session/prompt.ts` 的 `runLoop` 末尾（post-processing 区域）：

```ts
// prompt.ts runLoop 末尾
const traces = yield* trace.getTraces(sessionID)
const MIN_TRACE_COUNT = 5 // 最小 trace 数量，低于此值不导出
if (traces.length >= MIN_TRACE_COUNT) {
  const cleanTraces = yield* evolution.filterDirty(traces)
  const pairs = yield* evolution.matchPairs(cleanTraces)
  if (pairs.length > 0) {
    const jsonl = yield* evolution.exportToJsonl(pairs)
    yield* writeDpoJsonl(sessionID, jsonl) // 使用 FileSystem.FileSystem 写入
    yield* Effect.logInfo("evolution: exported dpo pairs", {
      sessionID,
      pairs: pairs.length,
    })
  }
}
```

#### 3.2.3 输出路径

```
.dogfooding/
├── success_traces/
│   └── {sessionID}_{timestamp}.jsonl
├── failed_traces/
│   └── {sessionID}_{timestamp}.jsonl
└── dpo_pairs/
    └── {date}.jsonl
```

**注意**：如果 `.dogfooding/` 目录不存在，需要在使用 `FileSystem.FileSystem` 创建时自动创建。

#### 3.2.4 配置项

在 `opencode.json` 或 `.mimocode/mimocode.jsonc` 中添加：

```json
{
  "evolution": {
    "enabled": true,
    "auto_export": true,
    "min_trace_count": 10,
    "export_interval_days": 1
  }
}
```

#### 3.2.5 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/evolution/evolution.ts` | 修改 | 添加 `exportSession(sessionID)` 方法，封装完整流程 |
| `packages/opencode/src/session/prompt.ts` | 修改 | 在 runLoop 末尾调用 Evolution |

---

### 3.3 Team 模块 — 多 Actor 协作团队（数据库持久化）

#### 3.3.1 目标

当同一个 Session 中多次调用 `actor` tool 或 `task` tool 创建子 agent 时，自动追踪它们属于同一个"团队"，并持久化到数据库。

#### 3.3.2 数据库 Schema

新建文件 `packages/core/src/team/team.sql.ts`：

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { SessionSchema } from "../session/schema"

export const TeamTable = sqliteTable("team", {
  id: text().primaryKey(),
  owner_session_id: text()
    .$type<SessionSchema.ID>()
    .notNull(),
  name: text().notNull(),
  created_at: integer().notNull().$default(() => Date.now()),
})

export const TeamMemberTable = sqliteTable("team_member", {
  id: text().primaryKey(),
  team_id: text().notNull(),
  session_id: text().notNull(),
  agent: text().notNull(),
  role: text().notNull(),
  joined_at: integer().notNull().$default(() => Date.now()),
})
```

#### 3.3.3 数据库迁移

新建 `packages/core/src/database/migration/20260629_add_team_table.ts`：

```ts
import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260629_add_team_table",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE team (
          id TEXT PRIMARY KEY,
          owner_session_id TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `)
      yield* tx.run(`
        CREATE TABLE team_member (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          agent TEXT NOT NULL,
          role TEXT NOT NULL,
          joined_at INTEGER NOT NULL
        )
      `)
      yield* tx.run(`CREATE INDEX idx_team_owner ON team(owner_session_id)`)
      yield* tx.run(`CREATE INDEX idx_team_member_team ON team_member(team_id)`)
    })
  },
} satisfies DatabaseMigration.Migration
```

**注意**：需要在 `packages/core/src/database/migration.gen.ts` 中手动添加新的 import：

```ts
import("./migration/20260629_add_team_table"),
```

**外键约束说明**：初次创建时不添加 `REFERENCES session(id)` 外键约束，避免影响现有数据。验证稳定后可在后续迁移中添加。

#### 3.3.4 Team 服务改造

当前 `src/team/team.ts` 是纯内存函数。需要改为：

1. 通过 `Database.Service` 读写 SQLite
2. 添加以下方法：
   - `getOrCreateTeam(ownerSessionID: string, name: string)`
   - `addMemberToOwnerSession(ownerSessionID: string, member: TeamMember)`
   - `getTeamByOwnerSession(ownerSessionID: string)`
   - `formatTeamByOwnerSession(ownerSessionID: string)`

#### 3.3.5 主链路调用点

**调用点 A：actor.ts spawn 时**

```ts
// src/tool/actor.ts case "spawn"
const actor = yield* actorSpawn.spawn(...)
yield* actorRegistry.register(actor)

// 新增：加入团队
yield* team.addMemberToOwnerSession(ctx.sessionID, {
  sessionID: actor.actorID,
  agent: params.subagent_type ?? "build",
  role: "actor",
})

return {
  title: `Spawned ${actor.actorID}`,
  output: JSON.stringify(actor),
  metadata: {},
}
```

**调用点 B：task.ts 创建子 agent 时**

```ts
// src/tool/task.ts 中创建 sub-session 后
const subSession = yield* sessions.create(...)

// 新增：加入团队
yield* team.addMemberToOwnerSession(ctx.sessionID, {
  sessionID: subSession.id,
  agent: params.subagent_type,
  role: "task",
})
```

**调用点 C：prompt.ts 团队摘要**

在 `prompt.ts` runLoop 末尾：

```ts
const teamInfo = yield* team.formatTeamByOwnerSession(sessionID)
if (teamInfo) {
  yield* Effect.logInfo("team: members", { teamInfo })
}
```

#### 3.3.6 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/core/src/team/team.sql.ts` | 新建 | Team 表 schema |
| `packages/core/src/database/migration/20260629_add_team_table.ts` | 新建 | 迁移 |
| `packages/core/src/database/migration/index.ts` | 修改 | 注册迁移 |
| `packages/opencode/src/team/team.ts` | 修改 | 改为数据库持久化 |
| `packages/opencode/src/tool/actor.ts` | 修改 | spawn 时加入团队 |
| `packages/opencode/src/tool/task.ts` | 修改 | 创建子 session 时加入团队 |
| `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 末尾输出团队摘要 |

---

### 3.4 Workflow 模块 — Session 生命周期跟踪（数据库持久化）

#### 3.4.1 目标

为每个 Session 创建 WorkflowRun 记录，跟踪其开始、结束、耗时、状态。使长运行的 Session 有清晰的生命周期视图。

#### 3.4.2 数据库 Schema

新建文件 `packages/core/src/workflow/workflow.sql.ts`：

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { SessionSchema } from "../session/schema"

export const WorkflowRunTable = sqliteTable("workflow_run", {
  id: text().primaryKey(),
  run_id: text().notNull().unique(),
  session_id: text()
    .$type<SessionSchema.ID>()
    .notNull(),
  name: text(),
  status: text().notNull(), // running | completed | failed | cancelled
  started_at: integer().notNull().$default(() => Date.now()),
  completed_at: integer(),
  error: text(),
})
```

#### 3.4.3 数据库迁移

新建 `packages/core/src/database/migration/20260629_add_workflow_run_table.ts`：

```ts
import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260629_add_workflow_run_table",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE workflow_run (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL UNIQUE,
          session_id TEXT NOT NULL,
          name TEXT,
          status TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          error TEXT
        )
      `)
      yield* tx.run(`CREATE INDEX idx_workflow_run_session ON workflow_run(session_id)`)
      yield* tx.run(`CREATE INDEX idx_workflow_run_status ON workflow_run(status)`)
    })
  },
} satisfies DatabaseMigration.Migration
```

**注意**：需要在 `packages/core/src/database/migration.gen.ts` 中手动添加新的 import：

```ts
import("./migration/20260629_add_workflow_run_table"),
```

**外键约束说明**：初次创建时不添加 `REFERENCES session(id)` 外键约束，避免影响现有数据。验证稳定后可在后续迁移中添加。

#### 3.4.4 Workflow 服务改造

当前 `src/workflow/workflow.ts` 只有工具函数。需要改为：

1. 通过 `Database.Service` 持久化 WorkflowRun
2. 添加方法：
   - `startRun(input: { sessionID; name? }) => Effect<WorkflowRun>`
   - `completeRun(runID, status, error?) => Effect<void>`
   - `getRunsBySession(sessionID) => Effect<WorkflowRun[]>`
   - `cancelRun(runID) => Effect<void>`

#### 3.4.5 主链路调用点

在 `src/session/prompt.ts` 的 `runLoop` 中：

```ts
const runLoop = Effect.fn("SessionPrompt.runLoop")(function* (sessionID: SessionID) {
  // runLoop 开始
  const run = yield* workflow.startRun({
    sessionID,
    name: `Session ${sessionID}`,
  })

  try {
    // ... 现有的 runLoop 逻辑 ...
    
    // runLoop 正常结束
    yield* workflow.completeRun(run.run_id, "completed")
  } catch (e) {
    yield* workflow.completeRun(run.run_id, "failed", String(e))
    throw e
  }
})
```

**中断处理**：

`prompt.ts` 已有 `cancel` 方法，需要在那里调用：

```ts
const cancel = Effect.fn("SessionPrompt.cancel")(function* (sessionID) {
  // ... 现有取消逻辑 ...
  yield* workflow.cancelRunBySession(sessionID)
})
```

#### 3.4.6 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/core/src/workflow/workflow.sql.ts` | 新建 | WorkflowRun 表 schema |
| `packages/core/src/database/migration/20260629_add_workflow_run_table.ts` | 新建 | 迁移 |
| `packages/core/src/database/migration/index.ts` | 修改 | 注册迁移 |
| `packages/opencode/src/workflow/workflow.ts` | 修改 | 改为数据库持久化 |
| `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 开始/结束调用 Workflow |

---

## 四、实施顺序

```
Phase A: AST 模块
    ├── 增强 ast.ts（buildDependencyGraph + getChangedFilesFromSession）
    ├── processor.ts tool-result 中调用 blast radius
    └── prompt.ts post-processing 中批量分析

Phase B: Evolution 模块
    ├── 增强 evolution.ts（exportSession 方法）
    └── prompt.ts runLoop 末尾调用

Phase C: Workflow 模块（需要 DB）
    ├── 新建 workflow.sql.ts
    ├── 新建 migration
    ├── 改造 workflow.ts 为数据库持久化
    └── prompt.ts runLoop 中调用

Phase D: Team 模块（需要 DB）
    ├── 新建 team.sql.ts
    ├── 新建 migration
    ├── 改造 team.ts 为数据库持久化
    ├── actor.ts / task.ts 中调用 addMember
    └── prompt.ts 中输出团队摘要
```

**建议执行顺序**：AST → Evolution → Workflow → Team

- AST 和 Evolution 不依赖数据库，可以最先做
- Workflow 和 Team 涉及数据库迁移，需要谨慎处理，建议分开提交

---

## 五、工时估算

| Phase | 工时 | 复杂度 |
|-------|------|--------|
| A: AST（完整版，含依赖图构建） | 1.5 天 | 中 |
| B: Evolution | 0.5 天 | 低 |
| C: Workflow（数据库持久化） | 1 天 | 中 |
| D: Team（数据库持久化） | 1 天 | 中 |
| **总计** | **4 天** | |

---

## 六、风险与缓解

| 风险 | 说明 | 缓解方案 |
|------|------|---------|
| AST 依赖图构建性能差 | 大项目扫描所有文件可能慢 | 先做文本解析 MVP；缓存依赖图；只在需要时重建 |
| Team/Workflow DB 迁移失败 | 新增外键约束可能影响现有数据 | 先创建表，不添加外键约束；验证后再加约束 |
| Team 概念与现有 Actor 冲突 | ActorRegistry 和 Team 可能重复追踪 | Team 只负责"关系"，ActorRegistry 负责"状态"，职责分离 |
| Workflow 表快速增长 | 每个 Session 一条记录 | 添加清理策略（如只保留最近 N 天） |
| Evolution 导出大量脏数据 | Trace 中可能包含误触发 | `filterDirty` 已过滤 timeout/rate limit；后续可加更多模式 |

---

## 七、验收标准

每个模块完成后应满足：

- **AST**：修改一个 util 文件后，日志能输出该文件的 blast radius 和受影响文件列表
- **Evolution**：一个 Session 结束后，如果产生成功/失败 tool 调用对，`.dogfooding/dpo_pairs/` 下应生成 JSONL
- **Workflow**：每个新 Session 在 `workflow_run` 表中有一条记录，状态随 Session 结束更新
- **Team**：调用 actor tool 或 task tool 创建子 agent 后，`team_member` 表中应有关联记录

---

## 附录：新增/修改文件清单（汇总）

| 模块 | 文件 | 操作 | 说明 |
|------|------|------|------|
| **AST** | `packages/opencode/src/ast/ast.ts` | 修改 | 新增 `buildDependencyGraph`、`getChangedFilesFromSession` |
| **AST** | `packages/opencode/src/session/processor.ts` | 修改 | 在 `tool-result` 中检测文件类工具结果，提取变更文件 |
| **AST** | `packages/opencode/src/session/prompt.ts` | 修改 | 在 runLoop 末尾添加批量 AST 分析 |
| **Evolution** | `packages/opencode/src/evolution/evolution.ts` | 修改 | 新增 `exportSession(sessionID)` 方法，封装完整流程 |
| **Evolution** | `packages/opencode/src/session/prompt.ts` | 修改 | 在 runLoop 末尾调用 Evolution |
| **Team** | `packages/core/src/team/team.sql.ts` | 新建 | Team 表 schema |
| **Team** | `packages/core/src/database/migration/20260629_add_team_table.ts` | 新建 | 迁移 |
| **Team** | `packages/core/src/database/migration.gen.ts` | 修改 | 添加 migration import |
| **Team** | `packages/opencode/src/team/team.ts` | 修改 | 改为数据库持久化 |
| **Team** | `packages/opencode/src/tool/actor.ts` | 修改 | spawn 时加入团队 |
| **Team** | `packages/opencode/src/tool/task.ts` | 修改 | 创建子 session 时加入团队 |
| **Team** | `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 末尾输出团队摘要 |
| **Workflow** | `packages/core/src/workflow/workflow.sql.ts` | 新建 | WorkflowRun 表 schema |
| **Workflow** | `packages/core/src/database/migration/20260629_add_workflow_run_table.ts` | 新建 | 迁移 |
| **Workflow** | `packages/core/src/database/migration.gen.ts` | 修改 | 添加 migration import |
| **Workflow** | `packages/opencode/src/workflow/workflow.ts` | 修改 | 改为数据库持久化 |
| **Workflow** | `packages/opencode/src/session/prompt.ts` | 修改 | runLoop 开始/结束调用 Workflow |
