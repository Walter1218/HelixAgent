# HelixAgent 主链路接入测试验收计划

> 目标：为主链路接入的 6 个服务（Workflow、Team、AST、OpenSpecHook、Evolution、Scheduler）制定可执行的测试与验收方案
> 创建日期: 2026-06-30
> 前置文档: `MAIN_CHAIN_INTEGRATION_EXECUTION_PLAN.md`

---

## 一、测试原则

1. **测试真实实现**：不 duplicate 业务逻辑到测试，不滥用 mock。参考 `test/AGENTS.md`。
2. **服务层用 Effect Test**：使用 `testEffect` + `it.instance` / `it.live`。
3. **集成层用真实 DB + 文件系统**：使用 `provideTmpdirInstance` 或 `tmpdirScoped`。
4. **主链路改动后必须 typecheck + test**：每次接入一个模块后运行 `bun typecheck` 和受影响的测试。
5. **测试即文档**：每个验收标准对应一个可运行的测试或命令。

---

## 二、测试分层

```
┌─────────────────────────────────────┐
│  L3: E2E / 手动验证                  │  真实 LLM + 真实文件系统 + 真实 DB
├─────────────────────────────────────┤
│  L2: 主链路集成测试                   │  prompt.ts / processor.ts 调用验证
├─────────────────────────────────────┤
│  L1: 服务层集成测试                   │  Workflow/Team/AST/Evolution/OpenSpecHook Service
├─────────────────────────────────────┤
│  L0: 纯函数单元测试                   │  matchPairs, calculateBlastRadius, buildDependencyGraph
└─────────────────────────────────────┘
```

---

## 三、L0: 纯函数单元测试

### 3.1 AST 纯函数

**文件**: `packages/opencode/test/ast/ast.test.ts`（新建）

```ts
import { describe, it, expect } from "bun:test"
import { calculateBlastRadius, extractContract } from "@/ast/ast"

describe("AST pure functions", () => {
  it("calculateBlastRadius finds direct dependents", () => {
    const deps = new Map([
      ["a.ts", ["b.ts", "c.ts"]],
      ["b.ts", ["d.ts"]],
      ["c.ts", []],
      ["d.ts", []],
    ])
    const result = calculateBlastRadius("a.ts", deps)
    expect(result.file).toBe("a.ts")
    expect(result.dependents).toContain("b.ts")
    expect(result.dependents).toContain("c.ts")
    expect(result.dependents).toContain("d.ts")
  })

  it("extractContract finds exports", () => {
    const content = `export class Foo { bar() {} }\nexport function baz() {}`
    const contract = extractContract(content)
    expect(contract.classes.map((c) => c.name)).toContain("Foo")
    expect(contract.functions.map((f) => f.name)).toContain("baz")
    expect(contract.exports).toContain("Foo")
    expect(contract.exports).toContain("baz")
  })
})
```

### 3.2 Evolution 纯函数

**文件**: `packages/opencode/test/evolution/evolution.test.ts`（新建）

```ts
import { describe, it, expect } from "bun:test"
import { matchPairs, filterDirtyTraces } from "@/evolution/evolution"

describe("Evolution pure functions", () => {
  it("matchPairs matches same tool with different outcomes", () => {
    const traces = [
      { name: "tool.write", status: "success", type: "action" },
      { name: "tool.write", status: "failed", type: "action" },
    ]
    const pairs = matchPairs(traces as any)
    expect(pairs.length).toBe(1)
    expect(pairs[0].reason).toContain("tool.write")
  })

  it("filterDirtyTraces removes rate limit failures", () => {
    const traces = [
      { status: "failed", type: "action", metadata: { error: "rate limit exceeded" } },
      { status: "failed", type: "action", metadata: { error: "file not found" } },
    ]
    const clean = filterDirtyTraces(traces as any)
    expect(clean.length).toBe(1)
    expect(clean[0].metadata.error).toBe("file not found")
  })
})
```

### 3.3 Scheduler 纯函数

**文件**: `packages/opencode/test/scheduler/scheduler.test.ts`（新建）

```ts
import { describe, it, expect } from "bun:test"
import { selectTasks, DEFAULT_SCHEDULE_CONFIG } from "@/scheduler/scheduler"

describe("Scheduler pure functions", () => {
  it("selectTasks respects daily budget", () => {
    const tasks = [
      { id: "1", estimatedTokens: 600000, status: "pending", priority: "high" },
      { id: "2", estimatedTokens: 500000, status: "pending", priority: "medium" },
    ]
    const result = selectTasks(tasks as any, DEFAULT_SCHEDULE_CONFIG)
    expect(result.selected.length).toBe(1)
    expect(result.deferred.length).toBe(1)
    expect(result.totalTokens).toBeLessThanOrEqual(DEFAULT_SCHEDULE_CONFIG.dailyBudget)
  })
})
```

### 3.4 Scheduler 与 Todo 集成

**文件**: `packages/opencode/test/tool/todo.test.ts`（新建，若不存在）

测试 `tool/todo.ts` 更新 todo 后调用 `selectTasks` 并输出日志。由于该调用仅日志记录，可通过检查无运行时错误来验证。

### 3.5 Scheduler Token 预算守卫

**文件**: 复用 `test/session/prompt.test.ts` 或在 `test/session/prompt-scheduler.test.ts` 新建

构造一个 session，使其累计 token 超过 `DEFAULT_SCHEDULE_CONFIG.dailyBudget`，验证：
- `runLoopBody` 在预算超限时主动退出
- 日志中出现 `scheduler: daily token budget exceeded`

---

## 四、L1: 服务层集成测试

**前置条件**：使用 `Database.defaultLayer` 的测试需要确保 SQLite 数据库已初始化且迁移已应用。`testEffect` 会自动处理运行时，但如果测试直接操作表，需确认 `packages/core/src/database/migration.gen.ts` 包含相关迁移。

**测试隔离**：每个测试使用独立的临时目录和独立的数据库状态，避免测试间相互污染。

### 4.1 Workflow Service

**文件**: `packages/opencode/test/workflow/workflow.test.ts`（新建）

```ts
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { Workflow } from "@/workflow/workflow"
import { Database } from "@opencode-ai/core/database/database"

const it = testEffect(Layer.mergeAll(Workflow.defaultLayer, Database.defaultLayer))

describe("Workflow Service", () => {
  it.live("creates and completes a run", () =>
    Effect.gen(function* () {
      const workflow = yield* Workflow.Service
      const run = yield* workflow.startRun({ sessionID: "test-session", name: "Test" })
      expect(run.status).toBe("running")
      
      yield* workflow.completeRun(run.runID, "completed")
      const runs = yield* workflow.getRunsBySession("test-session")
      expect(runs.length).toBe(1)
      expect(runs[0].status).toBe("completed")
    }),
  )
})
```

### 4.2 Team Service

**文件**: `packages/opencode/test/team/team.test.ts`（新建）

```ts
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { Team } from "@/team/team"
import { Database } from "@opencode-ai/core/database/database"

const it = testEffect(Layer.mergeAll(Team.defaultLayer, Database.defaultLayer))

describe("Team Service", () => {
  it.live("adds member and retrieves team", () =>
    Effect.gen(function* () {
      const team = yield* Team.Service
      yield* team.addMemberToOwnerSession("owner-1", {
        sessionID: "member-1",
        agent: "build",
        role: "actor",
        joinedAt: Date.now(),
      })
      const info = yield* team.formatTeamByOwnerSession("owner-1")
      expect(info).toContain("member-1")
      expect(info).toContain("build")
    }),
  )
})
```

### 4.3 AST Service

**文件**: `packages/opencode/test/ast/service.test.ts`（新建）

```ts
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { AST } from "@/ast/ast"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { tmpdirScoped, TestInstance } from "../fixture/fixture"

const it = testEffect(Layer.mergeAll(AST.defaultLayer, FSUtil.defaultLayer))

describe("AST Service", () => {
  it.instance("builds dependency graph for simple project", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const ast = yield* AST.Service
      
      // Create files
      yield* Effect.promise(() => Bun.write(`${test.directory}/a.ts`, `import { b } from "./b"`))
      yield* Effect.promise(() => Bun.write(`${test.directory}/b.ts`, `export const b = 1`))
      
      const graph = yield* ast.buildDependencyGraph(test.directory)
      expect(graph.get(`${test.directory}/a.ts`)).toContain(`${test.directory}/b.ts`)
    }),
  )
})
```

### 4.4 Evolution Service

**文件**: `packages/opencode/test/evolution/service.test.ts`（新建）

```ts
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { Evolution } from "@/evolution/evolution"
import { Trace } from "@/trace/trace"
import { FSUtil } from "@opencode-ai/core/fs-util"

const it = testEffect(Layer.mergeAll(Evolution.defaultLayer, Trace.defaultLayer, FSUtil.defaultLayer))

describe("Evolution Service", () => {
  it.live("exportSession returns empty result for few traces", () =>
    Effect.gen(function* () {
      const evolution = yield* Evolution.Service
      const result = yield* evolution.exportSession("session-with-few-traces")
      expect(result.pairCount).toBe(0)
      expect(result.outputPath).toBeUndefined()
    }),
  )
})
```

### 4.5 OpenSpecHook Service

**文件**: `packages/opencode/test/openspec/hook.test.ts`（新建）

```ts
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { OpenSpecHook } from "@/openspec/hook"
import { OpenSpec } from "@/openspec/spec"
import { OpenSpecJudge } from "@/openspec/judge"
import { TestInstance } from "../fixture/fixture"

const it = testEffect(
  Layer.mergeAll(OpenSpecHook.defaultLayer, OpenSpec.defaultLayer, OpenSpecJudge.defaultLayer),
)

describe("OpenSpecHook Service", () => {
  it.instance("detects affected spec for modified file", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const hook = yield* OpenSpecHook.Service
      
      // Create a spec that monitors a specific file
      const specDir = `${test.directory}/openspec/specs`
      yield* Effect.promise(() =>
        Bun.file(`${specDir}/test-spec.md`).write(`# Test Spec\n\n## Overview\n\n## Requirements\n\n### REQ-1\n\nMonitor file.\n\n- Acceptance Criteria:\n  - file exists\n- Verification:\n  - Type: grep\n  - Target: monitored.ts\n`)
      )
      
      const result = yield* hook.checkAfterToolCall("write", `${test.directory}/monitored.ts`)
      expect(result.affectedSpecs.length).toBeGreaterThan(0)
    }),
  )
})
```

---

## 五、L2: 主链路集成测试

### 5.1 prompt.ts 调用点验证

**方式**: 不新增测试文件，用 `rg` 命令验证。

每个模块接入后执行：

```bash
# Workflow
rg -n "workflow\.startRun|workflow\.completeRun" packages/opencode/src/session/prompt.ts

# Team
rg -n "serviceOption\(Team\.Service\)|formatTeamByOwnerSession" packages/opencode/src/session/prompt.ts

# AST
rg -n "serviceOption\(AST\.Service\)|analyzeChangedFiles|getChangedFiles" packages/opencode/src/session/prompt.ts

# Evolution
rg -n "serviceOption\(Evolution\.Service\)|exportSession" packages/opencode/src/session/prompt.ts

# Scheduler
rg -n "serviceOption\(Scheduler\.Service\)|DEFAULT_SCHEDULE_CONFIG" packages/opencode/src/session/prompt.ts
```

### 5.2 processor.ts 调用点验证

```bash
# AST
rg -n "serviceOption\(AST\.Service\)|recordChangedFiles" packages/opencode/src/session/processor.ts

# OpenSpecHook
rg -n "serviceOption\(OpenSpecHook\.Service\)|checkAfterToolCall" packages/opencode/src/session/processor.ts
```

### 5.3 node deps / defaultLayer 验证

```bash
# prompt.ts
rg -n "Workflow\.node|Team\.node|AST\.node|Evolution\.node|Scheduler\.node" packages/opencode/src/session/prompt.ts
rg -n "Workflow\.defaultLayer|Team\.defaultLayer|AST\.defaultLayer|Evolution\.defaultLayer|Scheduler\.defaultLayer" packages/opencode/src/session/prompt.ts

# processor.ts
rg -n "AST\.node" packages/opencode/src/session/processor.ts
rg -n "AST\.defaultLayer|OpenSpecHook\.defaultLayer" packages/opencode/src/session/processor.ts

# tool/registry.ts
rg -n "Scheduler\.node" packages/opencode/src/tool/registry.ts
rg -n "Scheduler\.defaultLayer" packages/opencode/src/tool/registry.ts

# app-runtime.ts
rg -n "OpenSpecHook\.defaultLayer|Scheduler\.defaultLayer" packages/opencode/src/effect/app-runtime.ts
```

### 5.4 现有测试更新

接入新服务后，`test/session/prompt.test.ts` 可能因 `SessionPrompt.defaultLayer` 新增了依赖而需要更新。由于本次实现大量使用了 `Effect.serviceOption`，大多数 tool 测试不需要新增 layer。`prompt.test.ts` 若直接使用 `SessionPrompt.layer` 而非 `defaultLayer`，则需要手动提供新增服务。

例如：

```ts
const it = testEffect(
  Layer.mergeAll(
    SessionPrompt.defaultLayer,
    Workflow.defaultLayer,
    Team.defaultLayer,
    AST.defaultLayer,
    Evolution.defaultLayer,
    Scheduler.defaultLayer,
  ),
)
```

**重要**：这不是 mock，是提供真实的 defaultLayer，让测试使用真实服务。

---

## 六、L3: E2E / 手动验证

### 6.1 Workflow E2E

**步骤**：
1. 启动 TUI：`tmux new-session -d -s opencode-dev 'bun dev'`
2. 创建新 session，发送任意消息
3. 检查 DB：`SELECT * FROM workflow_run WHERE session_id = '<session-id>'`
4. 验证：有 1 条记录，status 从 `running` 变为 `completed`
5. 取消 session，验证 status 变为 `cancelled`

**命令**：
```bash
# 找到当前 instance 的 SQLite 文件路径（如 ~/.local/share/opencode/<instance>/database.sqlite）
sqlite3 <instance-db-path> "SELECT run_id, status, completed_at FROM workflow_run WHERE session_id = '...'"
```

### 6.2 Team E2E

**步骤**：
1. 在 session 中调用 actor tool spawn
2. 检查 DB：`SELECT * FROM team_member WHERE team_id IN (SELECT id FROM team WHERE owner_session_id = '<session-id>')`
3. 验证：有 member 记录，agent 和 role 正确

### 6.3 AST E2E

**步骤**：
1. 在项目中修改一个 util 文件
2. 让 LLM 调用 write/edit/apply_patch 修改该文件
3. 查看日志：应出现 `ast: blast radius` 信息
4. 验证：dependents 数量合理

### 6.4 OpenSpecHook E2E

**步骤**：
1. 创建 `openspec/specs/test/spec.md`，定义一个 requirement，verification target 指向某个文件
2. 让 LLM 修改该文件，使其不满足 requirement
3. 查看日志：应出现 `openspec: compliance check failed` 警告
4. 修改文件使其满足 requirement
5. 验证：无警告

### 6.5 Evolution E2E

**注意**：测试完成后清理 `.dogfooding/dpo_pairs/` 目录，避免影响后续测试。

**步骤**：
1. 运行一个长 session，产生至少 10 个 trace 事件（工具调用成功/失败）
2. 结束 session
3. 检查 `.dogfooding/dpo_pairs/<date>.jsonl`
4. 验证：文件存在，包含 DPO pair

---

## 七、验收标准与测试映射

| 验收标准 | 测试层级 | 验证方式 |
|---------|---------|---------|
| Workflow 每个 session 有完整生命周期记录 | L1 + L3 | Service 测试 + DB 查询 |
| Team 调用 actor/task 后 team_member 有记录 | L1 + L3 | Service 测试 + DB 查询 |
| AST 文件修改后日志输出 blast radius | L0 + L2 + L3 | 纯函数测试 + rg 调用点 + 手动验证 |
| OpenSpecHook 修改受 spec 约束文件后触发检查 | L1 + L2 + L3 | Service 测试 + rg 调用点 + 手动验证 |
| Evolution session 结束后导出 DPO JSONL | L1 + L3 | Service 测试 + 文件检查 |
| 接入后主链路仍稳定 | L2 | 现有测试不失败 + typecheck 通过 |

---

## 八、测试执行命令

### 8.1 每次接入 Step 后必须执行

```bash
cd packages/opencode

# 1. 编译
bun typecheck

# 2. 新增服务单元/集成测试
bun test test/workflow/workflow.test.ts --timeout 30000
bun test test/team/team.test.ts --timeout 30000
bun test test/ast/ast.test.ts test/ast/service.test.ts --timeout 30000
bun test test/evolution/evolution.test.ts test/evolution/service.test.ts --timeout 30000
bun test test/openspec/hook.test.ts --timeout 30000

# 3. 受影响的现有测试
bun test test/session/prompt.test.ts --timeout 30000
bun test test/tool/actor.test.ts test/tool/task.test.ts --timeout 30000

# 4. 主链路调用点验证
rg -n "yield\* (workflow|team|ast|evolution|openSpecHook)\." src/session/prompt.ts src/session/processor.ts src/tool/*.ts --type ts
```

### 8.2 全量回归

```bash
cd packages/opencode
bun typecheck
bun test --timeout 30000 2>&1 | tail -50
```

**必须全量通过**才能认为该 Step 完成。

### 8.3 手动验证脚本

```bash
# 启动 TUI
tmux new-session -d -s opencode-dev 'bun dev'

# 检查 workflow_run
sqlite3 ~/.local/share/opencode/state.db "SELECT run_id, session_id, status FROM workflow_run;"

# 检查 team_member
sqlite3 ~/.local/share/opencode/state.db "SELECT session_id, agent, role FROM team_member;"

# 检查 DPO 导出
ls -la .dogfooding/dpo_pairs/
```

---

## 九、测试数据准备

### 9.1 OpenSpec 测试 Spec

```markdown
# Test Feature

## Overview

This is a test spec for OpenSpec verification.

## Requirements

### REQ-1: Title

The project must always contain a file named `REQUIRED.txt`.

- Acceptance Criteria:
  - `REQUIRED.txt` exists in the project root
- Verification:
  - Type: grep
  - Target: REQUIRED.txt
```

### 9.2 AST 测试项目结构

```
test-project/
├── utils.ts        # export helper()
├── feature-a.ts    # import { helper } from "./utils"
└── feature-b.ts    # import { helper } from "./utils"
```

修改 `utils.ts` 后，AST 应报告 `feature-a.ts` 和 `feature-b.ts` 为 dependents。

### 9.3 Evolution Trace 生成

运行一个 session，让 LLM 多次调用同一个 tool，部分成功、部分失败（例如让 LLM 写入已存在文件触发失败）。

---

## 十、风险与注意事项

1. **测试可能因 DB 迁移未应用而失败**：运行测试前确保 migration 已执行。
2. **actor/waiter.ts 工作区修改未提交**：测试 HEAD 版本时 ActorWaiter 为 stub，测试工作区版本时才真实。
3. **OpenSpecHook 测试需要临时 spec 文件**：测试后清理，避免污染项目。
4. **AST 测试对大项目慢**：单元测试只测纯函数，服务层测试用小项目。
5. **现有测试可能 flaky**：接入新服务后，若现有测试提供 layer 不完整，会报类型错误，需逐一修复。

---

## 十一、Checklist（每个 Step 完成后打勾）

- [ ] 新增/更新了服务层测试
- [ ] 新增/更新了纯函数单元测试
- [ ] 更新了受影响的现有测试的 layer 提供
- [ ] `bun typecheck` 通过
- [ ] 相关 `bun test` 通过
- [ ] 手动验证完成并记录结果
- [ ] 文档 `HELIX_AGENT_STATUS.md` 状态已更新
