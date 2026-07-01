# HelixAgent 短期攻坚方向：高质量任务交付保障体系（完美版）

> 版本：v2.0
> 适用范围：未来 4-6 个月
> 目标：构建"需求可结构化 → Spec 可生成 → 执行可监控 → 交付可验收 → 过程可追溯"的完整质量保障闭环，让 HelixAgent 成为真正能保障任务交付质量的智能体。

---

## 一、核心思想升级

v1.0 的假设是：用户会写高质量 spec，系统负责按 spec 验收。

v2.0 的核心升级是：

> **用户不必会写 spec。HelixAgent 应该通过多智能体协作，自动把模糊需求转化为高质量、可执行、可验证的 spec，并全程按 spec 驱动执行和验收。**

这意味着质量保障体系的起点不是代码修改阶段，而是**需求输入阶段**。

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

## 三、完美版与 v1.0 的关键差异

| 维度 | v1.0 | v2.0（完美版） |
|------|------|---------------|
| 质量起点 | 代码修改阶段 | 需求输入阶段 |
| Spec 来源 | 用户手动编写 | 多智能体自动生成 + 人工确认 |
| 验收层次 | 执行中 + 执行后 | 执行前 + 执行中 + 执行后 |
| 目标判定 | Goal Judge | Goal Judge + Spec 达成度双重判定 |
| 知识沉淀 | Trace + Evolution | Spec 库 + Trace 库 + Evolution 库 |
| 人机关系 | 人写 spec，机器验收 | 机器生成 spec，人确认，机器执行验收 |

---

## 四、新增核心能力：多智能体 Spec 生成

### 4.1 总体流程

```
用户输入需求
    │
    ▼
┌──────────────┐
│  req-agent   │ 需求解构：提取目标、需求草案、约束、待澄清问题
└──────────────┘
    │
    ▼
┌──────────────┐
│  arch-agent  │ 架构分析：定位需修改文件、复用模块、接口契约、风险
└──────────────┘
    │
    ▼
┌──────────────┐
│ accept-agent │ 验收设计：为每个需求设计可执行的 verification
└──────────────┘
    │
    ▼
┌──────────────┐
│  test-agent  │ 验证预演：实际运行 verification，确认可执行
└──────────────┘
    │
    ▼
┌──────────────┐
│  merge-agent │ 规格整合：输出标准 OpenSpec markdown
└──────────────┘
    │
    ▼
┌──────────────┐
│ review-agent │ 质量评审：打分、列问题、决定 approve/revise/reject
└──────────────┘
    │
    ▼
┌──────────────┐
│  fix-agent   │ 修复迭代：根据 review 意见修正 spec（可循环）
└──────────────┘
    │
    ▼
用户确认 → 落地到 openspec/specs/
```

### 4.2 六个专业 Agent

#### 4.2.1 req-agent：需求解构

**输入**：用户原始 prompt、session 历史、项目记忆

**输出**：

```ts
interface ReqAgentOutput {
  coreGoal: string
  requirementDrafts: RequirementDraft[]
  constraints: string[]
  assumptions: string[]
  openQuestions: string[]
  domain: string        // 领域标签，用于匹配历史 spec
}

interface RequirementDraft {
  id: string
  title: string
  description: string
  type: "functional" | "non-functional" | "security" | "performance" | "ux" | "compatibility"
  priority: "must" | "should" | "nice-to-have"
  dependencies: string[]  // 依赖的其他 requirement id
}
```

**关键能力**：
- 识别用户没明说但必须做的隐性需求
- 对模糊需求主动提出澄清问题
- 给需求标优先级，帮助 accept-agent 分配验收精力

#### 4.2.2 arch-agent：架构分析

**输入**：req-agent 输出 + 代码库上下文

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

interface FileChange {
  path: string
  reason: string
  expectedSignature?: string
  blastRadius?: string[]  // 可能影响的其他文件
}

interface Risk {
  description: string
  severity: "high" | "medium" | "low"
  mitigation: string
}
```

**关键能力**：
- 调用 AST / LSP / RAG 找到相关代码
- 识别变更影响范围（blast radius）
- 避免与现有架构冲突

#### 4.2.3 accept-agent：验收设计

**输入**：req-agent + arch-agent 输出

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
  explanation: string  // 为什么选这个 verification 方式
}

type Verification =
  | { type: "test"; target: string }      // 精确测试命令
  | { type: "script"; target: string }    // bun run xxx
  | { type: "ast"; target: string }       // file:pattern
  | { type: "grep"; target: string }      // shell grep
  | { type: "manual"; target: string }    // 需要人工确认
```

**关键能力**：
- 优先选择自动化 verification
- 为每个 verification 写清晰解释
- 识别无法自动验证的需求并给出建议

#### 4.2.4 test-agent：验证预演

**输入**：accept-agent 输出

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

**关键能力**：
- 实际执行每个 verification target
- 不可运行的 verification 给出修正建议
- 对 `test` 类型，检查测试文件是否存在
- 对 `ast` 类型，检查文件路径和 pattern 是否匹配

这是保证 spec **可执行**的关键一步。

#### 4.2.5 merge-agent：规格整合

**输入**：req-agent + arch-agent + accept-agent + test-agent 输出

**输出**：符合 OpenSpec 格式的 markdown 字符串。

**关键能力**：
- 统一术语和格式
- 生成 overview、requirements、verification
- 保留架构上下文作为 spec 注释（非验证部分）

#### 4.2.6 review-agent：质量评审

**输入**：spec markdown + 评审配置

**输出**：

```ts
interface ReviewReport {
  score: number  // 0-100
  verdict: "approve" | "revise" | "reject"
  issues: ReviewIssue[]
  strengths: string[]
  summary: string
}

interface ReviewIssue {
  category:
    | "completeness"
    | "verifiability"
    | "clarity"
    | "security"
    | "performance"
    | "architecture"
    | "consistency"
    | "maintainability"
  severity: "blocker" | "warning" | "suggestion"
  requirementId?: string
  description: string
  fixSuggestion: string
}
```

**评审维度**：
- 完整性：是否覆盖功能、异常、边界、安全
- 可验证性：每个 requirement 是否有可执行 verification
- 清晰性：是否无歧义
- 安全性：是否考虑安全约束
- 性能：是否考虑性能约束
- 架构一致性：是否符合项目架构
- 一致性：ID、术语、格式是否统一
- 可维护性：spec 是否易于后续维护

#### 4.2.7 fix-agent：修复迭代

**输入**：spec markdown + review issues

**输出**：修正后的 spec markdown

**关键能力**：
- 按 issue severity 排序修复
- blocker 必须修，warning 尽量修，suggestion 可选
- 修复后返回给 review-agent 重新评审
- 最多迭代 N 次，超过则 reject 并交给用户

### 4.3 Spec 生成与现有模块的联动

| 生成阶段 | 复用 HelixAgent 能力 |
|---------|---------------------|
| req-agent | LLM.Service、Memory、Session 历史 |
| arch-agent | AST.Service、FSUtil.Service、LSP、Ripgrep、RAG |
| accept-agent | OpenSpec.checkRequirement（预演） |
| test-agent | ChildProcessSpawner、CrossSpawnSpawner |
| merge-agent | OpenSpec.parseSpecFile（格式校验） |
| review-agent | LLM.Service、Config |
| fix-agent | LLM.Service |
| 全过程 | Trace.Service（记录） |

---

## 五、执行前验收层（新增）

### 5.1 Goal Judge 预检

在 agent 开始大量修改前，先让 Goal Judge 判断：

- 目标是否清晰可达成
- 是否需要更多上下文
- 是否有明显不可能的部分

如果判定 impossible，直接结束并解释原因，避免浪费 token。

### 5.2 Cardinal 预检

基于初始 diff snapshot 和计划修改的文件：

- 是否涉及高风险操作（删除关键文件、修改权限系统）
- 是否改动文件数远超预期
- 是否需要人工确认

### 5.3 OpenSpec Pre-check

在执行前，先扫描计划修改的文件是否命中 spec。如果还没开始执行就已经可能违反 spec，提前提示。

---

## 六、执行中监控层（v1.0 Phase 1-3 的升级）

### 6.1 Cardinal 生效

与 v1.0 Phase 1 相同，但增加：
- 从 spec 中自动提取安全/性能规则，动态补充 Cardinal 规则
- 支持按项目配置自定义规则

### 6.2 OpenSpec 持续验证

与 v1.0 Phase 2 相同，但增加：
- 每次 tool-result 后自动运行相关 verification
- 失败时不仅反馈给模型，还可以自动触发 rollback

### 6.3 AlignmentGuard 全面启用

- `detectRabbitHole`：执行中实时检测
- `detectDistraction`：检测无关命令
- `detectFileDrift`：检测修改文件是否偏离目标

### 6.4 Trace 实时记录

每个 tool call、每个 Cardinal 决策、每个 OpenSpec 验证结果都记录到持久化 Trace。

---

## 七、执行后验收层（v1.0 Phase 3-4 的升级）

### 7.1 OpenSpec 最终验证

任务结束后，运行所有 spec verification，生成验收报告。

### 7.2 自动化测试运行

自动运行：
- `bun typecheck`
- spec 中定义的 tests
- 项目默认 lint/test 命令

### 7.3 Goal Judge 最终判定

结合：
- session 完整历史
- 变更文件
- 测试结果
- spec 达成度

输出：
- `completed`：目标达成
- `partial`：部分达成，列出未达成项
- `failed`：未达成

### 7.4 AST 影响分析

分析变更是否：
- 破坏公共 API
- 删除被依赖的导出
- 引入循环依赖
- 产生未使用代码

---

## 八、持续改进层（v1.0 Phase 5-6 的升级）

### 8.1 Spec 库积累

把经过验证的 spec 保存为组织知识：
- 按 domain / feature 分类
- 支持搜索和复用
- 相似需求自动推荐历史 spec

### 8.2 Trace 库

持久化所有执行过程，支持：
- 跨 session 查询
- 失败模式分析
- 模型行为复盘

### 8.3 Evolution 训练数据

基于 Trace 和验收结果，自动导出：
- 成功的执行轨迹作为正例
- 失败的执行轨迹作为负例
- 用于微调或强化学习

---

## 九、完美版分阶段计划

### Phase 0：基础设施（2 周）

**目标**：为 spec 生成和质量保障体系打好基础。

| 任务 | 说明 |
|------|------|
| Trace 持久化 | 同 v1.0 Phase 3 |
| OpenSpec 基础能力补全 | `ast` verification、CLI 命令 |
| Cardinal 上下文补齐 | 同 v1.0 Phase 1.1 |
| 统一事件 schema | 规范 TraceEvent、CardinalDecision、SpecCheckResult |

### Phase 1：多智能体 Spec 生成 MVP（3 周）

**目标**：实现 req → accept → merge → review 的最小闭环。

| 任务 | 说明 |
|------|------|
| req-agent | 需求解构 |
| accept-agent | 验收设计 |
| merge-agent | 规格整合 |
| review-agent | 质量评审 |
| `/spec generate` CLI | 用户触发 spec 生成 |
| 用户确认流程 | 展示生成结果，允许编辑确认 |

### Phase 2：Spec 生成与执行链路打通（2 周）

**目标**：生成的 spec 能自动进入执行和验收流程。

| 任务 | 说明 |
|------|------|
| 自动设置 Goal | 把 coreGoal 设为 session goal |
| 自动注册 Cardinal 规则 | 从 spec 提取安全/性能约束 |
| OpenSpecHook 读取生成 spec | 执行中持续验证 |
| 执行后自动生成验收报告 | OpenSpec 最终验证 + 测试运行 |

### Phase 3：执行前验收层（2 周）

**目标**：在执行大量修改前先做预检。

| 任务 | 说明 |
|------|------|
| Goal Judge 预检 | 判断目标可达成性 |
| Cardinal 预检 | 基于计划修改文件做风险评估 |
| OpenSpec Pre-check | 执行前扫描可能违规 |
| 预检报告展示 | TUI / CLI 展示 |

### Phase 4：完整执行中监控（2 周）

**目标**：v1.0 Phase 1-3 的完整落地。

| 任务 | 说明 |
|------|------|
| Cardinal 全部规则生效 | security / excessive_changes / consecutiveFailures / alignment / token_limit |
| OpenSpec 失败反馈给模型 | 不合规时要求修正 |
| AlignmentGuard 全部启用 | rabbit hole / distraction / file drift |
| Trace 全程记录 | 每个关键事件持久化 |

### Phase 5：执行后验收与判定（2 周）

**目标**：任务结束时有完整的验收报告。

| 任务 | 说明 |
|------|------|
| OpenSpec 最终验证 | 生成验收报告 |
| 自动化测试运行 | typecheck + tests + lint |
| Goal Judge 最终判定 | completed / partial / failed |
| AST 影响分析 | 检测 API 破坏、依赖删除等 |

### Phase 6：端到端质量测试体系（2 周）

**目标**：自动化验证整个闭环。

| 任务 | 说明 |
|------|------|
| 质量验收测试夹具 | 可配置 mock LLM、临时项目 |
| 6+ 场景测试 | 安全阻断、spec 合规、过量改动、连续失败、file drift、goal 完成 |
| CI 集成 | `test:quality-gates` |

### Phase 7：Spec 库与持续改进（2 周）

**目标**：把 spec 和 trace 变成可复用的组织资产。

| 任务 | 说明 |
|------|------|
| Spec 库 | 分类、搜索、复用历史 spec |
| Trace 查询界面 | TUI / HTTP API |
| Evolution 自动导出 | 基于验收结果生成训练数据 |
| 相似需求推荐 | 新需求自动推荐相似 spec |

### Phase 8：AST 语义升级（3-4 周，可选）

**目标**：用真实 AST parser 替代正则，提供准确影响分析。

| 任务 | 说明 |
|------|------|
| 接入 oxc / TypeScript compiler API | 真实 AST 解析 |
| 语义依赖图 | 准确的 file → dependents |
| 公共 API 变化检测 | 签名变化、导出删除 |
| 与 Cardinal 联动 | API 破坏时 block/pause |

---

## 十、时间线

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

## 十一、关键设计原则

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

## 十二、与 v1.0 的衔接

v1.0 的 Phase 1-6 不是被替代，而是被重新组织和增强：

| v1.0 Phase | v2.0 位置 | 变化 |
|-----------|----------|------|
| Phase 1 Cardinal | Phase 4 + 与 spec 联动 | 增加从 spec 提取动态规则 |
| Phase 2 OpenSpec | Phase 0 基础 + Phase 2 打通 + Phase 5 最终验收 | 贯穿整个生命周期 |
| Phase 3 Trace | Phase 0 基础设施 | 更早落地，支撑后续阶段 |
| Phase 4 Goal Judge | Phase 2 + Phase 3 + Phase 5 | 预检 + 执行中 + 最终判定 |
| Phase 5 端到端测试 | Phase 6 | 扩展为验证整个 spec-执行-验收闭环 |
| Phase 6 AST 升级 | Phase 8 | 作为可选增强 |

新增内容：
- Phase 1 多智能体 Spec 生成
- Phase 3 执行前验收层
- Phase 7 Spec 库与持续改进

---

## 十三、风险与应对

| 风险 | 应对 |
|------|------|
| Spec 生成消耗大量 token | 先用 cheap model 跑 MVP；只在 review/fix 用好模型 |
| Spec 生成速度慢 | 部分 agent 可并行（req/accept 可并行，但 accept 依赖 arch） |
| 用户不信任机器生成的 spec | 强制人工确认；展示生成 reasoning |
| verification 不可执行 | test-agent 预演；不可行的降级为 manual |
| Cardinal 误报 | 先 warn 模式灰度，再启用 block |
| 多 agent 协作失败 | 每个 agent 输出严格 schema；失败时回退到单 agent |

---

## 十四、成功标准

6 个月后，HelixAgent 应达到：

- [ ] 用户输入需求后，系统自动生成可验证 spec，人工确认后执行。
- [ ] 执行前有风险预检，高风险操作需要确认。
- [ ] 执行中 Cardinal / OpenSpec / AlignmentGuard 实时生效。
- [ ] 执行后有完整验收报告（spec 达成度 + 测试结果 + goal 判定）。
- [ ] 所有关键事件持久化，可跨 session 查询和复盘。
- [ ] 有 6+ 个端到端场景测试保障质量闭环。
- [ ] Spec 库和 Trace 库开始积累组织知识。
- [ ] `bun typecheck` 和核心测试持续通过。

---

*文档结束*
