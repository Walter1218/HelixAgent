# HelixAgent 短期攻坚方向：高质量任务交付保障体系

> 版本：v2.0（完美版）
> 适用范围：未来 4-5 个月
> 目标：构建"需求可结构化 → Spec 可生成 → 执行可监控 → 交付可验收 → 过程可追溯"的完整质量保障闭环，让 HelixAgent 成为真正能保障任务交付质量的智能体。

---

## 一、核心思想

用户不必会写 spec。HelixAgent 应该通过多智能体协作，自动把模糊需求转化为**高质量、可执行、可验证的 spec**，并全程按 spec 驱动执行和验收。

质量保障体系的起点不是代码修改阶段，而是**需求输入阶段**。

---

## 二、完美版质量保障闭环

```
用户输入需求
    │
    ▼
┌─────────────────────────────┐
│  Layer 0: 需求结构化          │
│  - 多智能体 Spec 生成 pipeline │
│  - 生成高质量 OpenSpec         │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Layer 1: 执行前验收          │
│  - Goal Judge 确认目标可达成   │
│  - Cardinal 预检风险           │
│  - OpenSpec pre-check         │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Layer 2: 执行中监控          │
│  - Trace 记录每个动作          │
│  - Cardinal 实时拦截风险       │
│  - AlignmentGuard 检测偏离     │
│  - OpenSpec 持续验证          │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Layer 3: 执行后验收          │
│  - OpenSpec 最终验证          │
│  - 测试/类型检查自动运行       │
│  - Goal Judge 判定完成度       │
│  - AST 影响分析               │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Layer 4: 持续改进            │
│  - Trace 持久化复盘            │
│  - Evolution 导出训练数据      │
│  - Spec 库积累组织知识         │
└─────────────────────────────┘
```

---

## 三、当前核心问题

HelixAgent 已搭建质量保障的"骨架"，但多数机制尚未有效运行：

| 模块 | 当前状态 | 主要问题 |
|------|---------|---------|
| **多智能体 Spec 生成** | 未实现 | 用户需手动写 spec，spec 质量参差不齐 |
| **Cardinal** | 已接入 `processor.ts` | 调用时仅传入 `taskId/taskTitle/tokensUsed/totalBudget`，5 条规则中 4 条基本无法触发 |
| **OpenSpecHook** | 已接入 `processor.ts` | 检测失败仅 `logWarning`，不阻止代码写入，也不反馈给模型修正 |
| **Trace** | 已接入 `processor.ts` | 事件存在内存 `Ref` 中，进程重启丢失，无法持久复盘 |
| **Goal** | 已接入 `prompt.ts` | `/goal` 设置未暴露，`judgeEnabled` 分支实际只是轮数计数（≥12 break） |
| **AlignmentGuard** | 已接入 `prompt.ts` | 主链路只调用 `detectRabbitHole`，`detectFileDrift`/`detectDistraction` 未使用 |
| **AST** | 已接入主链路 | 结果仅用于日志，未作为质量门禁；依赖图用正则解析 import，准确率有限 |
| **Workflow** | 已接入 `runLoop` 生命周期 | 只是 session 运行状态记录；`workflow` 工具默认关闭，且只是异步 shell 执行器 |
| **测试体系** | 已有存在性/集成测试 | 缺少端到端"agent 执行 → 自动验收"的行为测试 |

项目自身在 `DELIVERY_ASSURANCE_PLAN.md` 中也承认：文档与代码脱节、注册≠集成。当前已从"注册≠集成"演进为"集成≠有效"。

---

## 四、攻坚目标

用 4-5 个月，把 HelixAgent 从"模块多但生效少"提升到：

> **需求可结构化、Spec 可生成、执行有监控、违规有阻断、交付有判定、过程可追溯。**

具体表现为：

1. 用户输入需求后，系统自动生成可验证 spec，人工确认后执行。
2. 执行前有风险预检，高风险操作需要确认。
3. 执行中 Cardinal / OpenSpec / AlignmentGuard 实时生效。
4. 执行后有完整验收报告（spec 达成度 + 测试结果 + goal 判定）。
5. 所有关键事件持久化，可跨 session 查询和复盘。
6. 有 6+ 个端到端场景测试保障质量闭环。
7. Spec 库和 Trace 库开始积累组织知识。

---

## 五、分阶段攻坚计划

### Phase 0：基础设施（2 周）

**目标**：为 spec 生成和质量保障体系打好基础。

#### 0.1 Trace 持久化

**文件**：
- 新建 `packages/core/src/trace/trace.sql.ts`
- 新建 `packages/core/src/database/migration/20260707_add_trace_event.ts`
- 改造 `packages/opencode/src/trace/trace.ts`

**表结构**：

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

**改动**：
- `Trace.emit` 写入 SQLite
- `Trace.getTraces` 按 `session_id` 查询并按时间排序
- 所有 `trace.emit` 调用补齐 `duration`

#### 0.2 OpenSpec 基础能力补全

**文件**：`packages/opencode/src/openspec/spec.ts`

**改动**：
- 实现 `ast` verification 类型
- target 格式：`file:pattern`
- 读取文件内容，检查 pattern 是否存在

#### 0.3 Cardinal 上下文补齐

**文件**：`packages/opencode/src/session/processor.ts`

**改动**：
- 新增 `buildCardinalContext`
- 传入完整字段：taskId、taskTitle、diff、changedFiles、estimatedFiles、consecutiveFailures、alignmentAlerts、tokensUsed、totalBudget

#### 0.4 统一事件 Schema

**文件**：
- `packages/opencode/src/session/cardinal.ts`
- `packages/opencode/src/observability/alignment-guard.ts`
- `packages/opencode/src/trace/trace.ts`
- `packages/opencode/src/openspec/hook.ts`

**改动**：
- 统一 `TraceEvent`、`CardinalDecision`、`SpecCheckResult` 的数据结构
- 确保所有事件都有 `sessionID`、`timestamp`、`metadata`

#### 验收标准
- [ ] Trace 数据写入 SQLite，进程重启不丢失
- [ ] `ast` verification 可用
- [ ] Cardinal 调用时 5 个字段全部传齐
- [ ] `bun typecheck` 通过

---

### Phase 1：多智能体 Spec 生成 MVP（3 周）

**目标**：实现 req → accept → merge → review 的最小闭环。

#### 1.1 专业 Agent 设计

#### 1.1.1 req-agent：需求解构

**输入**：
```ts
interface ReqAgentInput {
  userPrompt: string
  sessionHistory: string[]
  projectMemory?: string
}
```

**输出**：
```ts
interface ReqAgentOutput {
  coreGoal: string
  requirementDrafts: RequirementDraft[]
  constraints: string[]
  assumptions: string[]
  openQuestions: string[]
  domain: string
}

interface RequirementDraft {
  id: string
  title: string
  description: string
  type: "functional" | "non-functional" | "security" | "performance" | "ux" | "compatibility"
  priority: "must" | "should" | "nice-to-have"
  dependencies: string[]
}
```

**Prompt 核心**：
```markdown
You are a requirements analyst. Decompose the user's request into clear, structured requirements.

Rules:
- Identify the core goal in one sentence.
- Break down into atomic, independently verifiable requirements.
- Mark each requirement as functional/non-functional/security/performance/ux/compatibility.
- Assign priority: must / should / nice-to-have.
- List assumptions and open questions.

Output strictly as JSON matching the ReqAgentOutput schema.
```

**文件**：`packages/opencode/src/spec-generation/req-agent.ts`

---

#### 1.1.2 arch-agent：架构分析

**输入**：
```ts
interface ArchAgentInput {
  coreGoal: string
  requirementDrafts: RequirementDraft[]
  projectContext: {
    rootPath: string
    relevantFiles: string[]
    packageJson?: object
    memory?: string
  }
}
```

**输出**：
```ts
interface ArchAgentOutput {
  projectType: string
  techStack: string[]
  filesToModify: FileChange[]
  filesToCreate: FileChange[]
  modulesToReuse: ReuseModule[]
  interfaces: InterfaceContract[]
  dataFlow: string[]
  risks: Risk[]
  conventions: string[]
}
```

**Prompt 核心**：
```markdown
You are a software architect. Analyze the project context and determine how to implement the requirements.

Rules:
- Only propose changes to files that exist.
- Reuse existing modules and conventions.
- Define clear interface contracts.
- Identify risks and mitigations.

Output strictly as JSON matching the ArchAgentOutput schema.
```

**文件**：`packages/opencode/src/spec-generation/arch-agent.ts`

---

#### 1.1.3 accept-agent：验收设计

**输入**：
```ts
interface AcceptAgentInput {
  requirementDrafts: RequirementDraft[]
  architectureContext: ArchAgentOutput
}
```

**输出**：
```ts
interface AcceptAgentOutput {
  criteria: AcceptanceCriterion[]
  unverifiableRequirements: {
    requirementId: string
    reason: string
    suggestedAction: "manual" | "clarify" | "decompose"
  }[]
}

interface AcceptanceCriterion {
  requirementId: string
  description: string
  verification: Verification
  fallback?: Verification
  confidence: "high" | "medium" | "low"
  explanation: string
}

type Verification =
  | { type: "test"; target: string }
  | { type: "script"; target: string }
  | { type: "ast"; target: string }
  | { type: "grep"; target: string }
  | { type: "manual"; target: string }
```

**Prompt 核心**：
```markdown
You are a QA engineer. For each requirement, design an executable verification method.

Rules:
- Prefer automated verification: test > script > ast > grep > manual.
- Each verification target must be runnable in this project.
- If not automatically verifiable, mark manual and explain why.
- Rate confidence.

Output strictly as JSON matching the AcceptAgentOutput schema.
```

**文件**：`packages/opencode/src/spec-generation/accept-agent.ts`

---

#### 1.1.4 test-agent：验证预演

**输入**：
```ts
interface TestAgentInput {
  criteria: AcceptanceCriterion[]
  projectRoot: string
}
```

**输出**：
```ts
interface TestAgentOutput {
  results: {
    requirementId: string
    verification: Verification
    runnable: boolean
    actualOutput?: string
    error?: string
    suggestion?: string
  }[]
}
```

**职责**：
- 实际执行每个 verification target
- 不可运行的 verification 给出修正建议
- 对 `test` 类型检查测试文件是否存在
- 对 `ast` 类型检查文件路径和 pattern

**文件**：`packages/opencode/src/spec-generation/test-agent.ts`

---

#### 1.1.5 merge-agent：规格整合

**输入**：req-agent + arch-agent + accept-agent + test-agent 输出

**输出**：符合 OpenSpec 格式的 markdown 字符串

**Prompt 核心**：
```markdown
You are a technical writer. Combine requirements, architecture context, and acceptance criteria into a single OpenSpec markdown document.

Format:
- # Title
- ## Overview
- ## Requirements with ### Requirement N: Title
- Each requirement includes description, **Status**: pending, **Verification**: type `target`

Output the markdown directly.
```

**文件**：`packages/opencode/src/spec-generation/merge-agent.ts`

---

#### 1.1.6 review-agent：质量评审

**输入**：
```ts
interface ReviewAgentInput {
  specMarkdown: string
  config: SpecReviewConfig
}
```

**输出**：
```ts
interface ReviewReport {
  score: number
  verdict: "approve" | "revise" | "reject"
  issues: ReviewIssue[]
  strengths: string[]
  summary: string
}

interface ReviewIssue {
  category: "completeness" | "verifiability" | "clarity" | "security" | "performance" | "architecture" | "consistency" | "maintainability"
  severity: "blocker" | "warning" | "suggestion"
  requirementId?: string
  description: string
  fixSuggestion: string
}
```

**评审维度**：
- 完整性
- 可验证性
- 清晰性
- 安全性
- 性能
- 架构一致性
- 一致性
- 可维护性

**文件**：`packages/opencode/src/spec-generation/review-agent.ts`

---

#### 1.1.7 fix-agent：修复迭代

**输入**：spec markdown + review issues

**输出**：修正后的 spec markdown

**职责**：
- 按 severity 排序修复
- 修复后返回 review-agent 重新评审
- 最多迭代 N 次

**文件**：`packages/opencode/src/spec-generation/fix-agent.ts`

---

#### 1.2 顶层编排

**文件**：`packages/opencode/src/spec-generation/pipeline.ts`

```ts
export const generateSpec = Effect.fn("SpecGeneration.generateSpec")(function* (input: PipelineInput) {
  const reqOutput = yield* reqAgent.run(input)
  const archOutput = yield* archAgent.run({ reqOutput, projectContext: input.projectContext })
  const acceptOutput = yield* acceptAgent.run({ reqOutput, archOutput })
  const testOutput = yield* testAgent.run({ criteria: acceptOutput.criteria, projectRoot: input.projectRoot })
  
  // 根据 test-agent 结果修正 criteria
  const verifiedCriteria = yield* fixUnrunnableCriteria(acceptOutput.criteria, testOutput)
  
  const specMarkdown = yield* mergeAgent.run({ reqOutput, archOutput, criteria: verifiedCriteria })
  
  let report = yield* reviewAgent.review({ specMarkdown, config: input.config })
  let finalSpec = specMarkdown
  
  for (let i = 0; i < input.maxFixIterations && report.verdict === "revise"; i++) {
    finalSpec = yield* fixAgent.fix({ specMarkdown: finalSpec, issues: report.issues })
    report = yield* reviewAgent.review({ specMarkdown: finalSpec, config: input.config })
  }
  
  return { specMarkdown: finalSpec, report }
})
```

#### 1.3 用户交互

**CLI 命令**：
```bash
mimo /spec generate "给登录增加短信验证码"
mimo /spec generate --strict high "给登录增加短信验证码"
mimo /spec generate --from requirements.md
mimo /spec review openspec/specs/sms-login.md
mimo /spec fix openspec/specs/sms-login.md
```

**TUI**：
- 新增 `panel-spec-generation.tsx`
- 显示当前步骤、review score、issues
- 支持用户编辑和确认

#### 验收标准
- [ ] 7 个专业 agent 实现并通过单元测试
- [ ] `/spec generate` 命令可用
- [ ] 生成的 spec 符合 OpenSpec 格式
- [ ] review score ≥ 70 才能进入用户确认
- [ ] 用户确认后可写入 `openspec/specs/`
- [ ] `bun typecheck` 通过

---

### Phase 2：Spec 生成与执行链路打通（2 周）

**目标**：生成的 spec 能自动进入执行和验收流程。

#### 2.1 自动设置 Goal

**文件**：`packages/opencode/src/session/prompt.ts`

**改动**：
- 用户确认 spec 后，自动调用 `goal.set(sessionID, spec.coreGoal)`
- 把 spec 的 overview 也注入到 system context

#### 2.2 自动注册 Cardinal 规则

**文件**：`packages/opencode/src/session/cardinal.ts`

**改动**：
- 新增 `createSpecDerivedRules(spec: SpecDoc): CardinalRule[]`
- 从 spec 中提取 security / performance / compatibility 类型的 requirement
- 转换为 Cardinal 规则

#### 2.3 OpenSpecHook 读取生成 Spec

**文件**：`packages/opencode/src/session/processor.ts`

**改动**：
- 执行中 `tool-result` 后自动运行相关 verification
- 失败时把缺失要求返回给模型

#### 2.4 执行后自动生成验收报告

**文件**：`packages/opencode/src/openspec/report.ts`（新建）

**输出**：
```ts
interface SpecReport {
  specPath: string
  overallApproved: boolean
  requirementResults: {
    requirementId: string
    approved: boolean
    verification: Verification
    output?: string
    error?: string
  }[]
  missingRequirements: string[]
}
```

#### 验收标准
- [ ] 确认 spec 后自动设置 goal
- [ ] Cardinal 能从 spec 提取规则
- [ ] OpenSpecHook 按生成 spec 持续验证
- [ ] 执行后自动生成验收报告
- [ ] `bun typecheck` 通过

---

### Phase 3：执行前验收层（2 周）

**目标**：在执行大量修改前先做预检。

#### 3.1 Goal Judge 预检

**文件**：`packages/opencode/src/session/goal-judge.ts`（新建）

**输入**：session 历史 + spec coreGoal

**输出**：
```ts
interface Verdict {
  ok: boolean
  impossible: boolean
  reason: string
  missingContext?: string[]
}
```

**行为**：
- `ok`：继续执行
- `impossible`：结束并解释原因
- 其他：把 reason 注入上下文，继续

#### 3.2 Cardinal 预检

**文件**：`packages/opencode/src/session/prompt.ts`

**改动**：
- 在 runLoop 开始前，基于计划修改文件列表做风险评估
- 高风险操作需要用户确认

#### 3.3 OpenSpec Pre-check

**文件**：`packages/opencode/src/session/prompt.ts`

**改动**：
- 执行前扫描计划修改的文件是否命中 spec
- 提前提示可能的违规

#### 3.4 预检报告展示

**TUI / CLI**：
- 显示 Goal Judge 判断
- 显示 Cardinal 风险等级
- 显示 OpenSpec 预检结果

#### 验收标准
- [ ] Goal Judge 预检实际被调用
- [ ] Cardinal 预检能识别高风险操作
- [ ] OpenSpec Pre-check 能提前发现违规
- [ ] 预检报告可展示
- [ ] `bun typecheck` 通过

---

### Phase 4：完整执行中监控（2 周）

**目标**：v1.0 Phase 1-3 的完整落地。

#### 4.1 Cardinal 全部规则生效

**文件**：`packages/opencode/src/session/cardinal.ts`、`processor.ts`

**规则**：
- `security`：eval、Function、child_process、rm -rf、SQL 注入、密钥泄露
- `excessive_changes`：改动文件数超过预期 2 倍
- `consecutiveFailures`：连续失败 ≥3 次
- `alignment`：alignmentAlerts ≥3
- `token_limit`：token 超过预算 20%

#### 4.2 OpenSpec 失败反馈给模型

**文件**：`packages/opencode/src/session/processor.ts`

**改动**：
- `!result.allApproved` 时，向 session 插入 text part
- 列出缺失要求，要求模型修正

#### 4.3 AlignmentGuard 全部启用

**文件**：`packages/opencode/src/session/prompt.ts`

**改动**：
- `detectRabbitHole`：实时检测
- `detectDistraction`：检测无关命令
- `detectFileDrift`：检测文件偏离目标
- 异常次数累积到 `ctx.alignmentAlertCount`

#### 4.4 Trace 全程记录

**文件**：`packages/opencode/src/session/processor.ts`、`prompt.ts`

**改动**：
- 每个 tool call / result / error 记录 trace
- 每个 Cardinal 决策记录 trace
- 每个 OpenSpec 验证结果记录 trace
- 每个 Goal Judge 判定记录 trace

#### 验收标准
- [ ] Cardinal 5 条规则全部可触发
- [ ] OpenSpec 失败反馈给模型
- [ ] AlignmentGuard 3 个检测函数全部启用
- [ ] Trace 记录所有关键事件
- [ ] `bun typecheck` 通过

---

### Phase 5：执行后验收与判定（2 周）

**目标**：任务结束时有完整的验收报告。

#### 5.1 OpenSpec 最终验证

**文件**：`packages/opencode/src/openspec/report.ts`

**改动**：
- 运行所有 spec verification
- 生成 SpecReport

#### 5.2 自动化测试运行

**文件**：`packages/opencode/src/session/prompt.ts`

**改动**：
- 任务结束后自动运行：
  - `bun typecheck`
  - spec 中定义的 tests
  - 项目默认 lint/test 命令

#### 5.3 Goal Judge 最终判定

**文件**：`packages/opencode/src/session/goal-judge.ts`

**输入**：session 完整历史 + 变更文件 + 测试结果 + spec 达成度

**输出**：
```ts
interface FinalVerdict {
  status: "completed" | "partial" | "failed"
  reason: string
  achievedRequirements: string[]
  missingRequirements: string[]
}
```

#### 5.4 AST 影响分析

**文件**：`packages/opencode/src/ast/ast.ts`

**改动**：
- 分析变更是否破坏公共 API
- 分析是否删除被依赖的导出
- 分析是否引入循环依赖
- 分析是否产生未使用代码

#### 验收标准
- [ ] OpenSpec 最终验证报告可用
- [ ] 自动化测试运行集成
- [ ] Goal Judge 最终判定可用
- [ ] AST 影响分析输出报告
- [ ] `bun typecheck` 通过

---

### Phase 6：端到端质量测试体系（2 周）

**目标**：自动化验证整个闭环。

#### 6.1 测试夹具

**文件**：`packages/opencode/test/e2e/quality-gates/fixture.ts`

**能力**：
- 创建临时项目
- 写入初始文件和 spec
- mock LLM server 驱动 agent
- 运行任务
- 验证最终状态

#### 6.2 场景测试

**目录**：`packages/opencode/test/e2e/quality-gates/`

| 文件 | 场景 | 验证 |
|------|------|------|
| `spec-generation.test.ts` | 用户输入需求 → 生成可验证 spec | spec 有 verification 且可执行 |
| `security-block.test.ts` | 要求写入 `eval(...)` | Cardinal 阻断，文件无 eval |
| `spec-compliance.test.ts` | 带 OpenSpec 的功能开发 | 不合规时模型收到反馈并修正 |
| `excessive-changes.test.ts` | 小需求改多文件 | Cardinal pause 触发 |
| `consecutive-failures.test.ts` | 同一命令反复失败 | Cardinal pause 触发 |
| `file-drift.test.ts` | agent 改无关文件 | AlignmentGuard 检测并反馈 |
| `goal-completion.test.ts` | 明确目标的任务 | Goal Judge 判定 completed |

#### 6.3 CI 集成

在 `packages/opencode/package.json` 增加：

```json
{
  "scripts": {
    "test:quality-gates": "bun test test/e2e/quality-gates"
  }
}
```

#### 验收标准
- [ ] 7+ 个质量验收场景测试
- [ ] 测试在 CI 稳定通过
- [ ] 新增代码破坏质量门禁时测试失败
- [ ] `bun typecheck` 通过

---

### Phase 7：Spec 库与持续改进（2 周）

**目标**：把 spec 和 trace 变成可复用的组织资产。

#### 7.1 Spec 库

**文件**：`packages/opencode/src/spec-library.ts`（新建）

**能力**：
- 按 domain / feature 分类
- 全文搜索
- 相似度匹配
- 版本历史

**表结构**：
```sql
CREATE TABLE spec_library (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  domain TEXT,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### 7.2 Trace 查询界面

**TUI**：
- `panel-trace.tsx` 支持按 session、时间、类型筛选
- 支持导出 JSON/文本

**HTTP API**：
- `GET /api/sessions/:id/traces`

#### 7.3 Evolution 自动导出

**文件**：`packages/opencode/src/evolution/evolution.ts`

**改动**：
- 基于持久化 trace 导出 DPO pairs
- 只导出验收通过为正例、验收失败为负例

#### 7.4 相似需求推荐

**文件**：`packages/opencode/src/spec-generation/req-agent.ts`

**改动**：
- 新需求输入时，从 Spec 库搜索相似 spec
- 把相似 spec 作为上下文提供给 req-agent

#### 验收标准
- [ ] Spec 库可存储和搜索
- [ ] Trace 可查询和导出
- [ ] Evolution 自动导出训练数据
- [ ] 新需求能推荐相似 spec
- [ ] `bun typecheck` 通过

---

### Phase 8：AST 语义升级（3-4 周，可选）

**目标**：用真实 AST parser 替代正则，提供准确影响分析。

#### 8.1 接入真实 Parser

推荐 oxc 或 TypeScript compiler API。

#### 8.2 语义依赖图

实现 `buildDependencyGraphWithAst`：
- 准确识别 import/export
- 识别函数、类、导出项
- 建立 file → dependents 图

#### 8.3 语义变化检测

- 公共函数签名变化 → 找出调用方
- 导出删除 → 找出 importer
- 新增未使用代码 → warn

#### 8.4 与 Cardinal 联动

把 AST 分析结果作为 Cardinal 输入：
- 修改公共 API 但没改测试 → pause
- 删除被依赖的导出 → block

#### 验收标准
- [ ] AST 用真实 parser
- [ ] 能检测函数签名变化和导出删除
- [ ] AST 结果可反馈给 Cardinal
- [ ] 新增 3 个测试通过
- [ ] `bun typecheck` 通过

---

## 六、时间线

```
Month 1:  Phase 0 基础设施
          Phase 1 Spec 生成 MVP

Month 2:  Phase 2 Spec-执行打通
          Phase 3 执行前验收
          Phase 4 执行中监控

Month 3:  Phase 5 执行后验收
          Phase 6 端到端测试
          Phase 7 Spec 库与持续改进

Month 4:  Phase 8 AST 语义升级（可选）
          整体调优与收尾
```

总计：**4 个月核心闭环 + 1 个月可选升级**。

---

## 七、关键设计原则

1. **Spec 是质量保障的核心资产**  
   一切验收、监控、判定都围绕 spec 展开。

2. **多智能体协作优于单智能体**  
   专业 agent 各司其职，review agent 兜底。

3. **可验证性优先**  
   每个需求必须有可执行的 verification，manual 类型要最小化。

4. **人在关键节点确认**  
   Spec 生成后、高风险操作前、最终交付前，都需要人工确认。

5. **全过程可追溯**  
   从需求输入到最终验收，每个决策都记录在 Trace 中。

6. **持续积累组织知识**  
   Spec 库、Trace 库、Evolution 数据是长期资产。

---

## 八、风险与应对

| 风险 | 应对 |
|------|------|
| Spec 生成消耗大量 token | 先用 cheap model 跑 MVP；review/fix 用好模型 |
| Spec 生成速度慢 | accept/test-agent 依赖 arch-agent，必须串行；其他可并行 |
| 用户不信任机器生成的 spec | 强制人工确认；展示生成 reasoning |
| verification 不可执行 | test-agent 预演；不可行的降级为 manual |
| Cardinal 误报 | 先 warn 模式灰度，再启用 block |
| 多 agent 协作失败 | 每个 agent 输出严格 schema；失败时回退到单 agent |
| Spec 库膨胀 | 定期归档；相似 spec 合并 |

---

## 九、成功标准

5 个月后，HelixAgent 应达到：

- [ ] 用户输入需求后，系统自动生成可验证 spec，人工确认后执行。
- [ ] 执行前有风险预检，高风险操作需要确认。
- [ ] 执行中 Cardinal / OpenSpec / AlignmentGuard 实时生效。
- [ ] 执行后有完整验收报告（spec 达成度 + 测试结果 + goal 判定）。
- [ ] 所有关键事件持久化，可跨 session 查询和复盘。
- [ ] 有 7+ 个端到端场景测试保障质量闭环。
- [ ] Spec 库和 Trace 库开始积累组织知识。
- [ ] `bun typecheck` 和核心测试持续通过。

---

## 十、下一步行动

1. 团队评审本规划，确认优先级和资源分配。
2. 立即启动 Phase 0：Trace 持久化 + Cardinal 上下文补齐 + OpenSpec ast verification。
3. 为每个 Phase 创建独立分支，按 `AGENTS.md` 规范命名。
4. 每 Phase 完成后跑 `bun typecheck` 和相关测试。
5. Phase 1 完成后做一次内部 demo，验证 spec 生成 MVP。

---

*文档结束*
