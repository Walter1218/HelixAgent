# HelixAgent

> **Next-generation AI coding agent built on OpenCode architecture, fused with MiMo Code capabilities, and innovated further**

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

---

## Overview

HelixAgent is built on [OpenCode](https://github.com/anomalyco/opencode), fused with [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) core capabilities, and further innovated with advanced features.

### Capability Sources

| Source | Capability | Description |
|--------|------------|-------------|
| **OpenCode** | Foundation | V1+V2 dual-system architecture, TUI, LSP, MCP, plugin system |
| **MiMo Code** | Core | Persistent memory, smart context management, sub-agent orchestration, goal-driven, Compose mode, Dream/Distill, Voice input, Max mode |
| **HelixAgent Innovation** | Advanced | Cardinal risk control, AlignmentGuard drift detection, Trace mechanism, Token budget, Metrics, Workflow engine, Team collaboration, AST Graph, Shell Safety, TUI externalization |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  L3 Access Layer   │  HTTP API + SSE / MCP Server / SDK / TUI  │
├─────────────────────────────────────────────────────────────────┤
│  L2 Control Layer  │  Actor concurrency / Task system / Goal   │
│                    │  Judge / Cardinal / AlignmentGuard         │
├─────────────────────────────────────────────────────────────────┤
│  L1 Memory Layer   │  SQLite FTS5 BM25 + Vector RAG            │
│                    │  Memory Reconcile / Multi-LLM Embedding    │
├─────────────────────────────────────────────────────────────────┤
│  L0 Security Layer │  Shell Safety / ToolInterceptor (AST)     │
│                    │  Permission System                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Installation

```bash
# Using install script
curl -fsSL https://mimo.xiaomi.com/install | bash

# Or using npm
npm install -g @mimo-ai/cli
```

### Configuration

Create `~/.config/opencode/config.json`:

#### MiMo Token Plan (Recommended)

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

#### Other Providers

Supports all OpenAI-compatible APIs including:
- OpenAI / Azure OpenAI
- Anthropic (Claude)
- DeepSeek
- Qwen
- GLM
- And more

#### Memory Configuration (Optional)

Memory tool and vector embedding are enabled by default. To disable:

```json
{
  "memory": {
    "embedding": {
      "enabled": false
    }
  }
}
```

Or via environment variables:

```bash
# Disable memory tool
OPENCODE_EXPERIMENTAL_MEMORY_TOOL=0

# Disable vector embedding
MEMORY_EMBEDDING_ENABLED=0
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `memory.embedding.enabled` | boolean | `true` | Enable vector embedding for hybrid search |
| `memory.embedding.baseUrl` | string | `http://localhost:1234/v1/embeddings` | Embedding API endpoint |
| `memory.embedding.model` | string | `text-embedding-bge-m3` | Embedding model name |

### Usage

```bash
# Interactive mode
mimo

# Single run
mimo run "implement user login"

# Server mode
mimo serve --port 3096
```

---

## Core Capabilities from MiMo Code

### 1. Multi-Agent System

| Agent | Description |
|-------|-------------|
| **build** | Default mode, full tool access |
| **plan** | Read-only analysis mode for code exploration |
| **compose** | Orchestration mode for spec-driven development |

Press `Tab` to switch between agents. Sub-agents are created on demand.

### 2. Persistent Memory System

Cross-session memory based on SQLite FTS5 + Vector RAG:

- **Project Memory** (`MEMORY.md`) - Persistent project knowledge, rules, architecture decisions
- **Session Checkpoint** (`checkpoint.md`) - Structured state snapshots maintained by checkpoint-writer sub-agent
- **Temporary Notes** (`notes.md`) - Agent's scratch pad
- **Task Progress** (`tasks/<id>/progress.md`) - Per-task logs
- **Vector Embedding** - Hybrid search with FTS + Vector (requires LM Studio with bge-m3 model)

Memory is auto-injected on session resume, so agents don't need to re-learn project context.

#### Hybrid Search (FTS + Vector)

When vector embedding is enabled, memory search uses hybrid ranking:
- **FTS (0.6 weight)** - Keyword matching with BM25
- **Vector (0.4 weight)** - Semantic similarity with cosine
- **Co-occurrence boost (1.3x)** - Documents matching both FTS and Vector get higher scores

```bash
# Enable vector embedding (requires LM Studio)
export MEMORY_EMBEDDING_ENABLED=1

# Start LM Studio and load text-embedding-bge-m3 model
# Default API endpoint: http://localhost:1234/v1/embeddings
```

### 3. Smart Context Management

- **Auto Checkpoint** - Decides when to save session state based on model context window
- **Context Rebuild** - Rebuilds from latest checkpoint, project memory, task progress, and retained recent messages when context approaches limits
- **Budget Injection** - Uses token budgets to control how much checkpoint, memory, and notes content enters context

### 4. Task Tracking

Tree-structured task system (`T1`, `T1.1`, `T1.2`, ...), auto-integrated with checkpoint system. Task progress persists across session resumes.

### 5. Sub-Agent System

Main agents can spawn sub-agents on demand. Sub-agents share current session context, can work in parallel, and support lifecycle tracking, cancellation, and background execution.

### 6. Goal / Stop Conditions

The `/goal` command sets stop conditions for a session. When the agent attempts to stop, an independent judge model evaluates the conversation to determine if conditions are truly met—preventing premature "optimistic stops" during autonomous work.

### 7. Compose Mode

Provides structured workflows for spec-driven development. Includes built-in skills for planning, execution, code review, TDD, debugging, verification, and merging—orchestrating the full lifecycle from spec to delivered code.

### 8. Dream & Distill

- **`/dream`** - Scans recent session traces, extracts durable knowledge into project memory, and deletes stale entries
- **`/distill`** - Discovers repeated manual workflows in recent work and packages high-confidence candidates into reusable skills, sub-agents, or commands

### 9. Max Mode

Parallel best-of-N reasoning with judge selection. Enable via `experimental.maxMode` in config.

### 10. Voice Input

Real-time streaming voice input powered by TenVAD and MiMo ASR. Activate with `/voice`, then speak—audio is segmented by pauses and incrementally transcribed into the input.

---

## HelixAgent Innovations

### 1. Cardinal Risk Control

**Source**: HelixAgent Innovation

4-level risk control to prevent high-risk operations:

| Level | Description | Action |
|-------|-------------|--------|
| **Block** | Severe risk | Immediate termination |
| **Pause** | Medium risk | Pause for confirmation |
| **Stop** | Minor risk | Stop and log |
| **Warn** | Potential risk | Warn and continue |

### 2. AlignmentGuard Drift Detection

**Source**: HelixAgent Innovation

Real-time detection of agent drift from goals:
- **File Drift** - Modifying many files unrelated to the goal
- **Rabbit Hole** - Running installation commands consecutively
- **Distraction** - curl/wget/open operations unrelated to the task

### 3. Trace Mechanism

**Source**: HelixAgent Innovation

Complete execution tracing system:
- **TraceReporter** - Trace event recording
- **HeuristicFilter** - Dirty data filtering
- **formatTree** - Tree visualization
- **Debug Log System** - 30+ module debug points

### 4. Token Budget Management

**Source**: HelixAgent Innovation

Token usage tracking and budget management:
- Daily token budget limits
- Per-task token budget allocation
- Token usage statistics

### 5. Metrics System

**Source**: HelixAgent Innovation

Performance metrics collection:
- ModelCall metrics (TTFT, latency, cache hit)
- ToolCall metrics (input/output bytes)
- AgentRequest metrics

### 6. Workflow Engine

**Source**: HelixAgent Innovation

JavaScript/JSON workflow script execution:
- Built-in workflows (deep-research)
- VFS sandbox
- Concurrency semaphore

### 7. Team System

**Source**: HelixAgent Innovation

Team collaboration with database persistence:
- Team creation and management
- Member role assignment
- Multi-agent session tracking

### 8. AST Graph

**Source**: HelixAgent Innovation

Code dependency analysis:
- Blast Radius calculation
- Contract extraction
- Dependency graph building

### 9. Shell Safety

**Source**: HelixAgent Innovation

AST-level command parsing and dangerous operation interception:
- Shell Tokenizer
- High-risk command interception
- Dynamic command detection

### 10. TUI Externalization

**Source**: HelixAgent Innovation

Complete terminal UI component library, 18 components:

| Type | Components |
|------|------------|
| **Indicators** | ModeIndicator, GoalIndicator, TokenIndicator |
| **Panels** | TaskPanel, ActorPanel, TracePanel, SkillPanel, AgentPanel |
| **Alerts** | CardinalAlert, AlignmentAlert |
| **Dialogs** | DialogMode, DialogMemory, DialogHistory |

---

## OpenSpec System

**Source**: HelixAgent Innovation

Structured requirements and verification system:

- **Spec Parsing** - Markdown-based requirement specs with verification commands
- **Compliance Judge** - Automated verification of implementation against specs
- **CLI Commands** - `opencode spec list/show/verify`
- **Spec Writer** - Auto-generate specs from task descriptions
- **Spec Converter** - Convert between markdown specs and code structure

### Usage

```bash
# List all specs
opencode spec list

# Show spec details
opencode spec show --name cardinal-integration

# Verify implementation
opencode spec verify --all
```

---

## Mode System

Fused mode system from OpenCode and MiMo Code:

| Mode | Source | Description | Shortcut |
|------|--------|-------------|----------|
| **Ask** | OpenCode | Read-only mode for questions | Tab |
| **Build** | OpenCode | Default mode, executes tools | Tab |
| **Plan** | OpenCode | Planning mode, no edit tools | Tab |
| **Compose** | MiMo Code | Composition mode with skills | Tab |
| **Max** | MiMo Code | Experimental, runs N candidates in parallel | Tab |
| **Loop** | HelixAgent | Loop mode with auto-feedback | Tab |

---

## Testing

```bash
# Run all tests
bun test

# Run unit tests
bun test test/memory/ test/phase2/ test/phase3/ test/phase4/ test/phase5/

# Run integration tests
bun test test/e2e/integration.test.ts

# Run session + tool + server tests (recommended)
OPENCODE_API_KEY=<your-key> bun test test/session/ test/tool/ test/server/ --timeout 60000

# Run TUI tests
bun test test/tui/
```

**Test Statistics** (verified with mimo provider):
- Session tests (prompt, processor, snapshot): 72 pass
- Tool tests (actor, task, skill, registry): 36 pass
- Server tests (httpapi-session, httpapi-sdk): 36 pass
- E2E integration: 23 pass
- **Total**: 167+ pass, 0 fail

**Note**: `test/session/structured-output-integration.test.ts` requires `OPENCODE_API_KEY` env var and passes 2/5 tests (remaining 3 are provider-specific structured output behavior differences).

---

## Project Structure

```
HelixAgent/
├── packages/
│   ├── core/                    # Core library
│   │   └── src/
│   │       ├── memory/          # Memory Layer (from MiMo Code)
│   │       ├── config/          # Config system
│   │       └── ...
│   └── opencode/                # Main application
│       └── src/
│           ├── actor/           # Actor concurrency (from MiMo Code)
│           ├── task/            # Task system (from MiMo Code)
│           ├── session/         # Session/Goal/Mode (from MiMo Code)
│           ├── agent/           # Agent config
│           ├── tool/            # Tool system
│           ├── openspec/        # OpenSpec system (HelixAgent Innovation)
│           ├── observability/   # AlignmentGuard/Trace (HelixAgent Innovation)
│           ├── evolution/       # Evolution Flywheel (HelixAgent Innovation)
│           ├── scheduler/       # Auto-Dev Scheduler (HelixAgent Innovation)
│           ├── team/            # Team system (HelixAgent Innovation)
│           ├── cli/cmd/tui/     # TUI components (HelixAgent Innovation)
│           └── ...
├── openspec/                    # Spec files
│   └── specs/
├── TUI_EXTERNALIZATION_PLAN.md
└── TRANSFORM_PLAN.md
```

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Primary language |
| **Bun** | Runtime and package manager |
| **Effect** | Functional effect system |
| **SolidJS** | TUI framework |
| **SQLite + FTS5** | Database |
| **Drizzle ORM** | ORM |
| **AI SDK** | LLM integration |

---

## Contributing

1. Fork the project
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "feat: add my feature"`
4. Push branch: `git push origin feature/my-feature`
5. Create Pull Request

---

## License

MIT License

Copyright (c) 2026 HelixAgent

This project is based on:
- [OpenCode](https://github.com/anomalyco/opencode) - MIT License
- [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) - MIT License

---

## Acknowledgments

- [OpenCode](https://github.com/anomalyco/opencode) - Foundation architecture
- [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) - Core capabilities
- [MiMo Token Plan](https://token-plan-cn.xiaomimimo.com) - API support
