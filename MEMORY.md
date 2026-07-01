# HelixAgent Project Memory

> Consolidated from opencode trajectory database on 2026-07-01
> Source: 22 HelixAgent-local sessions, 54 cross-project sessions, AGENTS.md, README.md, specs/, project files

---

## Project Identity

**HelixAgent** is a next-generation AI coding agent built on [OpenCode](https://github.com/anomalyco/opencode) architecture, fused with [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) core capabilities, and further innovated with advanced features.

- **Repository**: `/Users/onetwo/Documents/trae_projects/HelixAgent`
- **Default branch**: `dev` (local `main` may not exist; use `dev` or `origin/dev` for diffs)
- **npm package**: `opencode-ai` (v1.17.11)
- **License**: MIT

---

## Capability Sources

| Source | Capability | Description |
|--------|------------|-------------|
| **OpenCode** | Foundation | V1+V2 dual-system architecture, TUI, LSP, MCP, plugin system |
| **MiMo Code** | Core | Persistent memory, smart context management, sub-agent orchestration, goal-driven, Compose mode, Dream/Distill, Voice input, Max mode |
| **HelixAgent Innovation** | Advanced | Cardinal risk control, AlignmentGuard drift detection, Trace mechanism, Token budget, Metrics, Workflow engine, Team collaboration, AST Graph, Shell Safety, TUI externalization |

---

## Architecture (L0-L3)

```
L3 Access Layer   │  HTTP API + SSE / MCP Server / SDK / TUI
L2 Control Layer  │  Actor concurrency / Task system / Goal / Judge / Cardinal / AlignmentGuard
L1 Memory Layer   │  SQLite FTS5 BM25 + Vector RAG / Memory Reconcile / Multi-LLM Embedding
L0 Security Layer │  Shell Safety / ToolInterceptor (AST) / Permission System
```

---

## Key Packages (31 total)

| Package | npm Name | Description |
|---------|----------|-------------|
| `opencode` | `opencode` (private) | Main CLI entry point, TUI, server, business logic |
| `core` | `@opencode-ai/core` | Core domain: database schema (Drizzle), session, filesystem, MCP, git, LSP, permissions |
| `llm` | `@opencode-ai/llm` | Effect Schema-first LLM core: providers, protocols, routes, streaming |
| `schema` | `@opencode-ai/schema` | Wire/storage contracts (shared browser-safe schemas) |
| `protocol` | `@opencode-ai/protocol` | HTTP API protocol definitions, routes, endpoints |
| `server` | `@opencode-ai/server` | Server-side HTTP API implementation |
| `client` | `@opencode-ai/client` | Generated HTTP client (Promise + Effect APIs) |
| `tui` | `@opencode-ai/tui` | Terminal UI (SolidJS + OpenTUI) |
| `app` | `@opencode-ai/app` | Web UI (SolidJS + Vite) |
| `desktop` | `@opencode-ai/desktop` | Electron desktop app (wraps `app`) |
| `plugin` | `@opencode-ai/plugin` | Plugin SDK (public npm package) |

---

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Effect framework**: Effect v4 beta (effect-smol)
- **ORM**: Drizzle with SQLite
- **UI**: SolidJS + OpenTUI
- **Build**: Turbo, custom build scripts
- **Infrastructure**: SST (AWS + Cloudflare)

---

## Build & Test Commands

```bash
# Type checking (from package directory)
bun typecheck

# Tests
bun test --timeout 30000

# Build
bun run script/build.ts

# Dev server (use tmux, not foreground)
tmux new-session -d -s opencode-dev 'bun dev'
tmux capture-pane -pt opencode-dev
tmux kill-session -t opencode-dev
```

**Important**: Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

---

## Git Conventions

- **Branch names**: Short, max 3 words, hyphens. No slashes or type prefixes.
  - Good: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`
  - Bad: `feat/fix-scroll-state`, `fix/scroll-state`
- **Commits**: Conventional commit-style: `type(scope): summary`
  - Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
  - Scopes: `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, `plugin`

---

## Style Guide (Key Rules)

### General
- Keep things in one function unless composable or reusable
- Do not extract single-use helpers preemptively
- Avoid `try`/`catch` where possible
- Avoid `any` type
- Use Bun APIs (`Bun.file()`)
- Prefer functional array methods (flatMap, filter, map)
- Prefer `const` over `let`; use ternaries or early returns
- Avoid `else` statements; prefer early returns

### Imports
- Never alias imports (`import { foo as bar }`)
- Never use star imports (`import * as Foo`)
- Prefer dynamic imports for heavy modules

### Variables
- Inline when value is only used once
- Use dot notation, avoid unnecessary destructuring

### Drizzle Schema
- Use snake_case for field names so column names don't need redefining

---

## Effect Conventions

- Use `Effect.gen(function* () { ... })` for composition
- Use `Effect.fn("Domain.method")` for named/traced effects
- Use `Effect.fnUntraced` for internal helpers
- Use `Effect.void` instead of `Effect.succeed(undefined)`
- Prefer `DateTime.nowAsDate` over manual clock conversion
- In generators, bind services to named variables before calling methods
- Do not use nested service yields like `yield* (yield* Foo.Service).bar()`

### Module Pattern
```ts
export interface Interface { ... }
export class Service extends Context.Service<Service, Interface>()("@opencode/Foo") {}
export const layer = Layer.effect(Service, ...)
export const defaultLayer = layer.pipe(...)
export * as Foo from "./foo"
```

### Runtime vs InstanceState
- Use `makeRuntime` for all services (shared memoMap deduplication)
- Use `InstanceState` for per-directory/project state with per-instance cleanup
- If two open directories should not share one service copy, it needs `InstanceState`

---

## System Prompt Assembly

All system prompt assembly must use `SystemPromptBuilder.build(...)` from `packages/opencode/src/session/system-prompt-builder.ts`.

**Order**:
1. Provider persona prompt (stable)
2. Static instructions - AGENTS.md, CLAUDE.md, config (stable)
3. Environment metadata (low-frequency)
4. Project references (low-frequency)
5. MCP server instructions (low-frequency)
6. Available skills listing (low-frequency)
7. Structured-output reminder (conditional)
8. Per-user system override (per-session)

**Rule**: No dynamic content between stable blocks. Per-turn dynamic context goes in user message or tool result, never system prompt.

---

## V2 Session Core

- Durable prompt admission separate from model execution
- `SessionV2.prompt(...)` admits one durable `session_input` row before scheduling `SessionExecution.wake(sessionID)`
- Reusing a Session ID adopts the existing Session
- `SessionExecution` is process-global and Session-ID based
- Keep `SessionRunner`, model resolution, tool registry, permissions, and filesystem Location-scoped
- Preserve one explicit `llm.stream(request)` call per provider turn
- Keep delivery vocabulary explicit: `prompt` (steer), `queue` (pending)

---

## Dead Code Integration (Completed 2026-07-01)

**Status**: All 6 phases completed. 21 services + 6 tools integrated into main pipeline.

| Phase | Modules | Status |
|-------|---------|--------|
| Phase 1 | Trace + Metrics + TokenTracker | ✅ |
| Phase 2 | Cardinal + AlignmentGuard + Shell Safety | ✅ |
| Phase 3 | Goal + Actor + Task + ModeRegistry | ✅ |
| Phase 4 | Auto-Dream + Checkpoint Writer | ✅ |
| Phase 5 | 6 dead tools (actor, history, memory, workflow, screenshot, multiedit) | ✅ |
| Phase 6 | Evolution + Scheduler + Team + AST + Workflow + OpenSpecHook | ✅ (integrated 2026-06-30) |

### Main Chain Integration Status (Verified 2026-07-01)

**All Phase 6 services are now integrated** into the main execution path:

| Module | Registered | Called in prompt.ts | Called in processor.ts | Status |
|--------|------------|---------------------|------------------------|--------|
| **Evolution** | ✅ | `exportSession` at runLoop end | — | **Active** |
| **Team** | ✅ | Team summary after actor spawn | — | **Active** |
| **AST** | ✅ | — | Changed-file recording in tool-result | **Active** |
| **Workflow** | ✅ | Session lifecycle tracking | — | **Active** |
| **OpenSpecHook** | ✅ | — | Spec compliance checks | **Active** |
| **Scheduler** | ✅ | Token budget guard | — | **Partial** (budget check only) |

**Current branch**: `tui-dev`
**Key commit**: `744abf51` — feat(core): integrate 6 dormant services into execution path

---

## Auto-Development System

Two parallel implementations:
1. **External scheduler** (standalone Bun scripts in `script/auto-dev/`) — primary production path
2. **Internal Effect services** (in `packages/opencode/src/automation/`) — engine-layer implementation

### Key Files
- `script/auto-dev/scheduler.ts` — Main orchestrator (9-step pipeline)
- `script/auto-dev/judge-enhanced.ts` — Enhanced judge reviewer
- `script/auto-dev/spec-converter.ts` — OpenSpec to roadmap importer
- `.mimocode/roadmap.json` — Central task manifest

### Pipeline Steps
1. Execute task (via Gateway API or CLI)
2. Judge review (heuristic)
3. Enhanced judge (security, relevance, completeness)
4. Build
5. Typecheck
6. Test (changed files only)
7. Lint
8. Spec writeback
9. Git commit & push + Feishu notification

---

## Provider Configuration

### MiMo Token Plan (Recommended)
```json
{
  "provider": {
    "xiaomi": {
      "name": "MiMo Token Plan",
      "npm": "@ai-sdk/openai-compatible",
      "api": "https://token-plan-cn.xiaomimimo.com/v1",
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

### Kimi for Coding
```json
{
  "provider": {
    "kimi-for-coding": {
      "name": "Kimi For Coding",
      "npm": "@ai-sdk/openai-compatible",
      "api": "https://api.kimi.com/coding/v1",
      "env": ["KIMI_API_KEY"],
      "models": {
        "k2p7": { "name": "K2.7 Code" }
      }
    }
  }
}
```

---

## Existing Assets

### Skills (`.opencode/skills/`)
- `effect/` — Effect framework skill
- `deep-explore/` — Parallel subagent codebase exploration (created 2026-06-30)

### Commands (`.opencode/command/`)
- `ai-deps.md`, `changelog.md`, `commit.md`, `issues.md`, `learn.md`, `rmslop.md`, `spellcheck.md`, `translate.md`
- `compare-upstream.md` — Cross-project upstream comparison (created 2026-06-30)
- `db-inspect.md` — Read-only database inspection (created 2026-06-30)
- `prompt-audit.md` — System prompt assembly audit (created 2026-06-30)
- `integration-status.md` — Phase 6 integration verification (created 2026-07-01)
- `review-gaps.md` — Doc vs code consistency check (created 2026-07-01)

### Agents (`.opencode/agent/`)
- `duplicate-pr.md`, `triage.md`

---

## Session Statistics (HelixAgent-local)

- **Total sessions**: 22 (local) + 54 (cross-project)
- **Date range**: 2026-06-29 to 2026-07-01
- **Primary model**: `mimo-v2.5-pro` (xiaomi)
- **Secondary model**: `k2p7` (kimi-for-coding)
- **Agent modes used**: build, explore, dream, distill, ask, compose

### Session Breakdown (local)
| Agent | Count |
|-------|-------|
| explore | 11 |
| build | 2 |
| compose | 2 |
| dream | 3 |
| distill | 3 |
| ask | 1 |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/opencode/src/session/prompt.ts` | Core agent loop (`runLoop`), system prompt assembly |
| `packages/opencode/src/session/system-prompt-builder.ts` | System prompt builder (use this, not inline) |
| `packages/opencode/src/session/instruction.ts` | User instructions from config |
| `packages/opencode/src/effect/app-runtime.ts` | AppLayer with all service registrations |
| `packages/opencode/src/effect/run-service.ts` | `makeRuntime` for services |
| `packages/opencode/src/effect/instance-state.ts` | `InstanceState` for per-directory state |
| `packages/opencode/src/tool/` | Tool definitions and registry |
| `packages/opencode/src/config/` | Configuration modules |
| `packages/core/src/**/*.sql.ts` | Drizzle schema definitions |
| `packages/tui/src/routes/session/footer.tsx` | Token/Mode/Goal indicators |
| `packages/tui/src/routes/session/sidebar.tsx` | Task/Actor panels |
| `packages/tui/src/context/sync.tsx` | TUI data sync layer |
| `packages/opencode/src/token/tracker.ts` | TokenTracker service (needs session-scoped APIs) |
| `packages/opencode/src/metrics/metrics.ts` | Metrics service (query interfaces added) |

---

## TUI Externalization (Completed 2026-07-01)

**Status**: All core indicators and panels implemented.

### Implemented Components
| Component | Location | API Source |
|-----------|----------|------------|
| Token indicator | `footer.tsx` | TokenTracker.getDailyBudget() |
| Mode indicator | `footer.tsx` | ModeRegistry.inferMode() |
| Goal indicator | `footer.tsx` | Goal.get(sessionID) |
| Task panel | `sidebar.tsx` | TaskRegistry.listBySession() |
| Actor panel | `sidebar.tsx` | ActorRegistry.listBySession() |

### New HTTP API Endpoints
- `/api/goal/:sessionID` — Goal status
- `/api/tasks/:sessionID` — Task list
- `/api/actors/:sessionID` — Actor list
- `/api/metrics/:sessionID` — Metrics data
- `/api/token/:sessionID` — Token usage

**Key commit**: `64a13475` — feat(tui): externalize session indicators and panels

---

## Quality Assurance Roadmap (Created 2026-07-01)

**Document**: `SHORT_TERM_ATTACK_PLAN.md` (v2.0 完美版)
**Timeline**: 4-5 months
**Core Philosophy**: 质量保障起点从代码阶段前移到需求阶段

### Five-Layer Quality Loop
1. **Layer 0: 需求结构化** — Multi-agent Spec generation pipeline
2. **Layer 1: 执行前验收** — Goal Judge pre-check, Cardinal pre-check, OpenSpec pre-check
3. **Layer 2: 执行中监控** — Trace, Cardinal, AlignmentGuard, OpenSpec continuous validation
4. **Layer 3: 执行后验收** — OpenSpec final validation, test/typecheck, Goal Judge completion判定
5. **Layer 4: 持续改进** — Trace persistence, Evolution export, Spec库积累

### Current Quality Gaps
- Cardinal: 5 rules but 4 rarely trigger (insufficient context)
- OpenSpecHook: Only logWarning, doesn't block or feedback to model
- Trace: In-memory only, lost on restart
- Goal: Just turn counting (≥12 break), no real completion judgment
- AlignmentGuard: Only detectRabbitHole used, fileDrift/distraction unused

### Recommended Execution Order
1. Week 1: TUI externalization (✅ done)
2. Week 2: Memory Vector Store + History Service
3. Week 3: Phase 6 service activation (✅ done)
4. Week 4: Buffer + testing + fixes

---

## Important Notes

- **Do not run `bun dev` as blocking foreground command** — use tmux
- **Do not run tests from repo root** — run from package dirs
- **Do not edit `src/generated` or `src/generated-effect` directly** — run `bun run generate` from `packages/client`
- **Runtime dependencies**: Schema → Core → Protocol → Server. Client may depend on Schema and Protocol but never Core or Server.
- **AGENTS.md is the canonical style guide** — this memory supplements it, does not replace it

---

## Recent Session Insights (2026-07-01)

### Compose Session: "Helix Agent主链路状态与TUI外化评估"
- **Session ID**: `ses_0e6c994a3ffe7CLvjAw8y1JPJu`
- **Model**: mimo-v2.5-pro
- **Key Findings**:
  - 21 services + 6 tools now integrated into main chain
  - TUI externalization complete (Token/Mode/Goal indicators + Task/Actor panels)
  - Next priorities: Memory Vector Store, History Service, Inbox, Judge+Max
  - Created `SHORT_TERM_ATTACK_PLAN.md` (v2.0 完美版) with 4-5 month roadmap

### Build Session: "Coding agent与workflow智能体交付质量验收问题调研"
- **Session ID**: `ses_0e6c51767ffeTuzK05WgAYYMBg`
- **Model**: k2p7 (kimi-for-coding)
- **Key Findings**:
  - Quality assurance challenges researched (Anthropic, OpenAI, GitHub sources)
  - Created comprehensive quality gap analysis
  - Generated `SHORT_TERM_ATTACK_PLAN.md` with 9-phase implementation plan
  - Core insight: "集成≠有效" — integration doesn't equal effectiveness

### Explore Session: "Review文档与代码一致性"
- **Session ID**: `ses_0e3d2f382ffeWua6uelIF3v7eW`
- **Model**: mimo-v2.5-pro
- **Verified**: All Phase 6 services are now actually called in main chain (not just registered)
- **Doc Status**: HELIX_AGENT_STATUS.md updated to v1.2 reflecting completion

### Explore Session: "检查TUI外化底层能力"
- **Session ID**: `ses_0e490f581ffepvaViu4ZHYpFXW`
- **Model**: mimo-v2.5-pro
- **Findings**: TokenTracker/ModeRegistry/Goal/TaskRegistry/ActorRegistry APIs analyzed for TUI externalization
- **Gap**: TokenTracker missing session-scoped query APIs (getUsage, getStats)

### Dream Session: Memory Consolidation (Previous)
- **Session ID**: `ses_0e933b1a2ffeWyuLTYDRWNwBJL`
- **Model**: mimo-v2.5-pro
- **Output**: Previous MEMORY.md consolidation (2026-06-30)

### Distill Session: Asset Creation (Previous)
- **Session ID**: `ses_0e933b1a1ffePDcRbglgqcsr7b`
- **Model**: mimo-v2.5-pro
- **Created Assets**: 4 new workflow assets (deep-explore, compare-upstream, db-inspect, prompt-audit)
