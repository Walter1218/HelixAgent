# HelixAgent

> **基于 OpenCode 架构，融合 MiMo Code 能力的下一代 AI 编程智能体**

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

---

## 项目简介

HelixAgent 是在 [OpenCode](https://github.com/anomalyco/opencode) 基础上，融合 [MiMo Code](https://github.com/sinco-lab/mimocode) 核心能力的创新项目。我们保留了 OpenCode 的 V1+V2 双系统架构，同时引入了 MiMo Code 的记忆系统、智能体协作、安全沙箱等高级特性，构建了一个更强大的 AI 编程智能体平台。

### 核心创新

| 能力 | 来源 | 说明 |
|------|------|------|
| **Memory Layer** | MiMo Code | FTS5 + Vector RAG 混合检索，本地 LM Studio 支持 |
| **Actor并发系统** | MiMo Code | 子智能体管理，Effect Fiber 并发，生命周期控制 |
| **Task系统** | MiMo Code | 任务状态机，TaskGate 检查，事件审计 |
| **Goal系统** | MiMo Code | 独立 Judge 评估，目标驱动执行 |
| **模式系统** | OpenCode + MiMo Code | Build/Plan/Compose/Max/Loop 6种模式 |
| **Judge系统** | MiMo Code | 8项启发式检查 + LLM 裁判 |
| **Cardinal系统** | MiMo Code | 4级风险控制 (block/pause/stop/warn) |
| **AlignmentGuard** | MiMo Code | 文件漂移/兔子洞/分心检测 |
| **Trace机制** | MiMo Code | TraceReporter + HeuristicFilter + Debug日志 |
| **TUI外化** | 创新 | 完整的终端UI组件库，18个组件 |

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  L3 Access Layer   │  HTTP API + SSE / MCP Server / SDK / TUI  │
├─────────────────────────────────────────────────────────────────┤
│  L2 Control Layer  │  Actor并发 / Task系统 / Goal系统          │
│                    │  Judge系统 / Cardinal / AlignmentGuard     │
├─────────────────────────────────────────────────────────────────┤
│  L1 Memory Layer   │  SQLite FTS5 BM25 + Vector RAG            │
│                    │  Memory Reconcile / Multi-LLM Embedding    │
├─────────────────────────────────────────────────────────────────┤
│  L0 Security Layer │  Shell Safety / ToolInterceptor (AST)     │
│                    │  Permission System                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 安装

```bash
# 使用安装脚本
curl -fsSL https://opencode.ai/install | bash

# 或使用包管理器
npm i -g opencode-ai@latest
brew install anomalyco/tap/opencode
```

### 配置

创建 `~/.config/opencode/config.json`:

```json
{
  "provider": {
    "xiaomi": {
      "name": "MiMo Token Plan",
      "npm": "@ai-sdk/openai-compatible",
      "api": "https://token-plan-cn.xiaomimimo.com/v1",
      "options": {
        "apiKey": "${MIMO_API_KEY}",
        "baseURL": "https://token-plan-cn.xiaomimimo.com/v1"
      },
      "models": {
        "mimo-v2.5-pro": {
          "name": "MiMo V2.5 Pro",
          "tool_call": true,
          "reasoning": true,
          "limit": { "context": 1000000, "output": 128000 }
        }
      }
    }
  },
  "model": "xiaomi/mimo-v2.5-pro"
}
```

### 运行

```bash
# 交互模式
opencode

# 单次运行
opencode run "实现用户登录功能"

# 服务模式
opencode serve --port 3096
```

---

## 核心能力详解

### 1. Memory Layer (记忆层)

基于 MiMo Code 的记忆系统，支持 FTS5 + Vector RAG 混合检索：

```typescript
// 自动记忆整合
- 每7天触发 Dream Agent 整合记忆
- 每30天触发 Distill Agent 提取工作流
- Semantic Hash 检测规则漂移
```

**特性**:
- FTS5 全文搜索 (BM25 排序)
- 向量语义搜索 (本地 LM Studio 支持)
- 混合检索: `BM25 × 0.6 + Vector × 0.4`，共存 boost 1.3x
- 自动记忆衰减和清理

### 2. Actor并发系统 (子智能体管理)

基于 MiMo Code 的 Actor 模型，支持并发子智能体管理：

```typescript
// 创建子智能体
const actor = await spawn({
  mode: "subagent",
  agentType: "explore",
  task: "Explore codebase structure",
  background: true,
})

// 等待完成
const result = await wait({ actorID: actor.id })
```

**特性**:
- Effect Fiber 并发模型
- ForkContext 前缀缓存共享
- 并发上限: 16个软上限，1000个硬上限
- 生命周期管理: ephemeral / persistent

### 3. Task系统 (任务管理)

基于 MiMo Code 的任务状态机：

```
open → in_progress → done/blocked/abandoned
```

**特性**:
- 分层ID生成: T1, T1.1, T1.1.1
- 任务事件审计
- 自动归档 (默认7天)
- TaskGate 检查未完成任务

### 4. Goal系统 (目标驱动)

基于 MiMo Code 的独立 Judge 评估：

```typescript
// 设置目标
await goal.set(sessionID, "Create a login feature with JWT")

// Judge自动评估
// ok: true → 停止
// ok: false → 继续
// impossible: true → 清除目标
```

**特性**:
- 独立 Judge 模型 (temperature=0)
- 完整上下文评估
- 安全阀: MAX_GOAL_REACT = 12

### 5. 模式系统 (6种模式)

融合 OpenCode 和 MiMo Code 的模式系统：

| 模式 | 说明 | 快捷键 |
|------|------|--------|
| **Ask** | 只读模式，用于提问和解释 | Tab |
| **Build** | 默认模式，执行工具 | Tab |
| **Plan** | 规划模式，禁止编辑工具 | Tab |
| **Compose** | 组合模式，使用compose技能 | Tab |
| **Max** | 实验性模式，并行运行N个候选 | Tab |
| **Loop** | 循环模式，自动反馈 | Tab |

### 6. Judge系统 (代码审查)

基于 MiMo Code 的启发式检查 + LLM 裁判：

**8项检查**:
1. 断言减少检测
2. 结构性变更检测
3. 琐碎化检测
4. 安全检测
5. 回归风险检测
6. 一致性检测
7. 规格对齐检测
8. 声明门控检测

### 7. Cardinal系统 (风险控制)

基于 MiMo Code 的4级风险控制：

| 级别 | 说明 | 处理方式 |
|------|------|----------|
| **Block** | 严重风险 | 立即终止 |
| **Pause** | 中等风险 | 暂停等待确认 |
| **Stop** | 轻微风险 | 停止记录日志 |
| **Warn** | 潜在风险 | 警告继续执行 |

### 8. Trace机制 (执行追踪)

基于 MiMo Code 的执行追踪系统：

```typescript
// TraceReporter - 追踪事件记录
// HeuristicFilter - 脏数据过滤
// formatTree - 树状可视化
```

**特性**:
- 类型安全的事件定义
- 采样支持
- 最大trace数量限制
- Debug日志系统 (30+模块debug点)

---

## TUI组件库

完整的终端UI组件库，18个组件：

| 类型 | 组件 | 说明 |
|------|------|------|
| **指示器** | ModeIndicator | 显示当前模式 |
| **指示器** | GoalIndicator | 显示当前目标 |
| **指示器** | TokenIndicator | 显示Token使用量 |
| **面板** | TaskPanel | 显示任务列表 |
| **面板** | ActorPanel | 显示子智能体列表 |
| **面板** | TracePanel | 显示执行追踪 |
| **面板** | SkillPanel | 显示技能列表 |
| **面板** | AgentPanel | 显示Agent列表 |
| **告警** | CardinalAlert | Cardinal风险告警 |
| **告警** | AlignmentAlert | 偏移检测告警 |
| **对话框** | DialogMode | Mode切换 |
| **对话框** | DialogMemory | 记忆搜索 |
| **对话框** | DialogHistory | 历史搜索 |

---

## 测试验证

```bash
# 运行所有测试
bun test

# 运行单元测试
bun test test/memory/ test/phase2/ test/phase3/ test/phase4/ test/phase5/

# 运行集成测试
bun test test/e2e/integration.test.ts

# 运行LLM端到端测试
bun run test/e2e/llm-verify.ts

# 运行TUI测试
bun test test/tui/
```

**测试统计**:
- 单元测试: 152 pass
- 集成测试: 22 pass
- TUI测试: 62 pass
- LLM端到端: 6/6 pass
- **总计**: 242 pass, 0 fail

---

## 项目结构

```
HelixAgent/
├── packages/
│   ├── core/                    # 核心库
│   │   └── src/
│   │       ├── memory/          # Memory Layer
│   │       ├── config/          # 配置系统
│   │       └── ...
│   └── opencode/                # 主应用
│       └── src/
│           ├── actor/           # Actor并发系统
│           ├── task/            # Task系统
│           ├── session/         # Session/Goal/Mode
│           ├── agent/           # Agent配置
│           ├── tool/            # 工具系统
│           ├── cli/cmd/tui/     # TUI组件
│           └── ...
├── TUI_EXTERNALIZATION_PLAN.md  # TUI外化计划
└── TRANSFORM_PLAN.md            # 迁移计划
```

---

## 技术栈

| 技术 | 用途 |
|------|------|
| **TypeScript** | 主要语言 |
| **Bun** | 运行时和包管理 |
| **Effect** | 函数式效果系统 |
| **SolidJS** | TUI框架 |
| **SQLite + FTS5** | 数据库 |
| **Drizzle ORM** | ORM |
| **AI SDK** | LLM集成 |

---

## 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/my-feature`
3. 提交更改: `git commit -m "feat: add my feature"`
4. 推送分支: `git push origin feature/my-feature`
5. 创建 Pull Request

---

## 许可证

MIT License

Copyright (c) 2026 HelixAgent

本项目基于以下开源项目：
- [OpenCode](https://github.com/anomalyco/opencode) - MIT License
- [MiMo Code](https://github.com/sinco-lab/mimocode) - MIT License

---

## 致谢

- [OpenCode](https://github.com/anomalyco/opencode) - 基础架构
- [MiMo Code](https://github.com/sinco-lab/mimocode) - 核心能力
- [MiMo Token Plan](https://token-plan-cn.xiaomimimo.com) - API支持
