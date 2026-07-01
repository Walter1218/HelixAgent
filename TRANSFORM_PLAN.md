# HelixAgent 改造计划

> 将 Helix (MiMo-Code) 中有价值的能力移植到 HelixAgent (OpenCode)
> 最后更新: 2026-06-29 (新增Trace机制 + Debug日志系统)
> **状态说明**: 本文档为原始设计规划。当前实现状态请参考：
> - `HELIX_AGENT_STATUS.md` — 系统状态与交付蓝图
> - `DEAD_CODE_ACTIVATION_PLAN.md` — Phase 1-6 执行状态
> - `DEVELOPMENT_PLAN.md` — 后续能力开发计划

---

## 总体架构对比

```
Helix (MiMo-Code)                         HelixAgent (OpenCode)
─────────────────                         ────────────────────
L0: Shadow Worktree + AST 拦截器           无Shadow Worktree，有基础worktree目录
L1: Memory (FTS5 + Vector RAG)            无持久记忆层
    + History (跨会话搜索)                  无History系统
L2: Actor并发 + Task + Goal + FSM         已有完整的subagent系统
    + Cardinal + AlignmentGuard            无风险控制
    + Inbox (Actor间通信)                   无Inbox系统
    + Judge + Dream/Distill                
    + 模式系统 (Build/Plan/Compose/Max/Loop) 已有Build/Plan模式
L3: Auto-Dev + OpenSpec + Evolution       无Auto-Dev Scheduler
    + Workflow引擎                          无工作流引擎
    + Token Tracker + Metrics              无Token追踪和指标
    + Trace机制 (TraceReporter + Filter)    只有简单JSONL trace
    + Debug日志系统 (30+模块debug点)        只有简单JSONL trace
    + Team协作                              无团队协作

目标: 在 HelixAgent 的 V1+V2 双系统架构上，分层构建上述能力
```

---

## 依赖关系与实施顺序

```
Phase 1: Memory Layer (基础层)
    │
    ├── Phase 2a: Dream Agent (记忆整合) + Loop模式
    │
    ├── Phase 2b: Checkpoint Writer (会话快照)
    │
    ├── Phase 2c: Shell Safety (命令安全)
    │
    ├── Phase 2d: Actor并发系统 (子智能体管理)
    │    │
    │    ├── Phase 2e: Task系统 (任务管理)
    │    │
    │    └── Phase 2f: Goal系统 (目标驱动)
    │
    └── Phase 2g: 模式系统 (Build/Plan/Compose/Max/Loop)
         │
         ├── Phase 3a: Distill Agent (工作流蒸馏)
         │
         ├── Phase 3b: Judge System (代码审查) + Max模式
         │
         ├── Phase 3c: Shadow Worktree (Git 隔离)
         │
         ├── Phase 3d: Cardinal系统 (风险控制)
         │
         ├── Phase 3e: AlignmentGuard (偏移检测)
         │
         ├── Phase 3f: Inbox系统 (Actor间通信)
         │
         ├── Phase 3g: History系统 (跨会话搜索)
         │
         └── Phase 3h: 工具补充 (Actor/Workflow/History/Compose)
              │
              └── Phase 4: Evolution Flywheel (自我进化)
                   │
                   ├── Phase 4b: Token Tracker (预算管理)
                   │
                   ├── Phase 4c: Metrics系统 (性能指标)
                   │
                   ├── Phase 4d: Workflow引擎 (工作流执行)
                   │
                   └── Phase 4e: Trace机制 (执行追踪)
                        │
                        └── Phase 5: Auto-Dev Scheduler (自动开发)
                             │
                             ├── Phase 5b: Team系统 (团队协作)
                             │
                             ├── Phase 5c: AST Graph (代码分析)
                             │
                             ├── Phase 5d: 插件补充
                             │
                             └── Phase 5e: 配置补充
```

---

## Phase 1: Memory Layer (持久记忆层)

**目标**: 建立跨会话的持久知识存储，为 Dream/Distill/Checkpoint 提供基础。

### 1.1 数据库 Schema

**文件**: `packages/core/src/memory/sql.ts` (新建)

```sql
-- FTS5 全文搜索表
CREATE VIRTUAL TABLE memory_fts USING fts5(
  memory_path,    -- 文件路径 (scope/type/path.md)
  scope,          -- global | project | session
  scope_id,       -- projectID 或 sessionID
  type,           -- checkpoint | memory | notes | skill
  content,        -- 文件内容
  tokenize='unicode61'
);

-- 向量嵌入表 (可选，需要 embedding API)
CREATE TABLE memory_vec (
  memory_path TEXT PRIMARY KEY,
  embedding   BLOB,       -- float32[] 序列化
  hash        TEXT,        -- 语义哈希 (去注释后的 SHA256)
  updated_at  INTEGER
);
```

**迁移文件**: `packages/core/drizzle/migrations/` 下新增

### 1.2 目录结构

```
~/.local/share/opencode/          (Global.Path.data)
├── memory/
│   ├── global/                   # 全局知识 (跨项目)
│   │   └── MEMORY.md
│   ├── projects/
│   │   └── {projectID}/
│   │       ├── MEMORY.md         # 项目级记忆
│   │       └── skills/           # 项目级技能
│   └── sessions/
│       └── {sessionID}/
│           ├── checkpoint.md     # 会话快照
│           ├── notes.md          # 会话笔记
│           └── tasks/            # 任务进度
```

### 1.3 核心模块

| 文件 | 行数估计 | 职责 |
|------|---------|------|
| `packages/core/src/memory/service.ts` | ~250 | Effect Service: search, reconcile, decay |
| `packages/core/src/memory/paths.ts` | ~120 | 路径解析、scope/type 检测 |
| `packages/core/src/memory/fts-query.ts` | ~40 | FTS5 查询构建 (Unicode OR-join) |
| `packages/core/src/memory/reconcile.ts` | ~150 | 磁盘文件 → DB 同步 |
| `packages/core/src/memory/memory-decay.ts` | ~80 | 过期知识清理 |
| `packages/opencode/src/tool/memory.ts` | ~90 | `memory` 工具定义 (search-only) |

### 1.4 Memory Tool

注册到 `packages/opencode/src/tool/registry.ts` 的 `builtin` 数组:

```ts
{
  id: "memory",
  description: "Search persistent memory across sessions, projects, and global knowledge.",
  parameters: z.object({
    query: z.string(),
    scope: z.enum(["global", "project", "session"]).optional(),
    scope_id: z.string().optional(),
    type: z.string().optional(),
    limit: z.number().optional(),
  }),
  execute: async (args) => memory.search(args)
}
```

### 1.5 配置 Schema

**文件**: `packages/core/src/config/memory.ts` (新建)

```ts
class ConfigMemory extends Schema.Class("ConfigMemory")({
  enabled: Schema.Boolean.optional,          // default: true
  embedding: Schema.optional(Schema.Struct({
    provider: Schema.String,                 // "openai" | "local"
    model: Schema.String.optional,
    api_key: Schema.String.optional,
  })),
  decay: Schema.optional(Schema.Struct({
    enabled: Schema.Boolean,                 // default: true
    max_age_days: Schema.Number.optional,    // default: 90
  })),
}) {}
```

### 1.6 本地LM Studio向量支持

**默认配置** (与Helix一致):
```ts
const embedder = new Embedder({
  enabled: vc?.enabled ?? true,
  baseUrl: vc?.api_url ?? "http://localhost:1234/v1/embeddings",  // LM Studio默认端口
  model: vc?.model ?? "text-embedding-nomic-embed-text-v1.5",    // 默认模型
})
```

**混合检索算法**:
```
combined_score = BM25_score × 0.6 + Vector_score × 0.4
共存项 boost = 1.3x（同时出现在BM25和Vector结果中的项）
```

### 1.7 集成点

- `packages/core/src/plugin/agent.ts`: 给 `default` 和 `general` agent 添加 `memory` 工具权限
- `packages/opencode/src/session/system.ts`: 在系统提示词中注入 memory 使用说明

---

## Phase 2a: Dream Agent (记忆整合) + Loop模式

**目标**: 后台自动整合历史会话知识到 MEMORY.md，实现Loop模式。

### 2.1 Agent 定义

**修改**: `packages/opencode/src/agent/agent.ts`

```ts
dream: {
  name: "dream",
  mode: "subagent",
  native: true,
  hidden: true,
  prompt: PROMPT_DREAM,  // 从 dream.txt 加载
  toolAllowlist: ["read", "write", "edit", "glob", "grep", "memory", "bash"],
  permission: Permission.merge(defaults, Permission.fromConfig({
    "*": "deny",
    read: "allow", write: "allow", edit: "allow",
    glob: "allow", grep: "allow", memory: "allow", bash: "allow",
    external_directory: {
      [path.join(Global.Path.data, "memory")]: "allow",
    },
  }), user),
}
```

**修改**: `packages/core/src/plugin/agent.ts` — V2 注册

### 2.2 系统提示词

**文件**: `packages/opencode/src/agent/prompt/dream.txt` (新建，155行)

6 阶段工作流:
1. **定位数据**: SQLite DB + memory 目录
2. **定向**: 读取当前 MEMORY.md
3. **收集**: 从 checkpoint/notes 提取持久事实
4. **验证**: SQLite 只读查询交叉验证
5. **整合**: 编辑 MEMORY.md (4 段: Rules, Architecture, Knowledge, Gotchas)
6. **修剪**: 保持 <200行 / 10KB

### 2.3 Loop模式自动调度

**文件**: `packages/opencode/src/session/auto-dream.ts` (新建，~123行)

```ts
const DREAM_INTERVAL_DAYS = 7
const DISTILL_INTERVAL_DAYS = 30
const MIN_SPAWN_GAP_MS = 10_000

export function shouldAutoDream(cfg: Config.Info) {
  const enabled = cfg.dream?.auto !== false
  if (!enabled) return Effect.succeed(false)
  const now = Date.now()
  if (now - lastDreamSpawnTime < MIN_SPAWN_GAP_MS) return Effect.succeed(false)
  lastDreamSpawnTime = now
  const intervalDays = cfg.dream?.interval_days ?? DEFAULT_DREAM_INTERVAL_DAYS
  return shouldAutoRun({ enabled, intervalDays, title: AUTO_DREAM_TITLE, label: "dream" })
}

export function shouldAutoDistill(cfg: Config.Info) {
  const enabled = cfg.distill?.auto !== false
  if (!enabled) return Effect.succeed(false)
  const now = Date.now()
  if (now - lastDistillSpawnTime < MIN_SPAWN_GAP_MS) return Effect.succeed(false)
  lastDistillSpawnTime = now
  const intervalDays = cfg.distill?.interval_days ?? DEFAULT_DISTILL_INTERVAL_DAYS
  return shouldAutoRun({ enabled, intervalDays, title: AUTO_DISTILL_TITLE, label: "distill" })
}
```

**Loop模式特征**:
- **不是**通过 `agent.name` 检测，而是基于配置和时间间隔自动触发
- auto-dream: 每7天自动触发dream后台智能体进行记忆蒸馏
- auto-distill: 每30天自动触发distill智能体提取经验到MEMORY.md
- 两次自动触发之间有 `MIN_SPAWN_GAP_MS = 10_000` 最小间隔，防止并发冲突

### 2.4 触发点

**修改**: `packages/opencode/src/session/prompt.ts` — 在 `runLoop` 中:

```ts
// Trigger auto-dream and auto-distill when conditions are met.
if (dreamTrigger || distillTrigger) {
  const { AppRuntime } = yield* Effect.promise(() => import("@/effect/app-runtime"))
  if (dreamTrigger) {
    AppRuntime.runPromise(
      Session.Service.use((svc) =>
        Effect.gen(function* () {
          const s = yield* svc.create({ title: AUTO_DREAM_TITLE })
          const sp = yield* Service
          yield* sp.prompt({ sessionID: s.id, agent: "dream", model: mdl, parts: [{ type: "text", text: DREAM_TASK }] })
        }),
      ),
    ).catch((err) => log.error("auto-dream prompt failed", { error: String(err) }))
  }
  if (distillTrigger) {
    AppRuntime.runPromise(
      Session.Service.use((svc) =>
        Effect.gen(function* () {
          const s = yield* svc.create({ title: AUTO_DISTILL_TITLE })
          const sp = yield* Service
          yield* sp.prompt({ sessionID: s.id, agent: "distill", model: mdl, parts: [{ type: "text", text: DISTILL_TASK }] })
        }),
      ),
    ).catch((err) => log.error("auto-distill prompt failed", { error: String(err) }))
  }
}
```

### 2.5 系统 Agent 集合

**文件**: `packages/opencode/src/agent/system-agents.ts` (新建)

```ts
export const SYSTEM_SPAWNED_AGENT_TYPES = new Set([
  "checkpoint-writer", "dream", "distill", "judge"
])
```

### 2.6 配置

**修改**: `packages/core/src/config/` 新增:

```ts
dream: Schema.optional(Schema.Struct({
  auto: Schema.optional(Schema.Boolean),        // default: true
  interval_days: Schema.optional(NonNegativeInt), // default: 7
})),
distill: Schema.optional(Schema.Struct({
  auto: Schema.optional(Schema.Boolean),        // default: true
  interval_days: Schema.optional(NonNegativeInt), // default: 30
})),
```

---

## Phase 2b: Checkpoint Writer (会话快照)

**目标**: 会话超长时自动保存上下文快照，支持跨会话恢复。

### 2.1 核心模块

| 文件 | 行数估计 | 职责 |
|------|---------|------|
| `packages/opencode/src/session/checkpoint.ts` | ~1500 | 主服务: 边界计算、生成 prompt、监控完成 |
| `packages/opencode/src/session/checkpoint-paths.ts` | ~90 | 路径辅助函数 |
| `packages/opencode/src/session/checkpoint-templates.ts` | ~120 | checkpoint.md / MEMORY.md / notes.md 模板 |
| `packages/opencode/src/session/checkpoint-retry.ts` | ~200 | 验证 + 重试逻辑 |
| `packages/opencode/src/agent/prompt/checkpoint-writer.txt` | ~170 | Writer agent 系统提示词 |

### 2.2 Checkpoint.md 结构 (11 段)

```
§1  Active intent           — 用户原始请求
§2  Next concrete action    — 下一步具体操作
§3  Directives              — 会话级工作风格
§4  Task tree               — 任务工具 DB 中的任务树
§5  Current work            — 当前进行中的工作
§6  Files and code sections — 活跃读写的文件
§7  Discovered knowledge    — 跨任务发现
§8  Errors and fixes        — 问题与修复
§9  Live resources          — 运行时状态
§10 Design decisions        — 设计决策
§11 Open notes              — 兜底段
```

### 2.3 触发机制

- Token 阈值触发: 当会话 token 数超过模型上下文窗口的一定比例时
- 通过 `packages/opencode/src/session/prune.ts` 中的逻辑检测

### 2.4 Writer Agent

- 隐藏的后台 subagent
- 权限: read/write/edit/glob/grep/task
- Fork 模式: 可继承父会话 LLM 前缀 (prefix-cache 复用)
- 完成后验证 + 重试

---

## Phase 2c: Shell Safety (命令安全)

**目标**: AST 级命令解析 + 危险操作拦截。

### 2.1 Shell Tokenizer

**文件**: `packages/opencode/src/tool/shell-tokenize.ts` (新建，~350行)

```ts
export function tokenize(script: string): Effect.Effect<Argv[], ParseError>
```

处理流水线:
1. Heredoc 提取 (`<<MARKER` ... `MARKER`)
2. 注释预处理 (POSIX `#` 注释)
3. 行分割 (顶层换行)
4. 引号扫描 (未闭合检测)
5. shell-quote 解析
6. 操作符拒绝 (`|`, `>`, `>>`, `<<<`, `*`, `;`)

### 2.2 AST 拦截器

**修改**: `packages/opencode/src/tool/shell.ts`

```ts
const HIGH_RISK_COMMANDS = new Set([
  "curl", "wget", "nc", "ping", "telnet", "ssh", "scp", "sftp", "rsync"
])

// 在 execute 前拦截
if (HIGH_RISK_COMMANDS.has(cmd)) throw new Error("blocked")
if (cmd === "rm" && (args.includes("/") || args.includes("/*")))
  throw new Error("blocked dangerous rm")
```

**依赖**: `web-tree-sitter` (AST 解析) + `shell-quote` (词法分析)

### 2.3 Shell Wrap

**文件**: `packages/opencode/src/tool/shell-wrap.ts` (新建，~190行)

支持多行脚本顺序执行，失败时停止后续命令。

---

## Phase 2d: Actor并发系统 (子智能体管理) **[新增]**

**目标**: 实现完整的Actor并发系统，支持子智能体管理、并发控制、生命周期管理。

### 2.1 核心模块

**文件清单**:
```
packages/opencode/src/actor/
├── actor.sql.ts        # Actor数据库表
├── events.ts           # Actor事件定义
├── index.ts            # 主入口
├── registry.ts         # Actor注册表
├── return-header.ts    # 返回头解析
├── schema.ts           # Schema定义
├── spawn-ref.ts        # 全局spawn注册表
├── spawn.ts            # Actor创建和执行
├── turn.ts             # 回合调度
└── waiter.ts           # Actor等待器
```

### 2.2 核心能力

| 能力 | 说明 |
|------|------|
| **Effect Fiber并发** | 轻量级、可中断、结构化并发 |
| **ForkContext共享** | 前缀缓存共享，子Agent继承父的System Prompt |
| **ActorWaiter** | 阻塞等待Actor完成，支持超时和结果快照 |
| **并发上限控制** | 全局16个并发Agent，生命周期1000个硬上限 |
| **生命周期管理** | ephemeral (临时) / persistent (持久) |
| **上下文继承** | none / state / full 三种模式 |

### 2.3 Actor生命周期

```
调用者发起 spawn()
  ├─→ ActorRegistry.register() → 写入 SQLite，广播 actor.registered 事件
  ├─→ runTurn() → 执行实际工作（runLoop）
  │     ├─→ 状态设为 running
  │     ├─→ 工作执行（可中断，期间 TaskGate 在 runLoop 中检查未完成任务）
  │     └─→ 状态设为 idle + lastOutcome
  ├─→ preStop hook（可选）→ 插件清理检查，可能触发 re-loop（MAX_PRE_REACT = 3）
  ├─→ postStop hook（可选）→ 进度写入、checkpoint 更新（MAX_POST_REACT = 3）
  └─→ outcome 写入 Deferred → 等待者收到结果
```

### 2.4 Subagent返回格式

所有子智能体的**最终消息**必须以固定头格式开始:

```markdown
**Status**: success | partial | failed | blocked
**Summary**: <one sentence describing what happened>

[实际交付内容...]

**Files touched**: <paths or "(none)">
**Findings worth promoting**: <bullet list or "(none)">
```

### 2.5 并发控制

| 层级 | 上限 | 说明 |
|------|------|------|
| 全局并发 Agent | 16（`DEFAULT_MAX_CONCURRENT`） | 软上限，工作流可覆盖 |
| 生命周期 Agent | 1000（`MAX_LIFECYCLE_AGENTS`） | 硬上限，防止资源耗尽 |
| 脚本超时 | 12h（`SCRIPT_DEADLINE_MS`） | 工作流脚本硬超时 |
| 子智能体 preStop | 3（`MAX_PRE_REACT`） | preStop hook 重试上限 |
| 子智能体 postStop | 3（`MAX_POST_REACT`） | postStop hook 重试上限 |

---

## Phase 2e: Task系统 (任务管理) **[新增]**

**目标**: 实现完整的任务管理，包括状态机、事件审计、自动归档。

### 2.1 核心模块

**文件清单**:
```
packages/opencode/src/task/
├── events.ts           # 任务事件
├── gate-state.ts       # Gate状态
├── gate.ts             # TaskGate (Stop-Gate ReAct)
├── index.ts            # 主入口
├── registry.ts         # 任务注册表
├── schema.ts           # Schema定义
└── task.sql.ts         # 任务数据库表
```

### 2.2 任务状态机

```
          create()
            │
            ▼
      ┌──────────┐
      │   open   │  ← 初始状态
      └────┬─────┘
           │ start()
           ▼
      ┌──────────┐
      │in_progress│ ← 正在执行
      └────┬─────┘
           │
    ┌──────┼──────┐
    │      │      │
    ▼      ▼      ▼
┌─────┐┌─────┐┌─────┐
│done ││block││abandon│
└─────┘└─────┘└─────┘
 终结态  非终结  终结态
```

### 2.3 核心能力

| 能力 | 说明 |
|------|------|
| **分层ID生成** | T1, T1.1, T1.1.1 支持任务层级 |
| **任务事件审计** | 每个状态变更记录到 `task_event` 表 |
| **自动归档** | 完成后N天自动归档（默认7天） |
| **TaskGate** | Stop-Gate ReAct，检查未完成任务决定是否re-loop |
| **任务属性** | priority/complexity/estimated_tokens/tags |

### 2.4 TaskGate决策逻辑

```typescript
type Decision =
  | { needReentry: false; capExceeded: false; incompleteTasks: [] }        // 全部完成
  | { needReentry: true; reentryText: string; incompleteTasks: string[]; capExceeded: false }  // 需重新进入
  | { needReentry: false; capExceeded: true; incompleteTasks: string[] }    // 超过上限
```

**安全阀**:
- `MAX_TASK_GATE_MAIN_REACT = 3`：主会话 Task Gate 上限
- `MAX_TASK_GATE_SUBAGENT_REACT = 2`：子智能体 Task Gate 上限

---

## Phase 2f: Goal系统 (目标驱动) **[新增]**

**目标**: 实现独立Judge模型评估目标，支持目标驱动执行。

### 2.1 核心模块

**文件**: `packages/opencode/src/session/goal.ts` (232行)

### 2.2 核心能力

| 能力 | 说明 |
|------|------|
| **独立Judge评估** | 使用独立模型（temperature=0）评估目标 |
| **完整上下文** | Judge看到完整对话transcript（包括tool calls/results） |
| **Verdict结构** | `ok/impossible/reason` 三元组 |
| **安全阀** | `MAX_GOAL_REACT = 12` 防止无限循环 |

### 2.3 Goal评估流程

1. **设置**: 用户通过 `/goal` 命令设置 `condition`
2. **触发**: `runLoop` 在每次 assistant step 后调用 `Goal.evaluate()`
3. **独立评估**: 使用**独立 Judge 模型**（temperature=0）
4. **完整上下文**: Judge 看到完整的对话历史（包括 tool calls/results）
5. **决策分支**:
   - `ok: true` → 停止 loop，返回结果
   - `impossible: true` → 清除 goal，向用户报告不可能
   - 否则 → `bumpReact()` 增加计数，继续 loop
6. **安全阀**: `MAX_GOAL_REACT = 12`，超过则强制停止

### 2.4 Judge Prompt

```
You are evaluating a stop-condition hook in Mimo Code. Read the conversation transcript carefully, then judge whether the user-provided condition is satisfied.

Your response must be a JSON object with one of these shapes:
- {"ok": true, "reason": "<quote evidence from the transcript>"}
- {"ok": false, "reason": "<quote what is missing>"}
- {"ok": false, "impossible": true, "reason": "<explain why unachievable>"}

Always include a "reason" field, quoting specific text from the transcript whenever possible.
```

---

## Phase 2g: 模式系统 (Build/Plan/Compose/Max/Loop) **[新增]**

**目标**: 实现完整的模式系统，支持可插拔模式，一步到位迁移所有模式。

### 2.1 模式概览

| 模式 | 检测条件 | 行为特征 |
|------|----------|----------|
| **Build** | `agent.name !== "plan"` 且无plan file | 默认模式，正常执行 |
| **Plan** | `agent.name === "plan"` | 只读操作，只允许编辑plan file |
| **Compose** | `agent === "compose"` | 注入compose skills，代码组合 |
| **Max** | `agent.name === "max"` + `maxModeCfg` | 5个候选+Judge选择最优 |
| **Loop** | 基于时间间隔自动触发 | auto-dream/auto-distill后台任务 |

### 2.2 核心模块

**文件清单**:
```
# 模式注册表
packages/opencode/src/session/mode-registry.ts      # 模式注册表核心

# Max模式
packages/opencode/src/session/max-mode.ts            # 候选生成+Judge

# Loop模式
packages/opencode/src/session/auto-dream.ts          # auto-dream/auto-distill触发

# 模式配置
packages/opencode/src/config/mode.ts                 # 模式配置Schema
```

### 2.3 Mode Registry接口

```typescript
interface ModeHandler {
  readonly id: string
  
  // 系统提示注入（Compose/Plan用）
  readonly buildSystemPrompt?: (ctx: BuildContext) => Effect.Effect<string>
  
  // 预处理：修改消息/注入额外内容（Compose/Plan用）
  readonly preprocess?: (ctx: ProcessContext) => Effect.Effect<ProcessContext>
  
  // 核心执行（Max用，其他模式用默认handle.process）
  readonly execute?: (ctx: ExecuteContext) => Effect.Effect<ExecuteResult>
  
  // 数据流闭环配置
  readonly evolutionConfig?: EvolutionConfig
}
```

### 2.4 Max模式详解

**文件**: `packages/opencode/src/session/max-mode.ts` (397行)

**核心流程**:
1. 一次生成 **5个候选**（可配置 `candidates`）
2. 每个候选**独立消费**上下文（5个并行LLM调用）
3. 候选使用 **"schema-only"工具**：只生成工具参数，不实际执行
4. Judge模型评估所有候选，选择最优者
5. 获胜者的工具调用通过"execute-bearing"工具实际执行

**关键函数**:
```typescript
// 运行单个候选
export const runCandidate = (input: MaxStepInput, index: number): Effect.Effect<Candidate | null>

// Judge评估
export const judge = (input: MaxStepInput, candidates: Candidate[]): Effect.Effect<{ pick: number; usage?: any }>

// 运行Max模式步骤
export const runMaxStep = (input: MaxStepInput): Effect.Effect<SessionProcessor.Result>
```

**降级策略**:
- 如果所有候选失败（0个存活），回退到普通的单个 `handle.process` 调用
- Judge解析失败时，默认选择第一个候选

### 2.5 Plan模式详解

**检测**: `agent.name === "plan"`

**行为约束**:
- 注入 `Plan mode is active` system-reminder，明确禁止执行（`MUST NOT make any edits`）
- 只允许 **READ-ONLY** 操作（`read`, `grep`, `glob`, `actor` 等）
- 唯一可编辑文件：plan file（`~/.mimocode/plans/`）
- 支持 `explore` 子智能体进行代码库探索（Phase 1）
- 支持 `plan` 子智能体进行设计（Phase 2）
- 支持用户通过 question 工具澄清需求

**Plan文件路径**: `Session.plan(input.session)` → `~/.mimocode/plans/<slug>/<timestamp>.md`

### 2.6 Compose模式详解

**检测**: 消息序列中存在 `agent === "compose"` 的user message

**行为**:
- 注入 `PROMPT_COMPOSE` 模板（`session/prompt/compose.txt`）
- 附加 `composeSkillsBlock()` 提取的compose技能描述
- 专注于代码片段的组合、拼接、重构

### 2.7 配置Schema

**文件**: `packages/opencode/src/config/mode.ts` (新建)

```json
{
  "modes": {
    "ask": {
      "enabled": true,
      "evolution": { "judgeEnabled": false, "traceExportEnabled": false, "evolutionEnabled": false }
    },
    "build": {
      "enabled": true,
      "evolution": { "judgeEnabled": true, "traceExportEnabled": true, "evolutionEnabled": true }
    },
    "plan": {
      "enabled": true,
      "evolution": { "judgeEnabled": true, "judgeChecks": ["security", "relevance"], "traceExportEnabled": true, "evolutionEnabled": true }
    },
    "compose": {
      "enabled": true,
      "evolution": { "judgeEnabled": true, "judgeChecks": ["security", "completeness"], "traceExportEnabled": true, "evolutionEnabled": true }
    },
    "max": {
      "enabled": true,
      "candidates": 5,
      "evolution": { "judgeEnabled": true, "traceExportEnabled": true, "evolutionEnabled": true }
    },
    "loop": {
      "enabled": true,
      "evolution": { "judgeEnabled": true, "traceExportEnabled": true, "evolutionEnabled": true }
    }
  }
}
```

---

## Phase 3a: Distill Agent (工作流蒸馏)

**目标**: 自动发现重复操作，生成 Skill/Agent/Command 文件。

### 3.1 Agent 定义

与 Dream 类似，但 prompt 不同。7 阶段工作流:

1. **定位数据**: SQLite + memory
2. **盘点现有资产**: glob 已有 SKILL.md / agent / command
3. **发现重复工作流**: 扫描 checkpoint/notes/MEMORY.md
4. **确认**: SQLite 查询 GROUP BY tool, input_preview, count
5. **短名单**: 按频率/置信度排序
6. **选择最小形式**: Skill / Agent / Command / Plugin / 跳过
7. **创建并验证**: 只创建高置信度的缺失项

### 3.2 系统提示词

**文件**: `packages/opencode/src/agent/prompt/distill.txt` (新建，~200行)

### 3.3 输出格式

| 形式 | 路径 | 用途 |
|------|------|------|
| Skill | `.opencode/skills/{name}/SKILL.md` | 工作流指令 |
| Agent | `.opencode/agents/{name}.md` | 自定义 subagent |
| Command | `.opencode/commands/{name}.md` | 斜杠命令 |
| Plugin hook | `.opencode/plugins/{name}.ts` | 生命周期钩子 |

---

## Phase 3b: Judge System (代码审查) + Max模式

**目标**: 启发式 + LLM 双层代码审查，防止安全/质量/回归问题。

### 3.1 Judge Agent (启发式)

**文件**: `packages/opencode/src/agent/judge-agent.ts` (新建，~630行)

8 项检查:
1. **断言减少**: expect/assert 行数减少 > 30% → 拒绝
2. **结构性变更**: 删除 test/it/describe 块 → 拒绝
3. **琐碎化**: `.toBe(x)` 替换为 `.toBeTruthy()` → 拒绝
4. **安全**: eval/exec/key 泄露 → 拒绝
5. **回归风险**: DROP TABLE/TRUNCATE/移除 export → 拒绝
6. **一致性**: camelCase/snake_case 混用 → 警告
7. **规格对齐**: 变更是否符合 spec → 评估
8. **声明门控**: "我修好了" 但无功能验证 → 拒绝

### 3.2 Max-Mode Judge (LLM 裁判)

**文件**: `packages/opencode/src/session/max-mode.ts` (见Phase 2g)

并行生成 N 个候选方案，LLM 裁判选择最佳:

```ts
export async function judge(candidates: Candidate[]): Promise<{ pick: number }>
// 输入: N 个候选 (reasoning + text + tool_calls)
// 输出: 胜出候选的索引
```

### 3.3 Candidate Scorer

**文件**: `packages/opencode/src/session/candidate-scorer.ts` (新建)

4 维评分:
- Judge 批准: 40%
- 文件数 (越少越好): 20%
- 测试通过率: 30%
- 风格一致性: 10%

### 3.4 Mode Registry

**文件**: `packages/opencode/src/session/mode-registry.ts` (见Phase 2g)

| Mode | judgeEnabled | judgeAction | judgeChecks |
|------|-------------|-------------|-------------|
| ask | false | - | - |
| build | true | inject | all |
| plan | true | warn | security, relevance |
| max | true | block | all |
| loop | true | inject | all |

---

## Phase 3c: Shadow Worktree (Git 隔离)

**目标**: 分支级 Git 隔离，成功自动提交 / 失败自动清理。

### 3.1 核心模块

**文件**: `packages/opencode/src/worktree/index.ts` (新建，~640行)

关键操作:
- `create()`: `git worktree add --no-checkout -b helixagent/<slug>`
- `remove()`: `git worktree remove --force` + `git branch -D`
- `reset()`: `git reset --hard <default-branch>` + `git clean -ffdx`
- `boot()`: `git reset --hard` + 启动脚本

### 3.2 垃圾回收

**文件**: `packages/opencode/src/worktree/gc.ts` (新建，~120行)

- 扫描 worktree 目录
- 检查 `.helixagent-lock` 文件中的 PID
- PID 已死 → 清理孤立 worktree

### 3.3 集成点

- Session 创建时可选择在 worktree 中执行
- 成功后: `git add -A && git commit`
- 失败后: `git clean -ffdx && git checkout main`

---

## Phase 3d: Cardinal系统 (风险控制) **[新增]**

**目标**: 运行时动态阻塞降级，四级风险控制。

### 3.1 核心模块

**文件**: `packages/opencode/src/session/cardinal.ts` (287行)

### 3.2 四级风险控制

| 级别 | 含义 | 处理方式 |
|------|------|----------|
| **block** | 严重风险，必须停止 | 立即终止，飞书通知 |
| **pause** | 中等风险，需确认 | 暂停，飞书等用户确认 |
| **stop** | 轻微风险，建议停止 | 停止，记录日志 |
| **warn** | 潜在风险，继续执行 | 警告，继续执行 |

### 3.3 5条默认规则

| 规则 | 级别 | 触发条件 |
|------|------|----------|
| **安全风险** | block | 检测到eval/exec/密钥泄露 |
| **过量改动** | pause | 改动文件数 > 预估文件数 × 2 |
| **连续失败** | pause | 同一任务失败3次 |
| **偏离目标** | stop | AlignmentGuard连续3次告警 |
| **Token超限** | warn | 单任务消耗 > 总预算的20% |

### 3.4 可扩展规则

```typescript
interface CardinalRule {
  readonly id: string
  readonly name: string
  readonly evaluate: (context: ExecutionContext) => Effect.Effect<CardinalDecision | null>
}

interface CardinalDecision {
  readonly level: "block" | "pause" | "stop" | "warn"
  readonly reason: string
  readonly suggestion?: string
}
```

---

## Phase 3e: AlignmentGuard (偏移检测) **[新增]**

**目标**: 实时偏移检测，通过Bus广播告警。

### 3.1 核心模块

**文件**: `packages/opencode/src/observability/alignment-guard.ts` (306行)

### 3.2 检测策略

| 检测类型 | 说明 | 触发条件 |
|----------|------|----------|
| **文件漂移** | 修改大量与Goal无关的文件 | `fileDriftThreshold = 5` |
| **兔子洞** | 连续执行安装命令 | npm/bun/git/pip/cargo install |
| **分心操作** | curl/wget/open/say等与任务无关操作 | 正则匹配 |

### 3.3 告警级别

- `warn`: 潜在风险，记录日志
- `critical`: 严重风险，广播告警

### 3.4 Inbox消息投递

```typescript
function tryDeliverToInbox(sid: string, suggestion: string) {
  const inbox = inboxServiceRef.current
  if (!inbox) return
  Effect.runSync(
    inbox
      .send({
        receiverSessionID: sid as SessionID,
        receiverActorID: "" as SessionID,
        senderActorID: "alignment-guard",
        content: `<alignment-guard notification="true">${suggestion}</alignment-guard>`,
        type: "actor_notification",
      })
      .pipe(Effect.catch(() => Effect.void)),
  )
}
```

---

## Phase 3f: Inbox系统 (Actor间通信) **[新增]**

**目标**: 实现Actor间异步消息传递。

### 3.1 核心模块

**文件清单**:
```
packages/opencode/src/inbox/
├── inbox-ref.ts        # Inbox引用
├── inbox.sql.ts        # Inbox数据库表
├── inbox.ts            # Inbox服务
├── index.ts            # 主入口
└── render.ts           # 消息渲染
```

### 3.2 核心能力

| 能力 | 说明 |
|------|------|
| **send** | 发送消息到指定Actor |
| **receive** | 接收消息 |
| **消息类型** | `actor_notification` 等 |
| **AlignmentGuard集成** | 通过inbox发送纠偏消息 |

---

## Phase 3g: History系统 (跨会话搜索) **[新增]**

**目标**: 实现跨会话历史搜索，支持FTS5全文检索。

### 3.1 核心模块

**文件清单**:
```
packages/opencode/src/history/
├── backfill.ts         # 回填逻辑
├── extract.ts          # 提取逻辑
├── fts-query.ts        # FTS查询构建
├── fts.sql.ts          # FTS数据库表
├── index.ts            # 主入口
├── resolve.ts          # 解析逻辑
├── service.ts          # History服务
└── writer.ts           # 写入逻辑
```

### 3.2 核心能力

| 能力 | 说明 |
|------|------|
| **search** | FTS5跨会话历史搜索 |
| **around** | 获取消息前后上下文 |
| **按类型过滤** | user_text/assistant_text/tool_input/tool_error/reasoning/tool_output |
| **按工具过滤** | 过滤特定工具的调用 |
| **时间范围** | 支持time_after/time_before |

### 3.3 History Tool

```typescript
{
  id: "history",
  description: "Search historical sessions and conversations.",
  parameters: z.object({
    operation: z.enum(["search", "around"]),
    query: z.string().optional(),
    scope: z.enum(["project", "global"]).optional(),
    session_id: z.string().optional(),
    kind: z.array(KIND).optional(),
    tool_name: z.string().optional(),
    time_after: z.number().optional(),
    time_before: z.number().optional(),
    limit: z.number().optional(),
    message_id: z.string().optional(),
    before: z.number().optional(),
    after: z.number().optional(),
  }),
}
```

---

## Phase 3h: 工具补充 **[新增]**

**目标**: 补充Helix中的特色工具。

### 3.1 工具清单

| 工具 | 文件 | 说明 |
|------|------|------|
| **Actor工具** | `tool/actor.ts` | run/spawn/status/wait/cancel/send |
| **Workflow工具** | `tool/workflow.ts` | run/status/wait/cancel/resume |
| **History工具** | `tool/history.ts` | search/around 操作 |
| **MultiEdit工具** | `tool/multiedit.ts` | 批量文件编辑 |
| **Screenshot工具** | `tool/screenshot.ts` | 桌面截图+视觉分析 |
| **Shell Tokenize** | `tool/shell-tokenize.ts` | Shell词法分析 |
| **Shell Wrap** | `tool/shell-wrap.ts` | Shell包装器 |

### 3.2 Actor工具详解

**文件**: `packages/opencode/src/tool/actor.ts` (803行)

**操作**:
- `run`: 同步运行子智能体，等待完成
- `spawn`: 异步启动子智能体，立即返回
- `status`: 查询子智能体状态
- `wait`: 等待子智能体完成
- `cancel`: 取消子智能体
- `send`: 向子智能体发送消息

### 3.3 Workflow工具详解

**文件**: `packages/opencode/src/tool/workflow.ts` (166行)

**操作**:
- `run`: 运行工作流（内置或自定义脚本）
- `status`: 查询工作流状态
- `wait`: 等待工作流完成
- `cancel`: 取消工作流
- `resume`: 恢复工作流

### 3.4 Screenshot工具详解

**文件**: `packages/opencode/src/tool/screenshot.ts` (52行)

**能力**:
- 截取当前桌面/浏览器屏幕
- 送入视觉模型分析
- 需要支持视觉输入的模型（MiMo 2.5、Claude、GPT-4o）

---

## Phase 4: Evolution Flywheel (自我进化)

**目标**: 自动化持续改进闭环。

### 4.1 组件架构

```
A. 测试用例生成器 (generate_cases.ts)
   ↓
B. 启发式过滤器 / 脏数据清洗 (heuristic-filter.ts)
   ↓
C. DSPy 离线 Prompt 优化器 (optimize_prompt.ts)
   ↓
D. DPO 数据集导出 (export_dpo.ts)
   ↓
E. 回归验证 (beta_evolution_loop.ts)
```

### 4.2 实现

| 文件 | 职责 |
|------|------|
| `script/dogfooding/generate_cases.ts` | 每日扩展 50+ 对抗性用例 |
| `script/dogfooding/optimize_prompt.ts` | 从失败 trace 提取规则 → 追加到 AGENTS.md |
| `script/dogfooding/export_dpo.ts` | 匹配成功/失败 trace → Judge 门控 → JSONL |
| `script/dogfooding/auto-export.ts` | 自动化 DPO 导出 (每日去重) |
| `script/dogfooding/beta_evolution_loop.ts` | 运行测试 → 保存 trace → 验证结果 |
| `script/dogfooding/setup_local_cron.sh` | macOS launchd 定时任务 |

### 4.3 Judge 门控 (防作弊)

DPO 导出时的 3 条过滤规则:
1. 断言数量减少 (删除断言来作弊) → 丢弃
2. 代码量下降到 rejected 的 30% 以下 (删除所有逻辑) → 丢弃
3. 差异太小 (< 5 字符) → 丢弃

---

## Phase 4b: Token Tracker (预算管理) **[新增]**

**目标**: 实现Token使用追踪和预算管理。

### 4.1 核心模块

**文件清单**:
```
packages/opencode/src/token/
├── index.ts            # 主入口
├── token.sql.ts        # Token数据库表
└── tracker.ts          # Token追踪器
```

### 4.2 核心能力

| 能力 | 说明 |
|------|------|
| **recordUsage** | 记录每个session/task的token消耗 |
| **getDailyBudget** | 获取每日预算 |
| **allocateTokens** | 按任务分配token预算 |
| **getTaskUsage** | 获取任务token使用量 |
| **getUsageStats** | 获取使用统计 |
| **canAfford** | 检查是否足够token |

### 4.3 配置

```json
{
  "token_budget": {
    "daily_limit": 1000000
  }
}
```

---

## Phase 4c: Metrics系统 (性能指标) **[新增]**

**目标**: 实现性能指标收集。

### 4.1 核心模块

**文件清单**:
```
packages/opencode/src/metrics/
├── client.ts           # Metrics客户端
├── event.ts            # Metrics事件定义
├── index.ts            # 主入口
├── installation.ts     # 安装指标
├── subscriber.ts       # 指标订阅
└── util.ts             # 工具函数
```

### 4.2 指标类型

| 指标 | 说明 |
|------|------|
| **ModelCall** | TTFT、延迟、缓存命中、token数 |
| **ToolCall** | 输入/输出字节、成功/失败 |
| **AgentRequest** | 阶段、任务类型、文件变更数 |

---

## Phase 4d: Workflow引擎 (工作流执行) **[新增]**

**目标**: 实现JavaScript/JSON工作流脚本执行。

### 4.1 核心模块

**文件清单**:
```
packages/opencode/src/workflow/
├── builtin.ts          # 内置工作流
├── builtin/            # 内置工作流目录
├── events.ts           # 工作流事件
├── meta.ts             # 元数据
├── persistence.ts      # 持久化
├── resolve.ts          # 解析逻辑
├── runtime-ref.ts      # 运行时引用
├── runtime.ts          # 运行时核心
├── sandbox.ts          # 沙箱
├── vfs-sandbox.ts      # VFS沙箱
├── workflow.sql.ts     # 工作流数据库表
└── workspace.ts        # 工作区
```

### 4.2 核心能力

| 能力 | 说明 |
|------|------|
| **JavaScript/JSON脚本** | 支持声明式DAG和脚本式工作流 |
| **内置工作流** | `deep-research` 深度研究工作流 |
| **VFS沙箱** | 内存Copy-on-Write虚拟文件系统 |
| **并发信号量** | `DEFAULT_MAX_CONCURRENT = 16` |
| **取消传播** | 父工作流取消时递归取消所有子运行 |
| **Agent生命周期** | `MAX_LIFECYCLE_AGENTS = 1000` |

### 4.3 运行时参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `SCRIPT_DEADLINE_MS` | 12h | 脚本硬超时（研究类工作流默认） |
| `DEFAULT_MAX_CONCURRENT` | 16 | 并发 Agent 软上限 |
| `MAX_LIFECYCLE_AGENTS` | 1000 | 生命周期内 Agent 总数硬上限 |

---

## Phase 4e: Trace机制 (执行追踪) **[新增]**

**目标**: 实现完整的执行追踪系统，支持trace记录、过滤、可视化，为Evolution Flywheel提供数据基础。

### 4.1 Helix vs HelixAgent对比

| 能力 | Helix | HelixAgent | 差距 |
|------|-------|------------|------|
| **TraceReporter** | 完整的trace事件系统 | 只有简单的JSONL trace | ❌ 缺失 |
| **TraceNodeEvent** | 类型安全的事件定义 | 无 | ❌ 缺失 |
| **HeuristicFilter** | 脏数据过滤 | 无 | ❌ 缺失 |
| **树状结构可视化** | formatTree() | 无 | ❌ 缺失 |
| **采样支持** | samplingEnabled/samplingRate | 无 | ❌ 缺失 |
| **最大trace限制** | maxTraces配置 | 无 | ❌ 缺失 |
| **Bus事件集成** | 完整集成 | 无 | ❌ 缺失 |
| **Debug日志系统** | 完整的Log系统(DEBUG/INFO/WARN/ERROR) | 只有简单JSONL trace | ❌ 缺失 |
| **日志级别控制** | MIMOCODE_LOG_LEVEL环境变量 | OPENCODE_DIRECT_TRACE环境变量 | ❌ 缺失 |
| **日志文件管理** | 自动清理、保留最近10个 | 无自动清理 | ❌ 缺失 |
| **模块级debug日志** | 30+个模块有debug日志 | 只有trace.ts | ❌ 缺失 |

### 4.2 核心模块

**文件清单**:
```
packages/opencode/src/observability/
├── trace-reporter.ts       # TraceReporter服务 (213行)
├── heuristic-filter.ts     # HeuristicFilter服务 (119行)
└── alignment-guard.ts      # AlignmentGuard服务 (已有)
```

### 4.3 TraceReporter核心能力

**文件**: `packages/opencode/src/observability/trace-reporter.ts`

```typescript
// TraceNodeEvent定义
export const TraceNodeEvent = BusEvent.define(
  "observability.trace_node",
  z.object({
    id: z.string(),
    parentId: z.string().optional(),
    type: z.enum(["node_start", "node_end", "action", "decision", "error"]),
    name: z.string(),
    status: z.enum(["pending", "success", "failed"]),
    duration: z.number().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.number()
  })
)

// TraceReporter接口
export interface Interface {
  readonly getTraces: () => Effect.Effect<TraceEvent[]>
  readonly emitTrace: (trace: Omit<TraceEvent, "timestamp">) => Effect.Effect<void>
  readonly getConfig: () => Effect.Effect<TraceConfig>
  readonly updateConfig: (config: Partial<TraceConfig>) => Effect.Effect<void>
}

// 配置
export interface TraceConfig {
  samplingEnabled: boolean      // 是否启用采样
  samplingRate: number          // 采样率 (0.0 - 1.0)
  maxTraces: number             // 最大保留trace数量
}
```

### 4.4 HeuristicFilter核心能力

**文件**: `packages/opencode/src/observability/heuristic-filter.ts`

**脏数据过滤模式**:
```typescript
const DIRTY_PATTERNS = [
  // 基础设施错误
  /timeout/i,
  /killed\s+by\s+signal/i,
  /out\s+of\s+memory/i,
  /heap\s+limit/i,
  /enomem/i,
  /econnreset/i,
  /etimedout/i,
  /socket\s+hang\s+up/i,
  /network\s+error/i,
  /toolinterceptor\s+blocked/i,

  // API/限流错误
  /rate\s*limit/i,
  /quota\s*exceeded/i,
  /too\s*many\s*requests/i,
  /429/,

  // 资源错误
  /insufficient\s*funds/i,
  /billing/i,
  /payment\s*required/i,

  // 模型错误
  /model\s*overloaded/i,
  /server\s*overloaded/i,
  /service\s*unavailable/i,
  /503/,

  // 上下文错误
  /context\s*length\s*exceeded/i,
  /max\s*tokens\s*exceeded/i,
  /token\s*limit/i,
]
```

**退出码检查**:
- `exitCode === 137`: OOM/SigKill → 过滤
- `exitCode === 124`: Timeout → 过滤

### 4.5 Trace树状可视化

```typescript
export function formatTree(events: TraceEvent[]): string {
  // 构建树状结构
  // 渲染格式:
  // ├── ✓ node_start (1.2s)
  // │   ├── [tool] bash (500ms)
  // │   │   └── ✓ read (100ms)
  // │   └── [decide] evaluate (200ms)
  // └── ✗ error (50ms)
  //
  // Total: 2.1s | 5 events | ✓4 ✗1
}
```

### 4.6 Trace覆盖提升计划

**当前覆盖** (HelixAgent):
- session: 基础trace
- tool: 无trace
- llm: 无trace
- actor: 无trace
- workflow: 无trace

**目标覆盖** (Helix):
| 模块 | 目标覆盖率 | 优先级 |
|------|-----------|--------|
| session | 100% | P0 |
| tool | 100% | P0 |
| llm | 100% | P0 |
| actor | 100% | P1 |
| task | 100% | P1 |
| workflow | 100% | P1 |
| memory | 100% | P2 |
| agent | 100% | P2 |

### 4.7 Trace埋点位置

**Session模块**:
```typescript
// session/prompt.ts
yield* traceReporter.emitTrace({
  id: `session-${sessionID}`,
  type: "node_start",
  name: "session.prompt",
  status: "pending"
})

// session/processor.ts
yield* traceReporter.emitTrace({
  id: `processor-${sessionID}`,
  parentId: `session-${sessionID}`,
  type: "action",
  name: "llm.stream",
  status: "success",
  duration: Date.now() - startTime,
  metadata: { model, tokens }
})
```

**Tool模块**:
```typescript
// tool/bash.ts
yield* traceReporter.emitTrace({
  id: `bash-${callID}`,
  parentId: `session-${sessionID}`,
  type: "action",
  name: "bash.execute",
  status: exitCode === 0 ? "success" : "failed",
  duration: Date.now() - startTime,
  metadata: { command, exitCode, output: output.slice(0, 1000) }
})
```

**Actor模块**:
```typescript
// actor/spawn.ts
yield* traceReporter.emitTrace({
  id: `actor-${actorID}`,
  parentId: `session-${sessionID}`,
  type: "node_start",
  name: "actor.spawn",
  status: "pending",
  metadata: { agentType, task }
})

// actor/waiter.ts
yield* traceReporter.emitTrace({
  id: `actor-${actorID}`,
  type: "node_end",
  name: "actor.complete",
  status: outcome === "success" ? "success" : "failed",
  duration: Date.now() - startTime,
  metadata: { outcome, result: resultSummary }
})
```

### 4.7.1 Debug日志系统 **[重要补充]**

**目标**: 实现完整的Debug日志系统，支持开发和使用过程中的问题排查。

**文件**: `packages/opencode/src/util/log.ts` (204行)

**核心能力**:

```typescript
// 日志级别
export const Level = z.enum(["DEBUG", "INFO", "WARN", "ERROR"])

// 日志接口
export type Logger = {
  debug(message?: any, extra?: Record<string, any>): void
  info(message?: any, extra?: Record<string, any>): void
  error(message?: any, extra?: Record<string, any>): void
  warn(message?: any, extra?: Record<string, any>): void
  tag(key: string, value: string): Logger
  clone(): Logger
  time(message: string, extra?: Record<string, any>): { stop(): void }
}
```

**日志格式**:
```
2026-06-29T12:00:00 +0ms service=session prompt tool execute start {tool: "bash", command: "ls"}
```

**日志级别控制**:
```bash
# 设置日志级别
export MIMOCODE_LOG_LEVEL=DEBUG  # DEBUG/INFO/WARN/ERROR

# 运行时查看日志
tail -f ~/.local/share/opencode/log/dev.log
```

**日志文件管理**:
- 开发模式: `dev.log` (保留上一次的 `dev.log.<timestamp>`)
- 生产模式: `<timestamp>.log` (自动清理，保留最近10个)

**各模块Debug日志点** (30+个):

| 模块 | Debug日志点 | 说明 |
|------|------------|------|
| **session/llm.ts** | `log.debug("retry attempt", ...)` | LLM重试 |
| **session/prompt.ts** | `log.debug("tool execute start/done/rejected", ...)` | 工具执行 |
| **session/goal.ts** | `elog.debug("goal judge transcript", ...)` | Goal评估 |
| **config/config.ts** | `log.debug("loading config from...", ...)` | 配置加载 |
| **provider/provider.ts** | `log.debug("provider.getModel", ...)` | 模型获取 |
| **tool/tool.ts** | `log.debug("tool.init", ...)` | 工具初始化 |
| **observability/trace-reporter.ts** | `log.debug("trace.event.received", ...)` | Trace事件 |
| **mcp/index.ts** | `log.debug("transport connection failed", ...)` | MCP连接 |
| **acp/agent.ts** | `log.debug("replay message", ...)` | 消息重放 |
| **file/index.ts** | `log.debug("shouldEncode", ...)` | 文件编码 |

**Debug Trace与日志的关系**:

```
Debug Trace (JSONL)          Debug日志 (log.ts)
├── OPENCODE_DIRECT_TRACE    ├── MIMOCODE_LOG_LEVEL
├── 完整事件流               ├── 模块级debug信息
├── 开发调试用               ├── 生产环境排查用
└── ~/.local/share/opencode  └── ~/.local/share/opencode
    /log/direct/                 /log/
```

**Debug排查流程**:

1. **开发阶段**: 使用 `OPENCODE_DIRECT_TRACE=1` 启用完整trace
   ```bash
   OPENCODE_DIRECT_TRACE=1 bun dev
   # 查看trace
   cat ~/.local/share/opencode/log/direct/latest.json
   ```

2. **生产排查**: 使用 `MIMOCODE_LOG_LEVEL=DEBUG` 启用debug日志
   ```bash
   MIMOCODE_LOG_LEVEL=DEBUG bun dev
   # 查看日志
   tail -f ~/.local/share/opencode/log/dev.log
   ```

3. **问题定位**: 结合trace和日志
   ```bash
   # 查看特定模块的debug日志
   grep "service=session" ~/.local/share/opencode/log/dev.log | grep "DEBUG"
   
   # 查看特定时间范围的日志
   grep "2026-06-29T12:" ~/.local/share/opencode/log/dev.log
   ```

**Debug日志配置**:

**文件**: `packages/opencode/src/config/debug.ts` (新建)

```typescript
export const Info = Schema.Struct({
  logLevel: Schema.optional(Schema.Enums(["DEBUG", "INFO", "WARN", "ERROR"])).annotate({
    description: "Log level (default: INFO, override with MIMOCODE_LOG_LEVEL)"
  }),
  traceEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable JSONL trace (default: false, override with OPENCODE_DIRECT_TRACE)"
  }),
  traceRetentionDays: Schema.optional(Schema.Number).annotate({
    description: "Trace file retention days (default: 7)"
  })
})
```

**配置示例**:
```json
{
  "debug": {
    "logLevel": "INFO",
    "traceEnabled": false,
    "traceRetentionDays": 7
  }
}
```

**日志轮转策略**:

| 文件类型 | 保留策略 | 清理周期 |
|----------|----------|----------|
| `dev.log` | 保留上一次的timestamp备份 | 每次启动 |
| `<timestamp>.log` | 保留最近10个 | 每次启动 |
| `direct/*.jsonl` | 保留最近7天 | 每天 |

### 4.8 Trace数据持久化

**数据库表**:
```sql
CREATE TABLE trace_events (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  duration INTEGER,
  metadata TEXT,  -- JSON
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_trace_events_session ON trace_events(session_id);
CREATE INDEX idx_trace_events_parent ON trace_events(parent_id);
CREATE INDEX idx_trace_events_timestamp ON trace_events(timestamp);
```

### 4.9 Trace配置

**文件**: `packages/opencode/src/config/trace.ts` (新建)

```typescript
export const Info = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable trace recording (default: true)"
  }),
  sampling: Schema.optional(Schema.Struct({
    enabled: Schema.Boolean,
    rate: Schema.Number  // 0.0 - 1.0
  })).annotate({
    description: "Sampling configuration"
  }),
  maxTraces: Schema.optional(Schema.Number).annotate({
    description: "Maximum traces to keep in memory (default: 10000)"
  }),
  persistence: Schema.optional(Schema.Struct({
    enabled: Schema.Boolean,
    retentionDays: Schema.Number  // 保留天数
  })).annotate({
    description: "Persistence configuration"
  })
})
```

**配置示例**:
```json
{
  "observability": {
    "trace": {
      "enabled": true,
      "sampling": {
        "enabled": false,
        "rate": 1.0
      },
      "maxTraces": 10000,
      "persistence": {
        "enabled": true,
        "retentionDays": 30
      }
    }
  }
}
```

### 4.10 Trace查询API

```typescript
// 按session查询trace
const traces = await traceReporter.getBySession(sessionID)

// 按时间范围查询
const traces = await traceReporter.getByTimeRange(startTime, endTime)

// 按状态查询失败的trace
const failedTraces = await traceReporter.getByStatus("failed")

// 获取trace树
const tree = TraceReporter.formatTree(traces)

// 导出trace为JSONL
const jsonl = TraceReporter.exportJsonl(traces)
```

### 4.11 Trace与Evolution Flywheel集成

**数据流**:
```
执行 → Trace记录 → HeuristicFilter过滤 → 持久化 → DPO导出 → 进化学习
```

**集成点**:
```typescript
// script/dogfooding/export_dpo.ts
const traces = await traceReporter.getByTimeRange(startTime, endTime)
const cleanTraces = await heuristicFilter.sanitize(traces)

// 匹配成功/失败trace
const chosen = cleanTraces.filter(t => t.status === "success")
const rejected = cleanTraces.filter(t => t.status === "failed")

// 导出DPO数据集
for (const pair of matchPairs(chosen, rejected)) {
  await writeJsonl(pair)
}
```

### 4.12 验收标准

| 检查项 | 验收标准 |
|--------|----------|
| Trace记录 | 所有关键操作都有trace记录 |
| Trace过滤 | HeuristicFilter正确过滤脏数据 |
| Trace可视化 | formatTree()正确渲染树状结构 |
| Trace采样 | 采样率配置生效 |
| Trace持久化 | trace正确写入数据库 |
| Trace查询 | 按session/时间/状态查询正确 |
| Trace集成 | DPO导出正确使用trace数据 |

### 4.13 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | TraceNodeEvent定义 | 本地事件 | 事件类型正确 |
| **单元测试** | HeuristicFilter过滤 | 本地模式匹配 | 正确过滤脏数据 |
| **单元测试** | formatTree渲染 | 本地计算 | 树状结构正确 |
| **单元测试** | 日志级别控制 | 本地配置 | DEBUG/INFO/WARN/ERROR正确过滤 |
| **单元测试** | 日志格式 | 本地计算 | 包含时间戳、级别、service、消息 |
| **集成测试** | Trace记录 | 真实执行 | 正确记录trace |
| **集成测试** | Trace采样 | 真实执行 | 采样率生效 |
| **集成测试** | Debug日志输出 | 真实执行 | MIMOCODE_LOG_LEVEL生效 |
| **集成测试** | 日志文件生成 | 真实执行 | 文件正确生成到指定目录 |
| **端到端** | Trace与DPO集成 | 真实LLM + Trace | DPO导出正确 |
| **端到端** | Debug排查流程 | 真实LLM + Debug | 能定位问题 |

### 4.14 LLM驱动验证脚本

```typescript
// test/e2e/trace-e2e.test.ts
describe("Trace E2E", () => {
  it("should record traces for all operations", async () => {
    // 1. 执行操作
    await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ type: "text", text: "Create a hello world file" }]
    })
    
    // 2. 获取trace
    const traces = await traceReporter.getBySession(session.id)
    
    // 3. 验证trace记录
    expect(traces.length).toBeGreaterThan(0)
    expect(traces).toContainEqual(
      expect.objectContaining({
        name: "session.prompt",
        status: "success"
      })
    )
    
    // 4. 验证trace包含tool调用
    const toolTraces = traces.filter(t => t.type === "action")
    expect(toolTraces.length).toBeGreaterThan(0)
  })
  
  it("should filter dirty traces", async () => {
    // 1. 创建脏数据trace
    await traceReporter.emitTrace({
      id: "dirty-1",
      type: "error",
      name: "bash.execute",
      status: "failed",
      metadata: { error: "Connection timeout" }
    })
    
    // 2. 验证被过滤
    const decision = await heuristicFilter.evaluate({
      id: "dirty-1",
      type: "error",
      name: "bash.execute",
      status: "failed",
      metadata: { error: "Connection timeout" },
      timestamp: Date.now()
    })
    expect(decision.shouldKeep).toBe(false)
  })
  
  it("should render trace tree correctly", async () => {
    // 1. 创建trace事件
    const events = [
      { id: "1", type: "node_start", name: "session", status: "success", timestamp: 1000 },
      { id: "2", parentId: "1", type: "action", name: "bash", status: "success", duration: 500, timestamp: 1100 },
      { id: "3", parentId: "1", type: "action", name: "read", status: "success", duration: 100, timestamp: 1200 }
    ]
    
    // 2. 渲染树
    const tree = TraceReporter.formatTree(events)
    
    // 3. 验证格式
    expect(tree).toContain("✓ session")
    expect(tree).toContain("[tool] bash")
    expect(tree).toContain("[tool] read")
    expect(tree).toContain("Total:")
  })
  
  it("should control debug log level", async () => {
    // 1. 设置日志级别
    process.env.MIMOCODE_LOG_LEVEL = "DEBUG"
    
    // 2. 创建logger
    const log = Log.create({ service: "test" })
    
    // 3. 验证debug日志输出
    const spy = vi.spyOn(process.stderr, 'write')
    log.debug("test message", { key: "value" })
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("DEBUG")
    )
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("test message")
    )
    
    // 4. 清理
    delete process.env.MIMOCODE_LOG_LEVEL
  })
  
  it("should generate log file correctly", async () => {
    // 1. 初始化日志系统
    await Log.init({ print: false, dev: true })
    
    // 2. 写入日志
    const log = Log.create({ service: "test" })
    log.info("test log entry")
    
    // 3. 验证日志文件存在
    const logFile = Log.file()
    expect(fs.existsSync(logFile)).toBe(true)
    
    // 4. 验证日志内容
    const content = fs.readFileSync(logFile, 'utf-8')
    expect(content).toContain("test log entry")
    expect(content).toContain("service=test")
  })
})
```

---

## Phase 5: Auto-Dev Scheduler (自动开发)

**目标**: 无人值守的自动开发流水线。

### 5.1 流水线

```
roadmap.json → 任务选择 → 预检 → 执行 → Judge → 构建 → 类型检查
→ 测试 → Lint → 规约写入 → Git 提交 → 通知
```

### 5.2 核心模块

| 文件 | 职责 |
|------|------|
| `script/auto-dev/scheduler.ts` | 主调度器: 读 roadmap → 选任务 → 执行 |
| `script/auto-dev/pipeline.ts` | 流水线编排: 每个阶段的执行与验证 |
| `script/auto-dev/roadmap.ts` | Roadmap 解析与任务管理 |
| `script/auto-dev/notify.ts` | 完成通知 (可选: Slack/Feishu) |
| `script/auto-dev/setup_cron.sh` | 定时任务配置 |

### 5.3 预算感知

- 每日 token 预算上限
- 单任务 token 上限
- 重试逻辑 (指数退避)

---

## Phase 5b: Team系统 (团队协作) **[新增]**

**目标**: 实现团队协作能力。

### 5.1 核心模块

**文件清单**:
```
packages/opencode/src/team/
├── events.ts           # Team事件
├── index.ts            # 主入口
└── schema.ts           # Schema定义
```

### 5.2 核心能力

| 能力 | 说明 |
|------|------|
| **create** | 创建团队 |
| **addMember** | 添加成员 |
| **removeMember** | 移除成员 |
| **getMembers** | 获取成员列表 |
| **teamDir** | 获取团队目录 |

---

## Phase 5c: AST Graph (代码分析) **[新增]**

**目标**: 实现代码依赖分析。

### 5.1 核心模块

**文件**: `packages/opencode/src/ast/graph.ts` (133行)

### 5.2 核心能力

| 能力 | 说明 |
|------|------|
| **getBlastRadius** | 获取文件变更的影响范围 |
| **getContract** | 提取文件的导出接口 |

---

## Phase 5d: 插件补充 **[新增]**

**目标**: 补充Helix中的特色插件。

### 5.1 插件清单

| 插件 | 文件 | 说明 |
|------|------|------|
| **Checkpoint Splitover** | `plugin/checkpoint-splitover.ts` | 检查点分割验证 |
| **Subagent Progress Checker** | `plugin/subagent-progress-checker.ts` | 子智能体进度检查 |

### 5.2 Checkpoint Splitover插件

**功能**: 在checkpoint-writer完成前验证检查点质量

**检查项**:
- 检查点结构完整性
- 必需章节是否存在
- 提取必需的章节

### 5.3 Subagent Progress Checker插件

**功能**: 在子智能体完成前验证进度日志

**必需章节**:
```
## §1 Task identity
## §2 Subagent intent
## §3 Files and code sections
## §4 Verbatim commands
## §5 Outcome and discoveries
```

---

## Phase 5e: 配置补充 **[新增]**

**目标**: 补充Helix中的特色配置。

### 5.1 配置清单

| 配置 | 文件 | 说明 |
|------|------|------|
| **Skills配置** | `config/skills.ts` | 技能路径和URL配置 |
| **History配置** | `config/history.ts` | 历史搜索类型配置 |

### 5.2 Skills配置

```typescript
export const Info = Schema.Struct({
  paths: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Additional paths to skill folders",
  }),
  urls: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)",
  }),
})
```

### 5.3 History配置

```typescript
export const Info = Schema.Struct({
  kinds: Schema.optional(Schema.Array(Kind)).annotate({
    description: "Which part kinds the history FTS index should cover.",
  }),
})
```

---

## 实施时间线

| 阶段 | 预计工时 | 优先级 | 依赖 |
|------|---------|--------|------|
| Phase 1: Memory Layer | 3-4 天 | P0 | 无 |
| Phase 2a: Dream Agent + Loop模式 | 2 天 | P0 | Phase 1 |
| Phase 2b: Checkpoint Writer | 3 天 | P1 | Phase 1 |
| Phase 2c: Shell Safety | 1-2 天 | P1 | 无 |
| Phase 2d: Actor并发系统 | 3-4 天 | P0 | 无 |
| Phase 2e: Task系统 | 2-3 天 | P0 | Phase 2d |
| Phase 2f: Goal系统 | 1-2 天 | P0 | 无 |
| Phase 2g: 模式系统 | 2-3 天 | P0 | 无 |
| Phase 3a: Distill Agent | 2 天 | P1 | Phase 1, 2a |
| Phase 3b: Judge System + Max模式 | 3-4 天 | P1 | 无 |
| Phase 3c: Shadow Worktree | 2-3 天 | P2 | 无 |
| Phase 3d: Cardinal系统 | 1-2 天 | P1 | 无 |
| Phase 3e: AlignmentGuard | 1-2 天 | P1 | 无 |
| Phase 3f: Inbox系统 | 1 天 | P1 | Phase 2d |
| Phase 3g: History系统 | 2 天 | P1 | 无 |
| Phase 3h: 工具补充 | 2 天 | P1 | Phase 2d |
| Phase 4: Evolution Flywheel | 3-4 天 | P2 | Phase 3b |
| Phase 4b: Token Tracker | 1-2 天 | P2 | 无 |
| Phase 4c: Metrics系统 | 1 天 | P2 | 无 |
| Phase 4d: Workflow引擎 | 3-4 天 | P2 | Phase 2d |
| **Phase 4e: Trace机制** | 2-3 天 | P1 | 无 |
| Phase 5: Auto-Dev Scheduler | 2-3 天 | P3 | Phase 4 |
| Phase 5b: Team系统 | 1-2 天 | P3 | 无 |
| Phase 5c: AST Graph | 1 天 | P3 | 无 |
| Phase 5d: 插件补充 | 1 天 | P3 | Phase 2e |
| Phase 5e: 配置补充 | 0.5 天 | P3 | 无 |

**总计**: ~44-61 天

---

## 文件清单 (新建/修改)

### 新建文件 (80+个)

```
# Phase 1: Memory Layer
packages/core/src/memory/sql.ts
packages/core/src/memory/service.ts
packages/core/src/memory/paths.ts
packages/core/src/memory/fts-query.ts
packages/core/src/memory/reconcile.ts
packages/core/src/memory/memory-decay.ts
packages/core/src/memory/vec-store.ts
packages/core/src/memory/embedder.ts
packages/core/src/memory/semantic-hash.ts
packages/core/src/memory/index.ts
packages/core/src/config/memory.ts
packages/opencode/src/tool/memory.ts
packages/opencode/src/tool/memory.txt

# Phase 2a: Dream Agent + Loop模式
packages/opencode/src/session/auto-dream.ts
packages/opencode/src/agent/prompt/dream.txt
packages/opencode/src/agent/system-agents.ts

# Phase 2b: Checkpoint Writer
packages/opencode/src/session/checkpoint.ts
packages/opencode/src/session/checkpoint-paths.ts
packages/opencode/src/session/checkpoint-templates.ts
packages/opencode/src/session/checkpoint-retry.ts
packages/opencode/src/agent/prompt/checkpoint-writer.txt

# Phase 2c: Shell Safety
packages/opencode/src/tool/shell-tokenize.ts
packages/opencode/src/tool/shell-wrap.ts

# Phase 2d: Actor并发系统
packages/opencode/src/actor/actor.sql.ts
packages/opencode/src/actor/events.ts
packages/opencode/src/actor/index.ts
packages/opencode/src/actor/registry.ts
packages/opencode/src/actor/return-header.ts
packages/opencode/src/actor/schema.ts
packages/opencode/src/actor/spawn-ref.ts
packages/opencode/src/actor/spawn.ts
packages/opencode/src/actor/turn.ts
packages/opencode/src/actor/waiter.ts

# Phase 2e: Task系统
packages/opencode/src/task/events.ts
packages/opencode/src/task/gate-state.ts
packages/opencode/src/task/gate.ts
packages/opencode/src/task/index.ts
packages/opencode/src/task/registry.ts
packages/opencode/src/task/schema.ts
packages/opencode/src/task/task.sql.ts

# Phase 2f: Goal系统
packages/opencode/src/session/goal.ts

# Phase 2g: 模式系统
packages/opencode/src/session/mode-registry.ts
packages/opencode/src/session/max-mode.ts
packages/opencode/src/config/mode.ts

# Phase 3a: Distill Agent
packages/opencode/src/agent/prompt/distill.txt

# Phase 3b: Judge System
packages/opencode/src/agent/judge-agent.ts
packages/opencode/src/session/candidate-scorer.ts

# Phase 3c: Shadow Worktree
packages/opencode/src/worktree/index.ts
packages/opencode/src/worktree/gc.ts

# Phase 3d: Cardinal系统
packages/opencode/src/session/cardinal.ts

# Phase 3e: AlignmentGuard
packages/opencode/src/observability/alignment-guard.ts

# Phase 3f: Inbox系统
packages/opencode/src/inbox/inbox-ref.ts
packages/opencode/src/inbox/inbox.sql.ts
packages/opencode/src/inbox/inbox.ts
packages/opencode/src/inbox/index.ts
packages/opencode/src/inbox/render.ts

# Phase 3g: History系统
packages/opencode/src/history/backfill.ts
packages/opencode/src/history/extract.ts
packages/opencode/src/history/fts-query.ts
packages/opencode/src/history/fts.sql.ts
packages/opencode/src/history/index.ts
packages/opencode/src/history/resolve.ts
packages/opencode/src/history/service.ts
packages/opencode/src/history/writer.ts

# Phase 3h: 工具补充
packages/opencode/src/tool/actor.ts
packages/opencode/src/tool/actor.shell.txt
packages/opencode/src/tool/actor.txt
packages/opencode/src/tool/history.ts
packages/opencode/src/tool/history.txt
packages/opencode/src/tool/multiedit.ts
packages/opencode/src/tool/multiedit.txt
packages/opencode/src/tool/screenshot.ts
packages/opencode/src/tool/workflow.ts
packages/opencode/src/tool/workflow.txt

# Phase 4b: Token Tracker
packages/opencode/src/token/index.ts
packages/opencode/src/token/token.sql.ts
packages/opencode/src/token/tracker.ts

# Phase 4c: Metrics系统
packages/opencode/src/metrics/client.ts
packages/opencode/src/metrics/event.ts
packages/opencode/src/metrics/index.ts
packages/opencode/src/metrics/installation.ts
packages/opencode/src/metrics/subscriber.ts
packages/opencode/src/metrics/util.ts

# Phase 4d: Workflow引擎
packages/opencode/src/workflow/builtin.ts
packages/opencode/src/workflow/builtin/deep-research.js
packages/opencode/src/workflow/events.ts
packages/opencode/src/workflow/meta.ts
packages/opencode/src/workflow/persistence.ts
packages/opencode/src/workflow/resolve.ts
packages/opencode/src/workflow/runtime-ref.ts
packages/opencode/src/workflow/runtime.ts
packages/opencode/src/workflow/sandbox.ts
packages/opencode/src/workflow/vfs-sandbox.ts
packages/opencode/src/workflow/workflow.sql.ts
packages/opencode/src/workflow/workspace.ts

# Phase 4e: Trace机制
packages/opencode/src/observability/trace-reporter.ts
packages/opencode/src/observability/heuristic-filter.ts
packages/opencode/src/config/trace.ts
packages/opencode/src/config/debug.ts           # Debug日志配置
packages/opencode/src/util/log.ts               # 日志系统 (已有，需增强)

# Phase 5b: Team系统
packages/opencode/src/team/events.ts
packages/opencode/src/team/index.ts
packages/opencode/src/team/schema.ts

# Phase 5c: AST Graph
packages/opencode/src/ast/graph.ts

# Phase 5d: 插件补充
packages/opencode/src/plugin/checkpoint-splitover.ts
packages/opencode/src/plugin/subagent-progress-checker.ts

# Phase 5e: 配置补充
packages/opencode/src/config/skills.ts
packages/opencode/src/config/history.ts

# Evolution Flywheel
script/dogfooding/generate_cases.ts
script/dogfooding/optimize_prompt.ts
script/dogfooding/export_dpo.ts
script/dogfooding/auto-export.ts
script/dogfooding/beta_evolution_loop.ts
script/dogfooding/setup_local_cron.sh

# Auto-Dev Scheduler
script/auto-dev/scheduler.ts
script/auto-dev/pipeline.ts
script/auto-dev/roadmap.ts
script/auto-dev/notify.ts
script/auto-dev/setup_cron.sh
```

### 修改文件 (12个)

```
packages/opencode/src/agent/agent.ts          — 新增 dream/distill/checkpoint-writer/actor agent
packages/core/src/plugin/agent.ts             — V2 agent 注册
packages/opencode/src/tool/registry.ts        — 新增 memory/actor/workflow/history/multiedit/screenshot 工具
packages/opencode/src/session/prompt.ts       — 新增 auto-dream/distill/Goal/Cardinal/MaxMode 触发
packages/opencode/src/tool/shell.ts           — 新增 AST 拦截
packages/core/src/config/                     — 新增 memory/dream/distill/token/skills/history/mode 配置
package.json                                  — 新增依赖: shell-quote, web-tree-sitter, ts-morph
turbo.json                                    — 新增 memory/actor/task/history/workflow 相关任务
packages/opencode/src/session/reminders.ts    — 新增 Compose/Plan/Max 模式提醒
packages/opencode/src/observability/          — 新增 trace-reporter, heuristic-filter
packages/opencode/src/bus/                    — 新增事件类型
packages/opencode/src/effect/                 — 新增 instance-state, app-runtime
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| V1/V2 双系统兼容 | 高 | 优先在 V1 (packages/opencode) 实现，V2 通过 plugin bridge |
| Memory DB schema 变更 | 中 | 使用 Drizzle migration，向前兼容 |
| shell-quote 依赖安全 | 中 | 锁定版本，patchedDependencies |
| Dream/Distill LLM 成本 | 低 | 间隔触发 (7/30天)，token budget 限制 |
| Worktree 磁盘空间 | 低 | GC 自动清理，可配置最大 worktree 数 |
| Actor并发系统复杂度 | 高 | 分步实现，先实现基础spawn/wait，再实现并发控制 |
| Workflow引擎安全风险 | 中 | VFS沙箱隔离，限制脚本执行权限 |
| Task系统与Goal系统冲突 | 中 | 明确职责边界，Task管理任务状态，Goal管理目标评估 |
| History系统数据库膨胀 | 低 | 定期清理过期数据，配置保留策略 |
| Metrics系统性能影响 | 低 | 异步收集，可配置采样率 |
| 模式注册表重构范围扩大 | 中 | 一步到位，限定6个模式 |
| Max模式成本增加 | 低 | 可配置candidates数量，默认5个 |
| Loop模式触发时机 | 低 | 可配置interval_days，默认7/30天 |
| **Trace性能影响** | 低 | 采样支持，可配置采样率，异步记录 |
| **Debug日志磁盘占用** | 低 | 自动清理，保留最近10个日志文件 |
| **Trace数据量过大** | 中 | maxTraces限制，HeuristicFilter过滤脏数据 |

---

## 建议的实施顺序

### 第一批 (核心基础) - 12-17天
1. Phase 1: Memory Layer (3-4天)
2. Phase 2d: Actor并发系统 (3-4天)
3. Phase 2e: Task系统 (2-3天)
4. Phase 2f: Goal系统 (1-2天)
5. Phase 2g: 模式系统 (2-3天)

### 第二批 (控制层) - 12-16天
6. Phase 2a: Dream Agent + Loop模式 (2天)
7. Phase 2b: Checkpoint Writer (3天)
8. Phase 2c: Shell Safety (1-2天)
9. Phase 3d: Cardinal系统 (1-2天)
10. Phase 3e: AlignmentGuard (1-2天)
11. Phase 3f: Inbox系统 (1天)
12. Phase 3g: History系统 (2天)
13. Phase 3h: 工具补充 (2天)

### 第三批 (自动化) - 12-17天
14. Phase 3a: Distill Agent (2天)
15. Phase 3b: Judge System + Max模式 (3-4天)
16. Phase 3c: Shadow Worktree (2-3天)
17. Phase 4: Evolution Flywheel (3-4天)
18. Phase 4b: Token Tracker (1-2天)
19. Phase 4c: Metrics系统 (1天)
20. Phase 4d: Workflow引擎 (3-4天)
21. **Phase 4e: Trace机制 (2-3天)**

### 第四批 (高级功能) - 6-8天
22. Phase 5: Auto-Dev Scheduler (2-3天)
23. Phase 5b: Team系统 (1-2天)
24. Phase 5c: AST Graph (1天)
25. Phase 5d: 插件补充 (1天)
26. Phase 5e: 配置补充 (0.5天)

---

## 附录：Helix项目特色能力清单

### 核心系统级能力 (14个)
1. Actor并发系统
2. Workflow引擎
3. Task系统
4. Goal系统
5. Cardinal系统
6. AlignmentGuard
7. Inbox系统
8. History系统
9. Token Tracker
10. Metrics系统
11. Team系统
12. 模式系统 (Build/Plan/Compose/Max/Loop)
13. Trace机制 (TraceReporter + HeuristicFilter)
14. **Debug日志系统 (30+模块debug点)**

### 工具级能力 (7个)
1. Actor工具
2. Workflow工具
3. History工具
4. MultiEdit工具
5. Screenshot工具
6. Memory工具
7. Shell Tokenize/Wrap

### 插件级能力 (2个)
1. Checkpoint Splitover
2. Subagent Progress Checker

### 配置级能力 (2个)
1. Skills配置
2. History配置

### 代码分析能力 (1个)
1. AST Graph

---

## 测试与验证计划

### 核心原则

1. **端到端验证优先**: Mock只能验证逻辑正确，不能验证功能正确
2. **LLM驱动验证**: 关键路径需要真实LLM调用验证
3. **分层验证**: 单元测试 → 集成测试 → 端到端测试
4. **验收标准明确**: 每个阶段都有明确的通过/失败标准

### 测试目录结构

```
packages/opencode/test/
├── unit/                    # 单元测试
│   ├── memory/
│   ├── actor/
│   ├── task/
│   ├── goal/
│   ├── mode/
│   ├── judge/
│   ├── cardinal/
│   ├── alignment/
│   ├── history/
│   ├── token/
│   └── workflow/
├── integration/             # 集成测试
│   ├── memory/
│   ├── actor/
│   ├── task/
│   └── ...
├── e2e/                     # 端到端测试
│   ├── memory-e2e.test.ts
│   ├── actor-e2e.test.ts
│   ├── task-e2e.test.ts
│   ├── goal-e2e.test.ts
│   ├── mode-e2e.test.ts
│   ├── judge-e2e.test.ts
│   ├── cardinal-e2e.test.ts
│   ├── alignment-e2e.test.ts
│   ├── history-e2e.test.ts
│   └── workflow-e2e.test.ts
└── fixtures/                # 测试数据
    ├── memory/
    ├── tasks/
    └── workflows/
```

### 测试配置

```typescript
// test/config.ts
export const testConfig = {
  // LLM配置
  llm: {
    provider: "openai",
    model: "gpt-4",
    apiKey: process.env.OPENAI_API_KEY
  },
  
  // 超时配置
  timeout: {
    unit: 5000,
    integration: 30000,
    e2e: 120000
  },
  
  // 数据库配置
  database: {
    path: ":memory:" // 使用内存数据库
  }
}
```

### 测试运行脚本

```bash
#!/bin/bash
# scripts/test.sh

# 运行所有单元测试
echo "Running unit tests..."
cd packages/opencode && bun test test/unit/

# 运行所有集成测试
echo "Running integration tests..."
cd packages/opencode && bun test test/integration/

# 运行所有端到端测试
echo "Running e2e tests..."
cd packages/opencode && bun test test/e2e/

# 生成覆盖率报告
echo "Generating coverage report..."
cd packages/opencode && bun test --coverage
```

---

## Phase 1: Memory Layer 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | FTS5查询构建 | 本地SQLite | 正确构建OR-join查询 |
| **单元测试** | 向量余弦相似度 | 纯计算 | 相似度计算正确 |
| **集成测试** | Memory索引同步 | 本地文件系统+SQLite | 文件变更正确同步到DB |
| **集成测试** | 混合检索 | 真实LM Studio API | BM25×0.6 + Vector×0.4 |
| **端到端** | Memory工具调用 | 真实LLM + Memory服务 | LLM能正确搜索记忆 |

### LLM驱动验证脚本

```typescript
// test/e2e/memory-e2e.test.ts
describe("Memory E2E", () => {
  it("should search memory using LLM", async () => {
    // 1. 准备记忆文件
    await writeFile("~/.local/share/opencode/memory/global/MEMORY.md", `
# Project Rules
- Always use TypeScript
- Never use any type
`)
    
    // 2. 触发reconcile
    await memoryService.reconcile()
    
    // 3. 用LLM搜索
    const result = await llm.chat({
      messages: [{ role: "user", content: "What are the project rules?" }],
      tools: { memory: memoryTool }
    })
    
    // 4. 验证LLM调用了memory工具
    expect(result.toolCalls).toContainEqual(
      expect.objectContaining({ toolName: "memory" })
    )
    
    // 5. 验证搜索结果正确
    const searchResult = result.toolCalls[0].result
    expect(searchResult).toContain("TypeScript")
    expect(searchResult).toContain("any type")
  })
})
```

### 验收命令

```bash
# 运行单元测试
cd packages/opencode && bun test test/memory/

# 运行集成测试
cd packages/opencode && bun test test/memory/integration/

# 运行端到端测试
cd packages/opencode && bun test test/e2e/memory-e2e.test.ts

# 手动验证
# 1. 创建记忆文件
echo "Test memory content" > ~/.local/share/opencode/memory/global/test.md

# 2. 启动服务
bun dev

# 3. 在对话中测试
# 用户: "Search memory for test content"
# 验证: LLM调用memory工具并返回正确结果
```

---

## Phase 2d: Actor并发系统 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | Actor状态机 | 本地状态管理 | 状态转换正确 |
| **单元测试** | ForkContext共享 | 内存模拟 | 前缀缓存正确共享 |
| **集成测试** | ActorWaiter | 真实Fiber | 正确等待和超时 |
| **集成测试** | 并发控制 | 多个Actor | 不超过16个并发 |
| **端到端** | 子智能体执行 | 真实LLM + Actor | 子智能体正确执行并返回结果 |

### LLM驱动验证脚本

```typescript
// test/e2e/actor-e2e.test.ts
describe("Actor E2E", () => {
  it("should spawn subagent and wait for result", async () => {
    // 1. 启动主会话
    const session = await sessionService.create()
    
    // 2. 发送消息，触发子智能体
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Create a subagent to analyze the codebase structure" 
      }]
    })
    
    // 3. 验证子智能体被创建
    const actors = await actorRegistry.listBySession(session.id)
    expect(actors.length).toBeGreaterThan(0)
    
    // 4. 验证子智能体返回格式
    const subagentResult = await actorWaiter.wait({ 
      actorID: actors[0].id,
      timeoutMs: 60000 
    })
    expect(subagentResult.status).toBe("idle")
    expect(subagentResult.reportedStatus).toMatch(/success|partial/)
    
    // 5. 验证返回头格式
    expect(subagentResult.result).toContain("**Status**:")
    expect(subagentResult.result).toContain("**Summary**:")
  })
  
  it("should handle concurrent actors correctly", async () => {
    // 1. 创建多个子智能体
    const actors = await Promise.all(
      Array.from({ length: 5 }, () => 
        actorSpawn.spawn({
          mode: "subagent",
          agentType: "explore",
          task: "Explore codebase",
          background: true
        })
      )
    )
    
    // 2. 验证并发数
    const activeActors = await actorRegistry.listActive()
    expect(activeActors.length).toBeLessThanOrEqual(16)
    
    // 3. 等待所有完成
    const results = await Promise.all(
      actors.map(a => actorWaiter.wait({ actorID: a.id }))
    )
    
    // 4. 验证所有都成功
    results.forEach(r => {
      expect(r.status).toBe("idle")
      expect(r.lastOutcome).toBe("success")
    })
  })
})
```

### 验收命令

```bash
# 运行单元测试
cd packages/opencode && bun test test/actor/

# 运行集成测试
cd packages/opencode && bun test test/actor/integration/

# 运行端到端测试
cd packages/opencode && bun test test/e2e/actor-e2e.test.ts

# 并发压力测试
cd packages/opencode && bun test test/actor/stress.test.ts
```

---

## Phase 2e: Task系统 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | 状态机转换 | 本地状态 | open→in_progress→done |
| **单元测试** | 分层ID生成 | 纯计算 | T1→T1.1→T1.1.1 |
| **集成测试** | TaskGate | 真实DB | 正确检查未完成任务 |
| **集成测试** | 事件审计 | 真实DB | 状态变更正确记录 |
| **端到端** | 任务生命周期 | 真实LLM + Task | 任务创建→执行→完成 |

### LLM驱动验证脚本

```typescript
// test/e2e/task-e2e.test.ts
describe("Task E2E", () => {
  it("should create and complete task via LLM", async () => {
    // 1. 发送任务请求
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Create a task to implement user login feature" 
      }]
    })
    
    // 2. 验证任务被创建
    const tasks = await taskRegistry.listBySession(session.id)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks[0].status).toBe("open")
    
    // 3. 验证LLM调用了task工具
    expect(result.toolCalls).toContainEqual(
      expect.objectContaining({ toolName: "task" })
    )
    
    // 4. 验证任务状态变更
    await waitFor(() => {
      const updatedTasks = await taskRegistry.listBySession(session.id)
      expect(updatedTasks[0].status).toMatch(/in_progress|done/)
    })
  })
  
  it("should block on incomplete tasks via TaskGate", async () => {
    // 1. 创建未完成任务
    await taskRegistry.create({
      sessionID: session.id,
      title: "Incomplete task",
      status: "open"
    })
    
    // 2. 尝试结束会话
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ type: "text", text: "I'm done with the work" }]
    })
    
    // 3. 验证TaskGate阻止结束
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining("unfinished tasks")
      })
    )
  })
})
```

---

## Phase 2f: Goal系统 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | Verdict解析 | 纯计算 | 正确解析JSON |
| **单元测试** | 安全阀 | 本地状态 | MAX_GOAL_REACT=12 |
| **集成测试** | Goal评估 | 真实LLM API | Judge正确评估 |
| **端到端** | 目标驱动执行 | 真实LLM + Goal | 满足条件后停止 |

### LLM驱动验证脚本

```typescript
// test/e2e/goal-e2e.test.ts
describe("Goal E2E", () => {
  it("should stop when goal is satisfied", async () => {
    // 1. 设置目标
    await goalService.set(session.id, "Create a file named test.txt")
    
    // 2. 执行任务
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Create a file named test.txt with content 'hello'" 
      }]
    })
    
    // 3. 验证文件被创建
    const fileExists = await fs.exists("test.txt")
    expect(fileExists).toBe(true)
    
    // 4. 验证Goal评估通过
    const goal = await goalService.get(session.id)
    expect(goal).toBeUndefined() // Goal已被清除
    
    // 5. 验证会话停止
    const sessionStatus = await sessionService.getStatus(session.id)
    expect(sessionStatus).toBe("idle")
  })
  
  it("should continue when goal is not satisfied", async () => {
    // 1. 设置难以满足的目标
    await goalService.set(session.id, "Make all tests pass in the project")
    
    // 2. 执行一个简单任务
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ type: "text", text: "Create a simple hello world file" }]
    })
    
    // 3. 验证Goal未被清除
    const goal = await goalService.get(session.id)
    expect(goal).toBeDefined()
    
    // 4. 验证会话继续
    expect(result.shouldContinue).toBe(true)
  })
})
```

---

## Phase 2g: 模式系统 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | 模式检测 | 本地状态 | 正确识别模式 |
| **单元测试** | Mode Registry | 本地注册 | 正确注册和获取 |
| **集成测试** | Plan模式 | 真实LLM | 只读操作 |
| **集成测试** | Max模式 | 真实LLM | 5个候选+Judge |
| **端到端** | 模式切换 | 真实LLM | 模式正确切换 |

### LLM驱动验证脚本

```typescript
// test/e2e/mode-e2e.test.ts
describe("Mode E2E", () => {
  it("should enforce Plan mode read-only", async () => {
    // 1. 切换到Plan模式
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "plan",
      parts: [{ 
        type: "text", 
        text: "Analyze the codebase and create a plan" 
      }]
    })
    
    // 2. 验证没有文件被修改
    const gitStatus = await git.status()
    expect(gitStatus.modified).toHaveLength(0)
    
    // 3. 验证Plan文件被创建
    const planFile = await sessionService.getPlanFile(session.id)
    expect(await fs.exists(planFile)).toBe(true)
  })
  
  it("should generate multiple candidates in Max mode", async () => {
    // 1. 配置Max模式
    await config.set("experimental.maxMode.candidates", 5)
    
    // 2. 发送任务
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "max",
      parts: [{ 
        type: "text", 
        text: "Implement a sorting algorithm" 
      }]
    })
    
    // 3. 验证多个候选被生成
    const metrics = await metricsService.getBySession(session.id)
    expect(metrics.candidatesGenerated).toBe(5)
    
    // 4. 验证Judge选择了获胜者
    expect(metrics.judgePick).toBeDefined()
    expect(metrics.judgePick).toBeGreaterThanOrEqual(0)
    expect(metrics.judgePick).toBeLessThan(5)
  })
  
  it("should trigger auto-dream in Loop mode", async () => {
    // 1. 设置项目年龄超过7天
    await sessionService.setProjectAge(8 * 24 * 60 * 60 * 1000)
    
    // 2. 发送消息触发Loop模式检查
    await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ type: "text", text: "Hello" }]
    })
    
    // 3. 验证auto-dream被触发
    await waitFor(() => {
      const sessions = await sessionService.listByTitle("Auto Dream")
      expect(sessions.length).toBeGreaterThan(0)
    })
  })
})
```

---

## Phase 3b: Judge系统 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | 启发式检查 | 本地diff | 正确检测问题 |
| **单元测试** | 断言减少检测 | 本地diff | 检测到>30%减少 |
| **集成测试** | LLM Judge | 真实LLM API | 正确评估代码质量 |
| **端到端** | 代码审查 | 真实LLM + Judge | 拒绝有问题的代码 |

### LLM驱动验证脚本

```typescript
// test/e2e/judge-e2e.test.ts
describe("Judge E2E", () => {
  it("should reject code with reduced assertions", async () => {
    // 1. 准备测试文件
    await writeFile("test/example.test.ts", `
      test("example", () => {
        expect(1 + 1).toBe(2)
        expect(2 + 2).toBe(4)
        expect(3 + 3).toBe(6)
      })
    `)
    
    // 2. 提交减少断言的修改
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Simplify the test by removing redundant assertions" 
      }]
    })
    
    // 3. 验证Judge拒绝
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining("assertion reduction")
      })
    )
    
    // 4. 验证文件未被修改
    const content = await readFile("test/example.test.ts")
    expect(content).toContain("expect(1 + 1).toBe(2)")
  })
  
  it("should reject code with security issues", async () => {
    // 1. 提交包含eval的代码
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Add a function that uses eval to execute dynamic code" 
      }]
    })
    
    // 2. 验证Judge拒绝
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining("security")
      })
    )
  })
})
```

---

## Phase 3d: Cardinal系统 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | 安全规则 | 本地diff | 检测eval/exec |
| **单元测试** | 过量改动 | 本地diff | 检测文件数超限 |
| **集成测试** | Cardinal决策 | 真实上下文 | 正确决策 |
| **端到端** | 风险阻断 | 真实LLM + Cardinal | 阻止高风险操作 |

### LLM驱动验证脚本

```typescript
// test/e2e/cardinal-e2e.test.ts
describe("Cardinal E2E", () => {
  it("should block eval/exec operations", async () => {
    // 1. 提交包含eval的代码
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Create a function that uses eval to execute user input" 
      }]
    })
    
    // 2. 验证Cardinal阻止
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining("Cardinal block")
      })
    )
    
    // 3. 验证会话停止
    const sessionStatus = await sessionService.getStatus(session.id)
    expect(sessionStatus).toBe("idle")
  })
  
  it("should pause on excessive changes", async () => {
    // 1. 配置预估文件数
    await config.set("cardinal.estimatedFiles", 2)
    
    // 2. 提交大量文件修改
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Refactor the entire codebase" 
      }]
    })
    
    // 3. 验证Cardinal暂停
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining("excessive changes")
      })
    )
  })
})
```

---

## Phase 3e: AlignmentGuard 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | 文件漂移检测 | 本地文件 | 检测无关文件修改 |
| **单元测试** | 兔子洞检测 | 本地命令 | 检测重复安装 |
| **集成测试** | Inbox投递 | 真实Inbox | 正确投递消息 |
| **端到端** | 偏移纠正 | 真实LLM + Alignment | 纠正偏离行为 |

### LLM驱动验证脚本

```typescript
// test/e2e/alignment-e2e.test.ts
describe("AlignmentGuard E2E", () => {
  it("should detect and correct file drift", async () => {
    // 1. 设置目标
    await goalService.set(session.id, "Implement user login")
    
    // 2. 执行偏离任务
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Create a new database migration for blog posts" 
      }]
    })
    
    // 3. 验证AlignmentGuard检测到偏离
    const alerts = await alignmentGuard.getAlerts(session.id)
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].level).toBe("warn")
    
    // 4. 验证Inbox收到纠正消息
    const inboxMessages = await inbox.list(session.id)
    expect(inboxMessages).toContainEqual(
      expect.objectContaining({
        senderActorID: "alignment-guard"
      })
    )
  })
})
```

---

## Phase 3g: History系统 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | FTS查询构建 | 本地计算 | 正确构建查询 |
| **集成测试** | 历史搜索 | 真实DB | 正确搜索历史 |
| **集成测试** | 上下文恢复 | 真实DB | 正确获取上下文 |
| **端到端** | History工具 | 真实LLM + History | LLM能搜索历史 |

### LLM驱动验证脚本

```typescript
// test/e2e/history-e2e.test.ts
describe("History E2E", () => {
  it("should search historical sessions via LLM", async () => {
    // 1. 准备历史数据
    await sessionService.create({ title: "Previous session" })
    await messageService.create({
      sessionID: session.id,
      role: "user",
      content: "Implement user authentication"
    })
    
    // 2. 用LLM搜索历史
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Search history for previous authentication work" 
      }]
    })
    
    // 3. 验证LLM调用了history工具
    expect(result.toolCalls).toContainEqual(
      expect.objectContaining({ toolName: "history" })
    )
    
    // 4. 验证搜索结果正确
    const searchResult = result.toolCalls[0].result
    expect(searchResult).toContain("authentication")
  })
})
```

---

## Phase 4b: Token Tracker 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | 使用记录 | 本地DB | 正确记录token |
| **单元测试** | 预算计算 | 本地计算 | 正确计算剩余 |
| **集成测试** | 预算分配 | 真实DB | 正确分配预算 |
| **端到端** | 预算感知 | 真实LLM + Token | 预算不足时停止 |

### 验收命令

```bash
# 运行测试
cd packages/opencode && bun test test/token/

# 手动验证
# 1. 设置每日预算
echo '{"token_budget": {"daily_limit": 1000}}' > ~/.config/opencode/config.json

# 2. 执行任务
bun dev

# 3. 检查token使用
sqlite3 ~/.local/share/opencode/db.sqlite "SELECT * FROM token_usage WHERE date = date('now')"
```

---

## Phase 4d: Workflow引擎 验证

### 测试用例

| 测试类型 | 测试用例 | 验证方式 | 验收标准 |
|----------|----------|----------|----------|
| **单元测试** | 脚本解析 | 本地解析 | 正确解析JS/JSON |
| **单元测试** | VFS沙箱 | 本地VFS | 文件操作隔离 |
| **集成测试** | 工作流执行 | 真实执行 | 正确执行工作流 |
| **端到端** | Workflow工具 | 真实LLM + Workflow | LLM能运行工作流 |

### LLM驱动验证脚本

```typescript
// test/e2e/workflow-e2e.test.ts
describe("Workflow E2E", () => {
  it("should run deep-research workflow via LLM", async () => {
    // 1. 用LLM启动工作流
    const result = await sessionPrompt.prompt({
      sessionID: session.id,
      agent: "build",
      parts: [{ 
        type: "text", 
        text: "Run a deep research workflow on TypeScript best practices" 
      }]
    })
    
    // 2. 验证LLM调用了workflow工具
    expect(result.toolCalls).toContainEqual(
      expect.objectContaining({ toolName: "workflow" })
    )
    
    // 3. 验证工作流启动
    const workflowResult = result.toolCalls[0].result
    expect(workflowResult).toContain("Workflow started")
    expect(workflowResult).toContain("run_id:")
    
    // 4. 等待工作流完成
    const runID = workflowResult.match(/run_id: (\w+)/)[1]
    const outcome = await workflowRuntime.wait({ runID, timeoutMs: 300000 })
    
    // 5. 验证工作流成功
    expect(outcome.status).toBe("completed")
  })
})
```

---

## 验收检查清单

### 每个阶段完成后的验收标准

| 阶段 | 验收标准 | 验证命令 |
|------|----------|----------|
| **Phase 1** | Memory工具能被LLM正确调用 | `bun test test/e2e/memory-e2e.test.ts` |
| **Phase 2d** | 子智能体能正确执行并返回结果 | `bun test test/e2e/actor-e2e.test.ts` |
| **Phase 2e** | 任务状态机正确转换，TaskGate正确检查 | `bun test test/e2e/task-e2e.test.ts` |
| **Phase 2f** | Goal评估正确，满足条件后停止 | `bun test test/e2e/goal-e2e.test.ts` |
| **Phase 2g** | 模式正确切换，Max模式生成多个候选 | `bun test test/e2e/mode-e2e.test.ts` |
| **Phase 3b** | Judge正确拒绝有问题的代码 | `bun test test/e2e/judge-e2e.test.ts` |
| **Phase 3d** | Cardinal正确阻止高风险操作 | `bun test test/e2e/cardinal-e2e.test.ts` |
| **Phase 3e** | AlignmentGuard正确检测偏离 | `bun test test/e2e/alignment-e2e.test.ts` |
| **Phase 3g** | History工具能搜索历史会话 | `bun test test/e2e/history-e2e.test.ts` |
| **Phase 4b** | Token使用正确记录，预算正确控制 | `bun test test/token/` |
| **Phase 4d** | 工作流正确执行 | `bun test test/e2e/workflow-e2e.test.ts` |
| **Phase 4e** | Trace正确记录，HeuristicFilter正确过滤，formatTree正确渲染，Debug日志系统正常工作 | `bun test test/e2e/trace-e2e.test.ts` |

### Debug日志系统验收标准

| 检查项 | 验收标准 | 验证命令 |
|--------|----------|----------|
| **日志级别控制** | MIMOCODE_LOG_LEVEL环境变量生效 | `MIMOCODE_LOG_LEVEL=DEBUG bun dev` |
| **日志文件生成** | 日志文件正确生成到指定目录 | `ls -la ~/.local/share/opencode/log/` |
| **日志格式** | 日志格式包含时间戳、级别、service、消息 | `head -10 ~/.local/share/opencode/log/dev.log` |
| **日志轮转** | 旧日志自动清理，保留最近10个 | `ls -la ~/.local/share/opencode/log/*.log \| wc -l` |
| **Debug Trace** | OPENCODE_DIRECT_TRACE环境变量启用JSONL trace | `OPENCODE_DIRECT_TRACE=1 bun dev` |
| **Trace文件生成** | Trace文件正确生成到direct目录 | `ls -la ~/.local/share/opencode/log/direct/` |
| **latest.json指针** | latest.json指针正确指向最新trace | `cat ~/.local/share/opencode/log/direct/latest.json` |
| **模块级debug日志** | 各模块debug日志正确输出 | `grep "DEBUG" ~/.local/share/opencode/log/dev.log \| head -20` |

### 测试覆盖率目标

| 模块 | 目标覆盖率 |
|------|-----------|
| Memory | ≥80% |
| Actor | ≥85% |
| Task | ≥80% |
| Goal | ≥75% |
| Mode | ≥80% |
| Judge | ≥70% |
| Cardinal | ≥80% |
| AlignmentGuard | ≥75% |
| History | ≥80% |
| Token | ≥85% |
| Workflow | ≥70% |
| **Trace** | **≥80%** |

### CI/CD集成

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test:unit
      - run: bun run test:integration
      - run: bun run test:e2e
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## 附录：测试工具与依赖

### 测试框架

```json
{
  "devDependencies": {
    "bun-types": "latest",
    "@types/bun": "latest"
  }
}
```

### 测试辅助工具

```typescript
// test/helpers.ts
export async function waitFor(
  fn: () => Promise<void>,
  options: { timeout?: number; interval?: number } = {}
) {
  const { timeout = 5000, interval = 100 } = options
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    try {
      await fn()
      return
    } catch (e) {
      await new Promise(r => setTimeout(r, interval))
    }
  }
  
  throw new Error(`waitFor timed out after ${timeout}ms`)
}

export async function createTestSession() {
  return sessionService.create({
    title: `Test session ${Date.now()}`
  })
}

export async function cleanupTestData() {
  // 清理测试数据
  await database.exec("DELETE FROM sessions WHERE title LIKE 'Test session%'")
  await database.exec("DELETE FROM tasks WHERE session_id IN (SELECT id FROM sessions WHERE title LIKE 'Test session%')")
}
```

---

*本文档基于 Helix 项目实际代码逐文件审查，确保描述与代码实现一致。如有架构更新，需同步更新本文档。*
