# HelixAgent 系统状态与交付蓝图

> 版本: 1.2
> 生成日期: 2026-06-30
> 最后更新: 2026-07-01
> 分支: tui-dev
> 基准: HEAD + 工作区未提交修改
> 适用范围: MiMo/Helix 能力移植与死代码激活项目

---

## 一、执行摘要

### 1.1 总体状态

| 类别 | 数量 | 说明 |
|------|------|------|
| **已接入主链路** | 21 个服务 + 6 个工具 | 可正常运行（含 Phase 6 + OpenSpec） |
| **部分接入主链路** | 1 个服务 | Scheduler 仅 budget 检查 |
| **完全未实现** | 6 个能力 | 无目录、无文件、无引用 |
| **TUI 外化** | 5 个指示器/面板 | 已完成 Token/Mode/Goal/Task/Actor |

### 1.2 关键结论

1. **DEAD_CODE_ACTIVATION_PLAN Phase 1-6 已全部完成**：所有服务已接入主链路（Scheduler 除外，仅 budget 检查）。
2. **OpenSpec 系统已完整接入**：OpenSpecHook 已注册并调用，OpenSpec/OpenSpecJudge 通过 OpenSpecHook 间接使用。
3. **TUI 外化已完成**：Token/Mode/Goal 指示器 + Task/Actor 面板已实现，底层 API 已补充（Metrics/TokenTracker 查询接口）。
4. **下一步**：Memory Vector Store、History Service、Inbox、Judge+Max 等新能力开发。

### 1.3 当前环境快照

```bash
# 当前分支
tui-dev

# 当前 HEAD（执行以下命令获取）
# git rev-parse HEAD | cut -c1-12

# 工作区未提交修改（5 个）
packages/core/src/database/migration/20260630_add_memory_fts.ts
packages/core/src/database/schema.gen.ts
packages/core/src/memory/service.ts
packages/opencode/src/actor/waiter.ts
packages/opencode/src/tool/workflow.ts

# 编译状态
bun typecheck  # ✅ 0 errors (packages/opencode)
```

**注意**：本报告基于工作区文件（即你当前 `bun dev` 会运行的代码），HEAD 中的 `actor/waiter.ts` 仍为 stub。

---

## 二、范围定义

### 2.1 在 scope 内（MiMo/Helix 新增能力）

- DEAD_CODE_ACTIVATION_PLAN 中 Phase 1-6 的所有模块
- TRANSFORM_PLAN 中 Phase 1-5 对应的能力
- OpenSpec 系统
- Shadow Worktree

### 2.2 不在 scope 内（OpenCode 核心系统）

以下系统已注册并运行，但不属于本次 MiMo 能力移植范围：

- Session、Message、Agent、Provider、LLM、LSP、MCP
- Plugin、Skill、Command、Permission、Config
- Snapshot、Git、Database、FSUtil、BackgroundJob
- TUI、Web、Desktop、SDK、Protocol、Server

---

## 三、模块状态矩阵

### 3.1 已接入主链路 ✅

| 模块 | 来源 | 注册 | 主链路调用 | 服务实现 | 工具实现 | 备注 |
|------|------|------|-----------|---------|---------|------|
| Trace | Phase 1 | ✅ | ✅ processor.ts | 真实 | — | tool-call/result/error/finish 事件 |
| Metrics | Phase 1 | ✅ | ✅ processor.ts | 真实 | — | recordToolCall/recordModelCall |
| TokenTracker | Phase 1 | ✅ | ✅ processor.ts | 真实 | — | recordUsage |
| Cardinal | Phase 2 | ✅ | ✅ processor.ts | 真实 | — | 有默认规则 |
| AlignmentGuard | Phase 2 | ✅ | ✅ prompt.ts | 真实 | — | detectRabbitHole |
| Shell Safety | Phase 2 | ✅ | ✅ tool/shell.ts | 真实 | — | tokenize |
| Goal | Phase 3 | ✅ | ✅ prompt.ts | 真实 | — | get/bumpReact/clear |
| ActorRegistry | Phase 3 | ✅ | ✅ tool/actor.ts, task.ts | 真实 | — | register/get |
| TaskRegistry | Phase 3 | ✅ | ✅ tool/todo.ts | 真实 | — | create |
| ModeRegistry | Phase 3 | ✅ | ✅ prompt.ts | 真实 | — | getEvolutionConfig |
| ActorSpawn | Phase 3 | ✅ | ✅ tool/actor.ts | 真实 | — | spawn |
| ActorWaiter | Phase 3 | ✅ | ✅ tool/actor.ts | **工作区真实 / HEAD stub** | — | status/wait；工作区修改引入了 ActorRegistry 依赖 |
| AutoDream | Phase 4 | ✅ | ✅ prompt.ts | 真实 | — | shouldAutoDream/shouldAutoDistill |
| SessionCheckpoint | Phase 4 | ✅ | ✅ prompt.ts | 真实 | — | tryStartCheckpointWriter |
| actor tool | Phase 5 | ✅ | ✅ tool/actor.ts | — | 真实 | 实验性 flag |
| history tool | Phase 5 | ✅ | ✅ tool/history.ts | — | 真实 | 实验性 flag |
| memory tool | Phase 5 | ✅ | ✅ tool/memory.ts | — | 真实 | 实验性 flag |
| workflow tool | Phase 5 | ✅ | ✅ tool/workflow.ts | — | 真实 | 实验性 flag |
| screenshot tool | Phase 5 | ✅ | ✅ tool/screenshot.ts | — | 真实 | 默认启用 |
| multiedit tool | Phase 5 | ✅ | ✅ tool/multiedit.ts | — | 真实 | 默认启用 |
| Memory FTS | Phase 1 | ✅ | ✅ tool/memory.ts | 真实 | — | core/memory/service.ts |

### 3.2 已接入主链路的 Phase 6 服务 ✅

| 模块 | 来源 | 注册 | 主链路调用 | 调用位置 | 说明 |
|------|------|------|-----------|---------|------|
| Evolution | Phase 6 | ✅ | ✅ | prompt.ts:1471-1486 | runLoop 结束后调用 `exportSession` |
| Team | Phase 6 | ✅ | ✅ | prompt.ts:1432-1441 | runLoop 结束后调用 `formatTeamByOwnerSession` |
| AST | Phase 6 | ✅ | ✅ | processor.ts:471-474, prompt.ts:1443-1461 | tool-result 后记录变更 + runLoop 后分析 blast radius |
| Workflow | Phase 6 | ✅ | ✅ | prompt.ts:1497-1527 | 完整生命周期：startRun + completeRun |
| Scheduler | Phase 6 | ✅ | ⚠️ | prompt.ts:1125-1136 | 仅 budget 检查，`selectTasks` 未调用 |
| OpenSpecHook | OpenSpec | ✅ | ✅ | processor.ts:475-494 | tool-result 后调用合规检查 |
| OpenSpec | OpenSpec | ✅ | 间接 | 通过 OpenSpecHook | CLI 可用 |
| OpenSpecJudge | OpenSpec | ✅ | 间接 | 通过 OpenSpecHook | CLI 可用 |

### 3.3 部分实现 / 代码存在但未集成 🟡

| 模块 | 当前状态 | 缺口 |
|------|---------|------|
| Shadow Worktree | `src/shadow-worktree/` 有纯函数实现 | 未转 Effect Service、未注册、未调用 |
| History 系统 | `tool/history.ts` 已实现，`src/history/` 只有 schema | 缺少独立 History Service |
| OpenSpec 主链路 | spec/judge/converter/writer/hook 都实现 | 只有 CLI 命令可用，主链路未接入 |
| V2 Plugin | `plugin/src/v2/effect/` 有基础接口 | PluginHost/transform/hook 未完整实现 |

### 3.4 已完成的 TUI 外化 ✅

| 组件 | 位置 | 数据来源 | 状态 |
|------|------|---------|------|
| Token 指示器 | footer | TokenTracker.getSessionStats | ✅ 已完成 |
| Mode 指示器 | footer | session.agent 推断 | ✅ 已完成 |
| Goal 指示器 | footer | Goal.get | ✅ 已完成 |
| Task 面板 | sidebar | TaskRegistry.listBySession | ✅ 已完成 |
| Actor 面板 | sidebar | ActorRegistry.listBySession | ✅ 已完成 |

**底层 API 补充**:
- Metrics: 新增 `getModelCalls`, `getToolCalls`, `getSummary`
- TokenTracker: 新增 `getSessionUsage`, `getSessionStats`
- ModeRegistry: 新增 `inferMode` 方法

**HTTP API 新增**:
- `GET /session/:sessionID/goal`
- `GET /session/:sessionID/task`
- `GET /session/:sessionID/actor`
- `GET /session/:sessionID/metrics`
- `GET /session/:sessionID/token`

### 3.4 完全未实现 ❌

| 能力 | 来源 | 状态 | 开发计划 |
|------|------|------|---------|
| Inbox 系统 | TRANSFORM_PLAN Phase 3f | 无目录、无文件、无引用 | DEVELOPMENT_PLAN.md 阶段三 |
| Auto-Dev Scheduler（外部脚本） | TRANSFORM_PLAN Phase 5 | `script/auto-dev/` 不存在 | 暂缓 |
| Distill Agent 独立模块 | TRANSFORM_PLAN Phase 3a | 只有 `auto-dream.ts` 中的 DISTILL_TASK prompt | DEVELOPMENT_PLAN.md 阶段三 |
| Judge System + Max 模式 | TRANSFORM_PLAN Phase 3b | 无独立模块，只有 `system-agents.ts` 中的 "judge" 类型标记 | DEVELOPMENT_PLAN.md 阶段四 |
| Memory Vector Store 启用 | TRANSFORM_PLAN Phase 1 | `core/memory/vec-store.ts` 存在但 `tool/memory.ts` 未使用向量搜索 | DEVELOPMENT_PLAN.md 阶段一 |
| History Service | TRANSFORM_PLAN Phase 3g | `src/history/` 只有 schema 接口定义 | DEVELOPMENT_PLAN.md 阶段二 |
| Workflow 引擎（独立） | TRANSFORM_PLAN Phase 4d | `tool/workflow.ts` 存在但非完整 workflow 引擎 | 暂缓 |

---

## 四、详细模块状态

### 4.1 已接入主链路模块详情

#### Trace / Metrics / TokenTracker

- **调用位置**：`packages/opencode/src/session/processor.ts`
  - `trace.emit`: lines 359, 450, 470
  - `metrics.recordToolCall`: lines 457, 477
  - `metrics.recordModelCall`: line 524
  - `tokenTracker.recordUsage`: line 534
- **验证命令**：
  ```bash
  rg -n "yield\* trace\.|yield\* metrics\.|yield\* tokenTracker\." packages/opencode/src/session/processor.ts
  ```

#### Cardinal / AlignmentGuard

- **Cardinal 调用位置**：`processor.ts:368` `cardinal.evaluate`
- **AlignmentGuard 调用位置**：`prompt.ts:1373` `alignment.detectRabbitHole`
- **验证命令**：
  ```bash
  rg -n "yield\* cardinal\.|yield\* alignment\." packages/opencode/src/session/processor.ts packages/opencode/src/session/prompt.ts
  ```

#### Goal / ModeRegistry / AutoDream / SessionCheckpoint

- **Goal 调用位置**：`prompt.ts:1346, 1350, 1352`
- **ModeRegistry 调用位置**：`prompt.ts:1348`
- **AutoDream 调用位置**：`prompt.ts:1380, 1391`
- **SessionCheckpoint 调用位置**：`prompt.ts:1378`
- **验证命令**：
  ```bash
  rg -n "yield\* goal\.|yield\* modeRegistry\.|yield\* autoDream\.|yield\* checkpoint\." packages/opencode/src/session/prompt.ts
  ```

#### Actor / Task 系统

- **ActorRegistry 调用位置**：`tool/actor.ts:42`, `tool/task.ts:162`
- **ActorSpawn 调用位置**：`tool/actor.ts:32`
- **ActorWaiter 调用位置**：`tool/actor.ts:47`
- **TaskRegistry 调用位置**：`tool/todo.ts:40`
- **验证命令**：
  ```bash
  rg -n "yield\* actorRegistry\.|yield\* actorSpawn\.|yield\* actorWaiter\.|yield\* taskRegistry\." packages/opencode/src/tool/*.ts
  ```

#### 增强工具

- **actor tool**: `packages/opencode/src/tool/actor.ts`
- **history tool**: `packages/opencode/src/tool/history.ts`
- **memory tool**: `packages/opencode/src/tool/memory.ts`
- **workflow tool**: `packages/opencode/src/tool/workflow.ts`
- **screenshot tool**: `packages/opencode/src/tool/screenshot.ts`
- **multiedit tool**: `packages/opencode/src/tool/multiedit.ts`
- **验证命令**：
  ```bash
  rg -n "not implemented" packages/opencode/src/tool/*.ts --type ts
  # 输出应为空
  ```

### 4.2 未接入主链路模块详情

#### Evolution

- **文件**：`packages/opencode/src/evolution/evolution.ts`
- **已实现**：`matchPairs`, `filterDirty`, `exportToJsonl`, `exportSession`
- **未调用**：`evolution.exportSession(sessionID)` 未在 `prompt.ts` runLoop 末尾调用
- **依赖**：Trace.Service, FSUtil.Service

#### Team

- **文件**：`packages/opencode/src/team/team.ts`
- **已实现**：`addMemberToOwnerSession`, `getOrCreateTeam`, `formatTeamByOwnerSession`
- **未调用**：未在 `tool/actor.ts` spawn 后、`tool/task.ts` 创建子 session 后调用
- **依赖**：Database.Service
- **数据库**：team / team_member 表已创建

#### AST

- **文件**：`packages/opencode/src/ast/ast.ts`
- **已实现**：`buildDependencyGraph`, `analyzeChangedFiles`, `calculateBlastRadius`
- **未调用**：未在 `processor.ts` tool-result 后提取变更文件，未在 `prompt.ts` runLoop 末尾分析
- **依赖**：FSUtil.Service

#### Workflow

- **文件**：`packages/opencode/src/workflow/workflow.ts`
- **已实现**：`startRun`, `completeRun`, `getRunsBySession`, `cancelRunBySession`
- **未调用**：`prompt.ts` runLoop 未调用 startRun/completeRun（`tool/workflow.ts` 已调用）
- **依赖**：Database.Service
- **数据库**：workflow_run 表已创建

#### Scheduler

- **文件**：`packages/opencode/src/scheduler/scheduler.ts`
- **已实现**：`selectTasks`, `formatBudget`
- **未调用**：无明确调用点
- **依赖**：无外部依赖

#### OpenSpec / OpenSpecJudge / OpenSpecHook

- **文件**：`packages/opencode/src/openspec/*.ts`
- **已实现**：spec 解析、judge 合规检查、hook 触发、converter、writer
- **已注册**：OpenSpec / OpenSpecJudge 已在 `app-runtime.ts` 注册
- **未注册**：OpenSpecHook 未在 `app-runtime.ts` 注册
- **未调用**：`OpenSpecHook.checkAfterToolCall` 未在 `processor.ts` 调用
- **CLI 可用**：`opencode spec list/show/verify`（使用 OpenSpec + OpenSpecJudge）

---

## 五、数据库迁移状态

| 表/迁移 | 迁移文件 | 状态 |
|---------|---------|------|
| team / team_member | `20260630_add_team` | 已注册到 migration.gen.ts |
| workflow_run | `20260630_add_workflow_run` | 已注册到 migration.gen.ts |
| memory_fts | `20260630_add_memory_fts` | 工作区中，未提交 |

**注意**：迁移文件已存在，但运行时是否已应用取决于用户本地数据库。接入 Team/Workflow 前需确认迁移已执行。

---

## 六、Gap 分析

### 6.1 接入层 Gap

| Gap | 影响 | 优先级 |
|------|------|--------|
| 6 个服务未接入主链路 | 核心能力不工作 | P0 |
| OpenSpecHook 未注册 | 即使想接入也缺少依赖 | P0 |
| prompt.ts / processor.ts node deps 未声明新模块 | 可能导致运行时依赖缺失 | P1 |

### 6.2 实现层 Gap

| Gap | 影响 | 优先级 |
|------|------|--------|
| ActorWaiter HEAD 为 stub | 当前已提交代码中 actor wait/status 无意义 | P1 |
| Shadow Worktree 未转 Effect Service | 无法注入到主链路 | P2 |
| History 系统无独立 Service | 只有 tool 实现，缺少服务抽象 | P2 |
| Memory Vector Store 未使用 | 仅 FTS 搜索，未启用向量检索 | P2 |

### 6.3 缺失能力 Gap

| Gap | 影响 | 优先级 |
|------|------|--------|
| Inbox 系统 | Actor 间无法通信 | P2 |
| Auto-Dev Scheduler | 无外部自动化流水线 | P3 |
| Judge System + Max 模式 | 无对抗性审查和并行候选 | P3 |
| Distill Agent 独立模块 | 工作流蒸馏能力弱 | P3 |
| V2 Plugin 完整实现 | 插件扩展能力受限 | P3 |

---

## 七、风险评估

### 7.1 高风险 P0

| 风险 | 说明 | 缓解 |
|------|------|------|
| 文档与代码状态不一致 | 多个文档声称"已完成"，实际未接入 | 统一使用本状态文档，每次修改后更新 |
| dormant 服务占用资源 | 8 个服务注册但未调用，增加启动负担和编译依赖 | 接入主链路或从 AppLayer 移除 |

### 7.2 中风险 P1

| 风险 | 说明 | 缓解 |
|------|------|------|
| ActorWaiter HEAD 与 工作区不一致 | 已提交代码为 stub，工作区已修复但未提交；修改引入了 ActorRegistry 依赖 | 立即提交并验证 app-runtime.ts 依赖 |
| 实验性工具默认关闭 | 用户可能不知道需要开启 flag | 文档说明 + 考虑默认开启稳定工具 |
| 模块间职责边界不清 | Workflow Service 与 Workflow Tool 都管理 workflow | 明确分工：Service 负责生命周期，Tool 负责脚本执行 |

### 7.3 低风险 P2

| 风险 | 说明 | 缓解 |
|------|------|------|
| Inbox/Shadow Worktree 等未实现 | 不影响当前核心功能 | 按优先级排期 |

---

## 八、推荐行动方案

### 8.1 立即执行（本周内）

1. **提交当前工作区修改**
   - `packages/opencode/src/actor/waiter.ts`
   - `packages/core/src/memory/service.ts`
   - `packages/opencode/src/tool/workflow.ts`
   - `packages/core/src/database/schema.gen.ts`
   - `packages/core/src/database/migration/20260630_add_memory_fts.ts`

2. **接入 5 个 dormant 服务到主链路**（Phase 6）
   - Workflow: prompt.ts runLoop 生命周期
   - Team: tool/actor.ts + tool/task.ts
   - AST: processor.ts + prompt.ts
   - Evolution: prompt.ts runLoop 末尾
   - Scheduler: 明确调用点后再接入（当前无合适调用点）

3. **接入 OpenSpec 主链路**
   - 在 `app-runtime.ts` 注册 `OpenSpecHook.defaultLayer`
   - 在 `processor.ts` tool-result 后调用 `openSpecHook.checkAfterToolCall`
   - OpenSpec/OpenSpecJudge 由 OpenSpecHook 间接调用，无需单独接入主链路

4. **更新 node deps**
   - `prompt.ts` LayerNode deps 添加 Workflow.node, Team.node, AST.node, Evolution.node
   - `processor.ts` LayerNode deps 添加 AST.node, OpenSpecHook.node
   - `tool/actor.ts` 和 `tool/task.ts` 如需 Team 服务，也需更新 node deps

### 8.2 短期执行（2 周内）

5. 验证 memory/history/workflow/screenshot 工具稳定性
6. 明确 Workflow Service vs Workflow Tool 职责边界
7. 将 Shadow Worktree 转为 Effect Service 并注册

### 8.3 长期执行（按需）

8. 实现 Inbox 系统
9. 实现 Auto-Dev Scheduler 外部脚本
10. 实现 Judge System + Max 模式
11. 完成 V2 Plugin 系统

---

## 九、交付保障机制

### 9.1 五阶段流程

```
清理 → 验证 → 设计 → 实施 → 验收
```

### 9.2 质量门禁

每模块接入后必须：

```bash
# 1. 编译通过
bun typecheck

# 2. 调用点存在
rg -n "yield\* <module>\." packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts packages/opencode/src/tool/*.ts --type ts

# 3. node deps 声明
rg -n "<Module>\.node" packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts

# 4. 无新增 stub
rg -n "not implemented" packages/opencode/src/tool/*.ts --type ts

# 5. 错误隔离
rg -n "Effect\.(catchAll|ignore|forkIn)" packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts
```

### 9.3 回滚策略

每个模块独立 commit：

```bash
git revert <module-commit-hash>
```

---

## 十、附录

### 10.1 验证命令汇总

```bash
# 查看注册的服务
rg -n "\.defaultLayer," packages/opencode/src/effect/app-runtime.ts

# 查看 prompt.ts 中调用的服务
rg -n "yield\* [a-zA-Z][a-zA-Z0-9]*\." packages/opencode/src/session/prompt.ts --type ts

# 查看 processor.ts 中调用的服务
rg -n "yield\* [a-zA-Z][a-zA-Z0-9]*\." packages/opencode/src/session/processor.ts --type ts

# 查看工具 stub
rg -n "not implemented" packages/opencode/src/tool/*.ts --type ts

# 编译检查
cd packages/opencode && bun typecheck
```

### 10.2 相关文档

- `DEVELOPMENT_PLAN.md` — 能力集成开发计划（Memory Vector Store、History、Inbox、Judge+Max）
- `DEAD_CODE_ACTIVATION_PLAN.md` — 死代码激活规划（Phase 1-6 已完成）
- `TRANSFORM_PLAN.md` — Helix 能力移植原始规划
- `MEMORY.md` — 项目记忆
