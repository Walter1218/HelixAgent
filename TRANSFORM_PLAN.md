# HelixAgent 改造计划

> 将 Helix (MiMo-Code) 中有价值的能力移植到 HelixAgent (OpenCode)

---

## 总体架构对比

```
Helix (MiMo-Code)                         HelixAgent (OpenCode)
─────────────────                         ────────────────────
L0: Shadow Worktree + AST 拦截器           无安全沙箱
L1: Memory (FTS5 + Vector RAG)            无持久记忆层
L2: FSM + Judge + Dream/Distill           Runner idle/busy + 简单 subagent
L3: Auto-Dev + OpenSpec + Evolution       无自动化进化

目标: 在 HelixAgent 的 V1+V2 双系统架构上，分层构建上述能力
```

---

## 依赖关系与实施顺序

```
Phase 1: Memory Layer (基础层)
    │
    ├── Phase 2a: Dream Agent (记忆整合)
    │
    ├── Phase 2b: Checkpoint Writer (会话快照)
    │
    └── Phase 2c: Shell Safety (命令安全)
         │
         ├── Phase 3a: Distill Agent (工作流蒸馏)
         │
         ├── Phase 3b: Judge System (代码审查)
         │
         └── Phase 3c: Shadow Worktree (Git 隔离)
              │
              └── Phase 4: Evolution Flywheel (自我进化)
                   │
                   └── Phase 5: Auto-Dev Scheduler (自动开发)
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

### 1.6 集成点

- `packages/core/src/plugin/agent.ts`: 给 `default` 和 `general` agent 添加 `memory` 工具权限
- `packages/opencode/src/session/system.ts`: 在系统提示词中注入 memory 使用说明

---

## Phase 2a: Dream Agent (记忆整合)

**目标**: 后台自动整合历史会话知识到 MEMORY.md。

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

### 2.3 自动调度

**文件**: `packages/opencode/src/session/auto-dream.ts` (新建，~130行)

```ts
const DREAM_INTERVAL_DAYS = 7
const DISTILL_INTERVAL_DAYS = 30
const MIN_SPAWN_GAP_MS = 10_000

export async function shouldAutoDream(cfg: Config.Info): Promise<boolean> {
  // 查询 SQLite session 表，找最近一次 "Auto Dream" 会话
  // 如果不存在，检查项目是否足够老 (至少 1 天)
  // 如果存在，检查距今是否 >= interval_days
}

export async function shouldAutoDistill(cfg: Config.Info): Promise<boolean> {
  // 同上，但标题匹配 "Auto Distill"，间隔 30 天
}
```

### 2.4 触发点

**修改**: `packages/opencode/src/session/prompt.ts` — 在 `runLoop` 的 `step === 1` 处:

```ts
if (step === 1 && !session.parentID) {
  // 检查并触发 auto-dream
  if (await shouldAutoDream(cfg)) {
    spawnBackgroundAgent("dream", DREAM_TASK_PROMPT)
  }
  // 检查并触发 auto-distill
  if (await shouldAutoDistill(cfg)) {
    spawnBackgroundAgent("distill", DISTILL_TASK_PROMPT)
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

## Phase 3b: Judge System (代码审查)

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

**文件**: `packages/opencode/src/session/max-mode.ts` (新建，~400行)

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

**文件**: `packages/opencode/src/session/mode-registry.ts` (新建)

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

## 实施时间线

| 阶段 | 预计工时 | 优先级 | 依赖 |
|------|---------|--------|------|
| Phase 1: Memory Layer | 3-4 天 | P0 | 无 |
| Phase 2a: Dream Agent | 2 天 | P0 | Phase 1 |
| Phase 2b: Checkpoint Writer | 3 天 | P1 | Phase 1 |
| Phase 2c: Shell Safety | 1-2 天 | P1 | 无 |
| Phase 3a: Distill Agent | 2 天 | P1 | Phase 1, 2a |
| Phase 3b: Judge System | 3-4 天 | P1 | 无 |
| Phase 3c: Shadow Worktree | 2-3 天 | P2 | 无 |
| Phase 4: Evolution Flywheel | 3-4 天 | P2 | Phase 3b |
| Phase 5: Auto-Dev Scheduler | 2-3 天 | P3 | Phase 4 |

**总计**: ~20-27 天

---

## 文件清单 (新建/修改)

### 新建文件 (31个)

```
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
packages/opencode/src/session/auto-dream.ts
packages/opencode/src/session/checkpoint.ts
packages/opencode/src/session/checkpoint-paths.ts
packages/opencode/src/session/checkpoint-templates.ts
packages/opencode/src/session/checkpoint-retry.ts
packages/opencode/src/session/max-mode.ts
packages/opencode/src/session/candidate-scorer.ts
packages/opencode/src/session/mode-registry.ts
packages/opencode/src/agent/judge-agent.ts
packages/opencode/src/agent/system-agents.ts
packages/opencode/src/agent/prompt/dream.txt
packages/opencode/src/agent/prompt/distill.txt
packages/opencode/src/agent/prompt/checkpoint-writer.txt
packages/opencode/src/tool/shell-tokenize.ts
packages/opencode/src/tool/shell-wrap.ts
packages/opencode/src/worktree/index.ts
packages/opencode/src/worktree/gc.ts
script/dogfooding/*.ts (6个)
script/auto-dev/*.ts (4个)
```

### 修改文件 (8个)

```
packages/opencode/src/agent/agent.ts          — 新增 dream/distill/checkpoint-writer agent
packages/core/src/plugin/agent.ts             — V2 agent 注册
packages/opencode/src/tool/registry.ts        — 新增 memory 工具
packages/opencode/src/session/prompt.ts       — 新增 auto-dream/distill 触发
packages/opencode/src/tool/shell.ts           — 新增 AST 拦截
packages/core/src/config/                     — 新增 memory/dream/distill 配置
package.json                                  — 新增依赖: shell-quote, web-tree-sitter
turbo.json                                    — 新增 memory 相关任务
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
