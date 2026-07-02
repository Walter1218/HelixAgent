# HelixAgent 主链路功能集成质量评估报告

> 评估日期: 2026-07-02
> 评估范围: packages/opencode/src 全部已集成模块
> 评估维度: 实现质量、主链路集成度、实际功能价值

---

## 总分排名

| 排名 | 模块 | 实现质量 | 集成深度 | 功能价值 | 综合分 | 等级 |
|:---:|------|:---:|:---:|:---:|:---:|:---:|
| 1 | **Trace** | 8 | 9 | 8 | **8.3** | A |
| 2 | **Cardinal** | 8 | 9 | 7 | **8.0** | A |
| 3 | **OpenSpec 系统** | 8 | 8 | 7 | **7.7** | A- |
| 4 | **Workflow** | 8 | 8 | 7 | **7.7** | A- |
| 5 | **Team** | 7 | 7 | 6 | **6.7** | B+ |
| 6 | **历史工具** (history) | 9 | 4 | 7 | **6.7** | B+ |
| 7 | **AST** | 6 | 8 | 5 | **6.3** | B |
| 8 | **LSP 工具** | 8 | 4 | 7 | **6.3** | B |
| 9 | **SpecReport** | 7 | 6 | 6 | **6.3** | B |
| 10 | **Scheduler** | 6 | 7 | 5 | **6.0** | B |
| 11 | **6个实验工具** (avg) | 7.8 | 4 | 6 | **5.9** | B- |
| 12 | **AlignmentGuard** | 7 | 6 | 4 | **5.7** | B- |
| 13 | **Goal** | 5 | 7 | 5 | **5.7** | B- |
| 14 | **Evolution** | 5 | 8 | 4 | **5.7** | B- |
| 15 | **ModeRegistry** | 7 | 5 | 4 | **5.3** | B- |
| 16 | **Auto-Dream** | 5 | 7 | 4 | **5.3** | B- |
| 17 | **GoalJudge** | 4 | 6 | 4 | **4.7** | C |
| 18 | **TUI 外化** | 4 | 3 | 5 | **4.0** | C |
| 19 | **Metrics** | 4 | 4 | 1 | **3.0** | D |
| 20 | **TokenTracker** | 3 | 3 | 1 | **2.3** | D- |
| 21 | **Checkpoint Writer** | 2 | 1 | 0 | **1.0** | F |

---

## 第一梯队：生产级 (A/A-)

### Trace — 综合 8.3/10

- **持久化**: SQLite + 内存缓存双层架构，Drizzle schema 定义完整
- **调用点**: 22 个 `trace.emit()` 分布在 8 个文件（processor、prompt、spec tool、goal-judge、rollback、preflight、openspec）
- **覆盖范围**: tool 执行、安全守卫、目标追踪、spec 生成、AST 分析、回滚决策
- **消费方**: Evolution 模块实际读取 trace 数据用于 DPO 配对导出
- **问题**: `getTracesByTimeRange` 从未被调用（死代码）；采样配置字段定义但未读取

### Cardinal — 综合 8.0/10

- **规则**: 5 条真实规则——安全检测（eval/exec/密钥模式）、过度变更（文件数 2x 阈值）、连续失败（3 次）、对齐偏差（AlignmentGuard 计数 3）、token 限制（单任务 20%）
- **执行**: 每次 tool 调用都执行 `cardinal.evaluate()`，还有 preflight 检查
- **效果**: `block` 级别真正阻止执行并触发回滚；`pause` 通过 `permission.ask()` 请求用户确认
- **问题**: `stop` 级别只记日志不实际停止；回滚执行器本身是 stub

### OpenSpec 系统 — 综合 7.7/10

- **管线**: 6 阶段 LLM 管线（需求分解→架构分析→验收设计→验证检查→合并→审查）
- **验证**: 5 种验证类型（grep/ast/test/script/manual），可执行子进程
- **集成**: per-tool-call 合规钩子，不合规时注入反馈到模型（主动引导行为）
- **CLI**: `opencode spec list/show/verify` 命令
- **问题**: writer 只生成单需求模板；converter 使用不足

### Workflow — 综合 7.7/10

- **持久化**: SQLite 表记录 run 状态（running/completed/failed/cancelled）
- **双重集成**: 自动追踪每个 prompt 的 workflow run + LLM 可调用的脚本执行工具
- **执行**: fiber 管理支持后台脚本、超时处理、取消操作
- **问题**: `maxConcurrentAgents`/`maxLifecycleAgents` 配置定义但未强制执行

---

## 第二梯队：半成品 (B+/B)

### Team — 6.7/10

- SQLite 持久化 team + team_member 表
- actor/task 创建时注册成员，prompt 结束后记录团队摘要
- **问题**: 团队数据只记不读——从不回注到 prompt 或影响行为

### AST — 6.3/10

- blast radius 算法（DFS 图遍历）正确，真的扫描项目 .ts/.tsx 文件建依赖图
- tool 调用后记录变更文件，prompt 后分析影响范围
- **问题**: 结果只记日志不用于决策；`extractContract` 用正则而非 AST 解析器，嵌套花括号会破

### AlignmentGuard — 5.7/10

- `detectDistraction`: shell 命令匹配（curl/wget/open），间接喂入 Cardinal 计数器
- `detectRabbitHole`: 包管理器安装模式检测，阈值 5
- **问题**: `detectFileDrift` 完全是死代码（零调用者）；`detectRabbitHole` 只记日志不阻止

### Scheduler — 6.0/10

- prompt 循环中 `accumulatedTokens > dailyBudget` 检查是**真正的硬门控**
- todo tool 中任务优先级排序（priority_first/round_robin/shortest_job_first）
- **问题**: todo 优先级只是装饰性的——记录但不执行；`estimatedTokens` 硬编码 100K

### ModeRegistry — 5.3/10

- 6 种模式（ask/build/plan/compose/max/loop）各有不同 evolution 配置
- `getEvolutionConfig()` 控制 goal 评估和 DPO 导出的开关
- **问题**: `inferMode()` 是死代码（零调用者）；模式不影响核心 prompt/tool 行为

### Goal — 5.7/10

- 4 个操作：set/get/clear/bumpReact
- react 计数 12 次后强制中断循环（硬效果）
- **问题**: 只有 spec tool 能设置目标（入口太窄）；内存存储不持久化

### SpecReport — 6.3/10

- 运行真实验证命令生成合规报告（achieved/missing 列表）
- 在 prompt 链 Phase 2.4 执行
- **问题**: 只观测不影响——结果记日志但不改变会话行为

### Evolution — 5.7/10

- 从 Trace SQLite 读取数据，过滤基础设施错误，配对导出 JSONL
- 在 prompt 链末尾执行，受 mode evolution 配置控制
- **问题**: 配对逻辑极其天真——同名 tool 的成功/失败两两配对，不考虑输入上下文或因果关系

---

## 第三梯队：脚手架 (C/D)

### Metrics — 3.0/10

- 内存 `Ref<ModelCallMetric[]>` + `Ref<ToolCallMetric[]>`，无 SQL 持久化
- 3 个调用点全在 processor.ts（tool 成功/失败、model step finish）
- `getSummary` 被 HTTP API 消费，TUI 显示
- **问题**: `recordAgentRequest` 是**空函数**；`ttft_ms` 永远不填导致 `avgTTFTMs` 算出 `NaN`；进程重启数据全丢

### TokenTracker — 2.3/10

- 内存 `Ref<TokenUsage[]>`，无 SQL 持久化
- 1 个调用点：processor.ts step-finish 时记录
- `getSessionStats` 被 TUI footer 消费显示 token 数
- **问题**: `getDailyBudget`/`canAfford` 从未被调用（预算门控完全是理论）；`purpose` 字段永远不填导致 `byPurpose` 统计永远为空

### Auto-Dream — 5.3/10

- 7 天/30 天间隔触发机制，dream/distill agent 有真实 prompt
- prompt 结束后 fork 后台 session 执行
- **问题**: 内存 `Ref` 计时器每次重启归零，导致**每次启动后第一次 prompt 都触发 dream**；fire-and-forget 无验证

### GoalJudge — 4.7/10

- pre-execution 和 post-execution 两个阶段调用
- **问题**: 纯正则匹配 "impossible"/"cannot be done" 等关键词，无 LLM 调用；只记日志不阻止

### TUI 外化 — 4.0/10

- `helix-tui` 是品牌壳：自定义 logo + Bun preload 插件
- `bin/helix` 直接委托给 opencode 的 `bun dev`
- TUI 组件（token/mode/goal/task/actor 指示器）本身功能正常但住在 `packages/tui`
- **问题**: 无真正架构分离，opencode 直接导入 `@opencode-ai/tui`（29 处）

---

## 实验工具（默认关闭，需 RuntimeFlags 开启）

| 工具 | 实现 | 集成 | 价值 | 说明 |
|------|:---:|:---:|:---:|------|
| **history** | 9 | 4 | 7 | SQL 查询支持关键词搜索 + 上下文窗口，跨会话知识检索 |
| **lsp** | 8 | 4 | 7 | 9 种 LSP 操作（goToDefinition/findReferences/hover/callHierarchy 等） |
| **workflow** | 8 | 4 | 6 | fiber 后台脚本执行，完整生命周期 |
| **actor** | 8 | 4 | 5 | `ActorSpawn.spawn` 只创建数据结构不实际执行 |
| **plan_exit** | 7 | 5 | 6 | 合成消息切换 agent，巧妙但脆弱 |
| **memory** | 7 | 4 | 5 | 只读搜索无写入操作 |

---

## 完全不工作的模块

### Checkpoint Writer — 1.0/10

- `spawnRef.current` **从未被赋值**（`src/actor/spawn-ref.ts` 初始化为 `undefined`，无代码设置它）
- `"checkpoint-writer"` agent 类型在 `agent.ts` 中无配置（无权限、无 prompt、无 mode）
- prompt 文件 `src/agent/prompt/checkpoint-writer.txt`（44 行）存在但从未引用
- 模板 `checkpoint-templates.ts`（114 行）和路径 `checkpoint-paths.ts`（29 行）是完好的死脚手架
- 每次调用静默 return，**产出零**

---

## 已修复的架构问题

### Layer 依赖未自包含导致 AppRuntime 崩溃

**根因**: `AppLayer` 使用 `Layer.mergeAll`，不会自动解析合并层之间的交叉依赖。commit `a82ba779` 将 35 个模块集成到 AppLayer，但多个模块的 `defaultLayer` 未显式提供其 Effect 层依赖。

**修复的 4 个文件**:

| 文件 | 问题 | 修复 |
|------|------|------|
| `src/session/checkpoint.ts:40` | `defaultLayer = layer` 缺少 SessionStatus | 添加 `Layer.provide(SessionStatus.defaultLayer)` |
| `src/session/processor.ts:951` | 缺少 Trace/Metrics/TokenTracker/Cardinal | 添加 4 个 `Layer.provide` |
| `src/session/prompt.ts:1908` | 缺少 Trace/AlignmentGuard/Goal/ModeRegistry/AutoDream/SessionCheckpoint | 添加 6 个 `Layer.provide` |
| `src/tool/registry.ts:403` | SpecTool lazy init 缺少 Cardinal/Goal/Trace/OpenSpec | 添加 4 个 `Layer.provide` + import |

**架构隐患**: 新模块如果不显式 `Layer.provide` 所有依赖就会重现此问题。建议长期迁移到 `LayerNode.group` + `LayerNode.compile`。

---

## 核心结论

### 1. "只记不决策"是最大的模式问题

Trace（22 调用点）、AST blast radius、Team 追踪、AlignmentGuard、SpecReport 都遵循同一模式：在主链路中调用、记录数据、写日志——**但从不回注到 prompt 或阻止行为**。

整个系统有丰富的观测能力，但**闭环控制极少**：
- 真正的硬门控只有 **2 个**: Cardinal `block`（阻止 tool 执行）+ Scheduler token 预算（中断循环）
- 软门控有 **3 个**: Cardinal `pause`（请求用户确认）、Goal react limit（中断循环）、OpenSpec 合规反馈（注入 prompt）
- 其余 **15+ 个模块** 纯观测

### 2. 最高 ROI 的改进方向

| 优先级 | 改进项 | 预期效果 |
|:---:|--------|---------|
| P0 | Metrics/TokenTracker 持久化到 SQLite | 数据跨重启存活 |
| P0 | Checkpoint Writer 接通 spawnRef | 激活整个 checkpoint 基础设施 |
| P1 | AST blast radius → 告警注入 prompt | 从观测变闭环 |
| P1 | AlignmentGuard detectFileDrift 接入主链路 | 激活死代码 |
| P1 | TokenTracker canAfford 接入 prompt 循环 | 真正的预算门控 |
| P2 | Auto-Dream 计时器持久化 | 修复每次重启触发的 bug |
| P2 | ModeRegistry inferMode 接入 agent 解析 | 模式真正影响行为 |
| P2 | Goal 入口扩大（不仅 spec tool 能设置） | 目标驱动更通用 |
