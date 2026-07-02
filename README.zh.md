# HelixAgent

> **基于 OpenCode 架构，融合 MiMo Code 能力，并在此基础上进行创新的下一代 AI 编程智能体**

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

---

## 项目简介

HelixAgent 是在 [OpenCode](https://github.com/anomalyco/opencode) 基础上，融合 [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) 核心能力，并在此基础上进行创新的项目。

### 能力来源

| 来源 | 能力 | 说明 |
|------|------|------|
| **OpenCode** | 基础架构 | V1+V2双系统架构、TUI、LSP、MCP、插件系统 |
| **MiMo Code** | 核心能力 | 持久记忆、智能上下文管理、子智能体编排、目标驱动、Compose模式、Dream/Distill、Voice输入、Max模式 |
| **HelixAgent创新** | 高级能力 | Cardinal风险控制、AlignmentGuard偏移检测、Trace机制、Token预算、Metrics、Workflow引擎、Team协作、AST Graph、Shell Safety、TUI外化、OpenSpec |

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
curl -fsSL https://mimo.xiaomi.com/install | bash

# 或使用npm
npm install -g @mimo-ai/cli
```

### 配置

创建 `~/.config/opencode/config.json`:

#### MiMo Token Plan (推荐)

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

#### Kimi for Coding

```json
{
  "provider": {
    "kimi-for-coding": {
      "name": "Kimi For Coding",
      "npm": "@ai-sdk/openai-compatible",
      "api": "https://api.kimi.com/coding/v1",
      "env": ["KIMI_API_KEY"],
      "options": {
        "apiKey": "${KIMI_API_KEY}",
        "baseURL": "https://api.kimi.com/coding/v1"
      },
      "models": {
        "k2p7": {
          "name": "Kimi K2.7 Code",
          "tool_call": true,
          "reasoning": true,
          "limit": { "context": 262144, "output": 262144 }
        },
        "k2p5": {
          "name": "Kimi K2.5",
          "tool_call": true,
          "reasoning": true,
          "limit": { "context": 262144, "output": 262144 }
        }
      }
    }
  },
  "model": "kimi-for-coding/k2p7"
}
```

#### 其他Provider

支持所有OpenAI兼容的API，包括：
- OpenAI / Azure OpenAI
- Anthropic (Claude)
- DeepSeek
- 通义千问
- 智谱GLM
- 等等

#### 记忆配置（可选）

记忆工具和向量检索默认启用。如需关闭：

```json
{
  "memory": {
    "embedding": {
      "enabled": false
    }
  }
}
```

或通过环境变量：

```bash
# 关闭记忆工具
OPENCODE_EXPERIMENTAL_MEMORY_TOOL=0

# 关闭向量检索
MEMORY_EMBEDDING_ENABLED=0
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `memory.embedding.enabled` | boolean | `true` | 启用向量嵌入进行混合搜索 |
| `memory.embedding.baseUrl` | string | `http://localhost:1234/v1/embeddings` | 嵌入 API 端点 |
| `memory.embedding.model` | string | `text-embedding-bge-m3` | 嵌入模型名称 |

### 运行

```bash
# 交互模式
mimo

# 单次运行
mimo run "实现用户登录功能"

# 服务模式
mimo serve --port 3096
```

---

## 来自 MiMo Code 的核心能力

### 1. 多智能体系统

| 智能体 | 说明 |
|--------|------|
| **build** | 默认模式，完整工具权限 |
| **plan** | 只读分析模式，用于代码探索和方案设计 |
| **compose** | 编排模式，用于规格驱动开发和技能驱动工作流 |

按 `Tab` 在主智能体之间切换。子智能体由系统按需创建。

### 2. 持久记忆系统

跨会话记忆，基于 SQLite FTS5 + 向量 RAG：

- **项目记忆** (`MEMORY.md`) - 持久化项目知识、规则、架构决策
- **会话检查点** (`checkpoint.md`) - 由checkpoint-writer子智能体自动维护的结构化状态快照
- **临时笔记** (`notes.md`) - 智能体的临时笔记区域
- **任务进度** (`tasks/<id>/progress.md`) - 每个任务的日志
- **向量嵌入** - FTS + Vector 混合搜索（需要 LM Studio 加载 bge-m3 模型）

会话恢复时自动注入记忆，智能体无需重新学习项目上下文。

#### 混合搜索（FTS + Vector）

启用向量嵌入后，记忆搜索使用混合排名：
- **FTS（权重 0.6）** - BM25 关键词匹配
- **Vector（权重 0.4）** - 余弦相似度语义匹配
- **共现 boost（1.3x）** - 同时匹配 FTS 和 Vector 的文档获得更高分数

```bash
# 启用向量嵌入（需要 LM Studio）
export MEMORY_EMBEDDING_ENABLED=1

# 启动 LM Studio 并加载 text-embedding-bge-m3 模型
# 默认 API 端点：http://localhost:1234/v1/embeddings
```

### 3. 智能上下文管理

- **自动检查点** - 根据模型上下文窗口决定何时保存会话状态
- **上下文重建** - 当上下文接近限制时，从最新检查点、项目记忆、任务进度和保留的最近消息重建
- **预算注入** - 使用token预算控制有多少检查点、记忆和笔记内容进入上下文

### 4. 任务追踪

树形任务系统 (`T1`, `T1.1`, `T1.2`, ...)，自动与检查点系统集成，任务进度在会话恢复时保留。

### 5. 子智能体系统

主智能体可以按需创建子智能体。子智能体共享当前会话上下文，可以并行工作，支持生命周期跟踪、取消和后台执行。

### 6. 目标/停止条件

`/goal` 命令设置会话的停止条件。当智能体尝试停止时，独立的judge模型评估对话以决定条件是否真正满足——防止自主工作期间的过早"乐观停止"。

### 7. Compose模式

为规格驱动开发提供结构化工作流。包含内置技能用于规划、执行、代码审查、TDD、调试、验证和合并——编排从规格到交付代码的完整生命周期。

### 8. Dream & Distill

- **`/dream`** - 扫描最近的会话轨迹，提取持久知识到项目记忆，并删除过时条目
- **`/distill`** - 发现最近工作中的重复手动工作流，并将高置信度候选打包成可重用的技能、子智能体或命令

### 9. Max模式

并行最佳N推理，通过judge选择。可通过配置中的 `experimental.maxMode` 启用。

### 10. Voice输入

实时流式语音输入，由TenVAD和MiMo ASR驱动。通过 `/voice` 激活，然后说话——音频按停顿分段并增量转录到输入中。

---

## HelixAgent 的创新能力

### 1. Cardinal风险控制系统

**来源**: HelixAgent创新

4级风险控制，防止高风险操作：

| 级别 | 说明 | 处理方式 |
|------|------|----------|
| **Block** | 严重风险 | 立即终止 |
| **Pause** | 中等风险 | 暂停等待确认 |
| **Stop** | 轻微风险 | 停止记录日志 |
| **Warn** | 潜在风险 | 警告继续执行 |

### 2. AlignmentGuard偏移检测

**来源**: HelixAgent创新

实时检测智能体是否偏离目标：
- **文件漂移检测** - 修改大量与目标无关的文件
- **兔子洞检测** - 连续执行安装命令
- **分心检测** - curl/wget/open等与任务无关操作

### 3. Trace机制

**来源**: HelixAgent创新

完整的执行追踪系统：
- **TraceReporter** - 追踪事件记录
- **HeuristicFilter** - 脏数据过滤
- **formatTree** - 树状可视化
- **Debug日志系统** - 30+模块debug点

### 4. Token预算管理

**来源**: HelixAgent创新

Token使用追踪和预算管理：
- 每日token预算限制
- 按任务分配token预算
- Token使用统计

### 5. Metrics系统

**来源**: HelixAgent创新

性能指标收集：
- ModelCall指标 (TTFT、延迟、缓存命中)
- ToolCall指标 (输入/输出字节)
- AgentRequest指标

### 6. Workflow引擎

**来源**: HelixAgent创新

JavaScript/JSON工作流脚本执行：
- 内置工作流 (deep-research)
- VFS沙箱
- 并发信号量

### 7. Team系统

**来源**: HelixAgent创新

团队协作能力：
- 团队创建和管理
- 成员角色分配

### 8. AST Graph

**来源**: HelixAgent创新

代码依赖分析：
- Blast Radius计算
- Contract提取

### 9. Shell Safety

**来源**: HelixAgent创新

AST级命令解析和危险操作拦截：
- Shell Tokenizer
- 高风险命令拦截
- 动态命令检测

### 10. TUI外化

**来源**: HelixAgent创新

完整的终端UI组件库，18个组件：

| 类型 | 组件 |
|------|------|
| **指示器** | ModeIndicator, GoalIndicator, TokenIndicator |
| **面板** | TaskPanel, ActorPanel, TracePanel, SkillPanel, AgentPanel |
| **告警** | CardinalAlert, AlignmentAlert |
| **对话框** | DialogMode, DialogMemory, DialogHistory |

### 11. OpenSpec系统

**来源**: HelixAgent创新

结构化需求和验证系统：

- **Spec解析** - 基于Markdown的需求规格，包含验证命令
- **合规性Judge** - 自动验证实现是否符合规格
- **CLI命令** - `opencode spec list/show/verify`
- **Spec Writer** - 从任务描述自动生成规格
- **Spec Converter** - 在Markdown规格和代码结构之间转换

#### 使用方法

```bash
# 列出所有规格
opencode spec list

# 显示规格详情
opencode spec show --name cardinal-integration

# 验证实现
opencode spec verify --all
```

---

## 模式系统

融合OpenCode和MiMo Code的模式系统：

| 模式 | 来源 | 说明 | 快捷键 |
|------|------|------|--------|
| **Ask** | OpenCode | 只读模式，用于提问和解释 | Tab |
| **Build** | OpenCode | 默认模式，执行工具 | Tab |
| **Plan** | OpenCode | 规划模式，禁止编辑工具 | Tab |
| **Compose** | MiMo Code | 组合模式，使用compose技能 | Tab |
| **Max** | MiMo Code | 实验性模式，并行运行N个候选 | Tab |
| **Loop** | HelixAgent | 循环模式，自动反馈 | Tab |

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
│   │       ├── memory/          # Memory Layer (来自MiMo Code)
│   │       ├── config/          # 配置系统
│   │       └── ...
│   └── opencode/                # 主应用
│       └── src/
│           ├── actor/           # Actor并发系统 (来自MiMo Code)
│           ├── task/            # Task系统 (来自MiMo Code)
│           ├── session/         # Session/Goal/Mode (来自MiMo Code)
│           ├── agent/           # Agent配置
│           ├── tool/            # 工具系统
│           ├── openspec/        # OpenSpec系统 (HelixAgent创新)
│           ├── observability/   # AlignmentGuard/Trace (HelixAgent创新)
│           ├── evolution/       # Evolution Flywheel (HelixAgent创新)
│           ├── scheduler/       # Auto-Dev Scheduler (HelixAgent创新)
│           ├── team/            # Team系统 (HelixAgent创新)
│           ├── cli/cmd/tui/     # TUI组件 (HelixAgent创新)
│           └── ...
├── openspec/                    # 规格文件
│   └── specs/
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
- [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) - MIT License

---

## 致谢

- [OpenCode](https://github.com/anomalyco/opencode) - 基础架构
- [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) - 核心能力
- [MiMo Token Plan](https://token-plan-cn.xiaomimimo.com) - API支持
