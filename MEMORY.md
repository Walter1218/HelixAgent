# HelixAgent Project Memory

> Consolidated from opencode trajectory database on 2026-07-09 (ninth pass)
> Source: 187 HelixAgent-local sessions, AGENTS.md, README.md, specs/, project files, MAIN_CHAIN_ASSESSMENT.md, CODE_AUDIT_AND_FIX_PLAN.md

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
| `creator-helix` | (private) | CreatorHelix anime/video creation subsystem with state machine workflow |

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
- `anime-creator-test/` — Anime creator testing skill (new)
- `build-verify/` — Unified typecheck→build→test→smoke pipeline (created 2026-07-05, distill pass)
- `compare-implementations/` — Structured side-by-side codebase comparison
- `db-inspect/` — Database inspection skill (new)
- `deep-explore/` — Parallel subagent codebase exploration (created 2026-06-30)
- `effect/` — Effect framework skill
- `git-commit-push/` — Git commit and push skill (new)
- `test-fix/` — Automated test-failure fix cycle (created 2026-07-03)
- `tui-smoke/` — TUI startup verification and black-screen diagnosis (created 2026-07-02)
- `typecheck-fix/` — Automated typecheck-fix cycle (created 2026-07-02)
- `verify-implementation/` — Doc vs code verification
- `video-pipeline/` — Multi-agent video generation pipeline with SeedDance/可灵 API integration (created 2026-07-08)

### Commands (`.opencode/command/`)
- `ai-deps.md`, `changelog.md`, `commit.md`, `issues.md`, `learn.md`, `rmslop.md`, `spellcheck.md`, `translate.md`
- `compare-upstream.md` — Cross-project upstream comparison (created 2026-06-30)
- `db-inspect.md` — Read-only database inspection (created 2026-06-30)
- `prompt-audit.md` — System prompt assembly audit (created 2026-06-30)
- `integration-status.md` — Phase 6 integration verification (created 2026-07-01)
- `review-gaps.md` — Doc vs code consistency check (created 2026-07-01)
- `git-push.md` — Push current branch with optional flags (created 2026-07-03)
- `status-check.md` — Read project status files and summarize (created 2026-07-03)
- `service-wiring.md` — Verify service registration and call sites (created 2026-07-03)
- `alpha-screen.md` — AlphaHelix daily A-share stock screening (created 2026-07-03)
- `layer-diagnose.md` — Find unprovided Effect layer dependencies (created 2026-07-05, distill pass)
- `rapid-status.md` — One-shot project health scan: branch, errors, commits, tokens (created 2026-07-05, distill pass)
- `quick-check.md` — Rapid health scan (created 2026-07-05)

### Agents (`.opencode/agent/`)
- `duplicate-pr.md`, `triage.md`

---

## Session Statistics (HelixAgent-local)

- **Total sessions**: 187 (local)
- **Date range**: 2026-06-29 to 2026-07-09
- **Primary model**: `mimo-v2.5-pro` (xiaomi) — 98 sessions (86 default + 11 untagged + 1 high)
- **Secondary model**: `k2p7` (kimi-for-coding) — 26 sessions (25 default + 1 untagged)
- **Tertiary model**: `LongCat-2.0` (LongCat) — 15 sessions (all high variant)
- **Other models**: `mimo-v2.5` variants (11), `north-mini-code-free` (2)
- **Agent modes used**: alpha-analyst, dream, distill, explore, ask, build, compose

### Session Breakdown (local)
| Agent | Count |
|-------|-------|
| dream | 40 |
| distill | 40 |
| explore | 39 |
| alpha-analyst | 34 |
| build | 13 |
| ask | 11 |
| compose | 9 |
| (empty) | 1 |

### Daily Activity
| Date | Sessions |
|------|----------|
| 2026-07-09 | 2 |
| 2026-07-08 | 8 |
| 2026-07-07 | 17 |
| 2026-07-06 | 5 |
| 2026-07-05 | 2 |
| 2026-07-04 | 11 |
| 2026-07-03 | 48 |
| 2026-07-02 | 62 |
| 2026-07-01 | 14 |
| 2026-06-30 | 7 |
| 2026-06-29 | 11 |

### Database Activity
- **Messages**: 12,682
- **Parts**: 52,145
- **Trace events**: 10,122
- **History FTS entries**: 9,254
- **Memory FTS entries**: 0 (⚠️ still empty)
- **Memory Vec entries**: 0 (⚠️ still empty)
- **Todo entries**: 73 (56 completed, 3 in_progress, 14 pending)
- **Inbox entries**: 0
- **Workflow runs**: 0
- **Team entries**: 0
- **Team members**: 0
- **Spec library entries**: 0
- **Session context epochs**: 6
- **Session inputs**: 6
- **Session messages**: 103
- **Events**: 175,005
- **Event sequences**: 187

### Token Usage (cumulative)
- **Total tokens input**: 121,758,233
- **Total tokens output**: 3,812,752
- **Total tokens reasoning**: 631,448
- **Total tokens cache read**: 2,682,172,263
- **Total cost**: $21.51

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
| `MAIN_CHAIN_ASSESSMENT.md` | Quality assessment of all integrated modules |
| `packages/opencode/src/session/auto-dream.ts` | Auto-Dream/Distill trigger logic |
| `packages/opencode/src/tool/memory.ts` | Memory search tool (read-only, no writes) |
| `packages/opencode/src/history/schema.ts` | History service schema (no implementation) |
| `packages/opencode/openspec/` | OpenSpec system and spec files |

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
2. Week 2: Memory Vector Store (✅ done) + History Service
3. Week 3: Phase 6 service activation (✅ done)
4. Week 4: Buffer + testing + fixes

---

## Current Development Status (2026-07-09)

### Branch Status
- **Current branch**: `tui-dev`
- **Uncommitted changes**: 25 modified/deleted/untracked files
- **New untracked files**: 
  - Commands: `alpha-screen.md`, `git-push.md`, `layer-diagnose.md`, `quick-check.md`, `rapid-status.md`, `service-wiring.md`, `status-check.md`
  - Skills: `anime-creator-test/`, `build-verify/`, `db-inspect/`, `git-commit-push/`, `test-fix/`, `video-pipeline/`
  - Packages: `CreatorHelix/`, `packages/creator-helix/`
  - New: `AnimeHelix/` — Blender + AI video creation project (with AGENTS.md, assets, docs, knowledge)
  - New: `CODE_AUDIT_AND_FIX_PLAN.md` — Comprehensive code audit (2026-07-08)
  - New: `.opencode/DISTILL_REPORT.md` — 30-day tool usage analysis
  - New: `.opencode/DREAM_CONSOLIDATION_2026-07-09.md` — Dream consolidation report
  - New: `packages/opencode/src/cli/cmd/tui-enhanced.ts` — Enhanced TUI CLI command
  - Removed: `packages/opencode/src/plugin/tui/enhanced/` — TUI enhanced plugin layer (15 components) — directory no longer exists
  - Removed: `packages/opencode/src/plugin/tui/enhanced-host.ts` — Enhanced TUI host — file no longer exists
  - Deleted: `packages/opencode/openspec/specs/chain-test-1782989490189.md`

### Recent Commits (Last 15 - 2026-07-02 onwards)
1. `c10cac97f` — fix: web_search 默认 URL 改为 token-plan-cn.xiaomimimo.com
2. `537dcb63f` — fix(security): improve error handling and sensitive data protection
3. `b64c474d7` — docs(reflection): detail Phase 1 data collection layer implementation
4. `3c8330ea6` — docs(reflection): add persistence feedback loop to reflection design v1.2
5. `cae8a2b31` — docs: update judge display spec and add TUI sidebar constraints to AGENTS.md
6. `e6aa8385e` — feat(tui): add judge status in sidebar context and trace panel
7. `77c0a09b7` — feat(tui): display GoalJudge verdict in footer indicator
8. `0eba60779` — docs: add TUI judge display spec
9. `477980bbe` — fix: enable History tool by default and unify config defaults
10. `4942aa089` — docs: update reflection mechanism design v1.1
11. `3663da2b5` — docs: add reflection mechanism design document
12. `536545bfd` — docs: add SHORT_TERM_ATTACK_PLAN completion status to MEMORY.md and HELIX_AGENT_STATUS.md
13. `4775588dd` — docs: update SHORT_TERM_ATTACK_PLAN.md with completion status
14. `a5a61f002` — docs: update documentation with real LLM verification results
15. `8afd098f7` — fix: simulate different candidate quality in Max Mode

### New Assets Created (2026-07-03 to 2026-07-08)
- **Spec files**: `packages/opencode/openspec/specs/chain-test-1783053188748.md`
- **Reflection docs**: `REFLECTION_MECHANISM_DESIGN.md` (v1.1, v1.2)
- **TUI enhancements**: GoalJudge verdict in footer, judge status in sidebar context
- **TUI enhanced plugin layer**: `packages/opencode/src/plugin/tui/enhanced/` (15 components: footer, sidebar-*, dialog-*, alert-*, index)
- **TUI enhanced host**: `packages/opencode/src/plugin/tui/enhanced-host.ts`
- **TUI enhanced CLI**: `packages/opencode/src/cli/cmd/tui-enhanced.ts`
- **Security fix**: web_search default URL changed to token-plan-cn.xiaomimimo.com
- **Security fix**: Improved error handling and sensitive data protection
- **New package**: `packages/creator-helix/` — CreatorHelix anime/video creation subsystem
- **New project**: `AnimeHelix/` — Blender + AI video creation project (with AGENTS.md, assets, docs, knowledge)
- **Code audit**: `CODE_AUDIT_AND_FIX_PLAN.md` — Comprehensive module-by-module audit (2026-07-08)
- **Distill report**: `.opencode/DISTILL_REPORT.md` — 30-day tool usage analysis
- **New commands**: `quick-check.md` (rapid health scan)

### Development Plan Status (from DEVELOPMENT_PLAN.md)
| Phase | Content | Status |
|-------|---------|--------|
| **TUI 外化** | Token/Mode/Goal indicators + Task/Actor panels | ✅ Completed |
| **阶段一** | Memory Vector Store 启用 | ✅ Completed (2026-07-02) |
| **阶段二** | History Service | ✅ Completed (2026-07-02) |
| **阶段三** | Inbox + Distill Agent | ✅ Completed (2026-07-02) |
| **阶段四** | Judge + Max 模式 | ✅ Completed (2026-07-02) |
| **暂缓** | Shadow Worktree | ⏸️ 暂缓 (P3) |

### Recent Focus Areas (2026-07-09)
- **Auto Dream/Distill**: 40 sessions each (was 39) — continuing regular operation
- **Explore sessions**: 39 total (unchanged) — TUI-related subagent sessions complete
- **Helix TUI Architecture**: Enhanced TUI plugin layer directory removed (was 15 components)
  - `packages/opencode/src/plugin/tui/enhanced/` no longer exists
  - `enhanced-host.ts` removed
  - `tui-enhanced.ts` CLI command still exists
- **Video Pipeline**: New skill created for multi-agent video generation
  - SeedDance/可灵 API integration
  - Director → Scene Designer → Cinematographer pipeline
  - A/B/C testing for video generation approaches
- **Code Audit**: `CODE_AUDIT_AND_FIX_PLAN.md` created (2026-07-08)
  - Comprehensive module-by-module audit of all integrated modules
  - Confirms 15+ modules "observe only, don't intervene"
  - Identifies only 2 hard gates (Cardinal block + Scheduler token budget)
- **AnimeHelix**: Blender + AI video creation project
  - Focus: e-commerce product videos, short dramas, sci-fi videos
  - Standard workflow: Requirements → Script → Blender pre-prod → AI enhance → Post-prod → Delivery
- **LongCat-2.0**: 15 sessions (was 16) — stable tertiary model
- **3D Engine Review**: 6 explore sessions reviewing anime-creator 3D engine (已完成, 不再有新session)
- **CreatorHelix Development**: Package for anime/video creation with 64 projects, 533 transition logs
- **Memory System**: Still investigating empty memory_fts/memory_vec tables (80+ dream/distill sessions, 0 entries)
- **New Skills**: anime-creator-test, db-inspect, git-commit-push added to skill library

---

## Memory System Status (2026-07-09)

### Current State
- **memory_fts table**: Active, but EMPTY (0 entries) ⚠️
- **memory_vec table**: Active, but EMPTY (0 entries) ⚠️
- **history_fts table**: Active, 9,254 entries ✅
- **Memory tool**: Enabled by default (`OPENCODE_EXPERIMENTAL_MEMORY_TOOL=1`)
- **Vector embedding**: Enabled by default (`MEMORY_EMBEDDING_ENABLED=1`)
- **Hybrid search**: FTS (0.6) + Vector (0.4) with co-occurrence boost (1.3x)

### Critical Issue
**Memory FTS/Vec tables are empty** — memory search returns nothing. This is a known bug that needs investigation. 40 dream + 40 distill sessions have run but memory tables remain empty.

### Implementation Details
- **VecStore**: `packages/core/src/memory/vec-store.ts` - Vector storage and retrieval
- **Embedder**: `packages/core/src/memory/embedder.ts` - LM Studio API integration
- **Memory.Service**: `packages/core/src/memory/service.ts` - FTS + Vector hybrid search
- **Migration**: `packages/core/src/database/migration/20260701_add_memory_vec.ts`

### Configuration
```bash
# Environment variables
MEMORY_EMBEDDING_ENABLED=1          # Enable vector embedding (default: true)
MEMORY_EMBEDDING_BASE_URL=http://localhost:1234/v1/embeddings
MEMORY_EMBEDDING_MODEL=text-embedding-bge-m3

# Or in config.json
{
  "memory": {
    "embedding": {
      "enabled": true,
      "baseUrl": "http://localhost:1234/v1/embeddings",
      "model": "text-embedding-bge-m3"
    }
  }
}
```

### Test Coverage
- 51+ tests passing in `test/memory/`, `test/history/`, `test/inbox/`, `test/judge/`
- E2E scenarios verified: API design, testing strategies, TypeScript tips
- Hybrid search returns correct results with proper ranking
- Real LLM verification: Judge, History, Inbox, AlignmentGuard all working
- Harness layer trace tests: All 4 scenarios passing

### Real LLM Test Results (2026-07-02)
- **Test File**: `test/e2e/real-llm.test.ts`
- **LLM Provider**: MiMo V2.5 Pro (token-plan API)
- **Results**:
  - Judge evaluation: ✅ Code quality assessment works
  - Assertion reduction: ✅ Detected 75% reduction (reject)
  - History search: ✅ Found 2 results for "RESTful API"
  - Security check: ✅ No issues detected for safe code

---

## Important Notes

- **Do not run `bun dev` as blocking foreground command** — use tmux
- **Do not run tests from repo root** — run from package dirs
- **Do not edit `src/generated` or `src/generated-effect` directly** — run `bun run generate` from `packages/client`
- **Runtime dependencies**: Schema → Core → Protocol → Server. Client may depend on Schema and Protocol but never Core or Server.
- **AGENTS.md is the canonical style guide** — this memory supplements it, does not replace it
- **CODE_AUDIT_AND_FIX_PLAN.md** — Comprehensive module audit (2026-07-08), confirms 15+ record-only modules and only 2 hard gates

---

## Quality Assessment (2026-07-02)

**Document**: `MAIN_CHAIN_ASSESSMENT.md`
**Assessment Date**: 2026-07-02
**Scope**: All integrated modules in packages/opencode/src

### Module Quality Rankings

| Tier | Modules | Score |
|------|---------|-------|
| **A/A-** | Trace (8.3), Cardinal (8.0), OpenSpec (7.7), Workflow (7.7) | Production-grade |
| **B+** | Team (6.7), History tool (6.7) | Half-finished |
| **B** | AST (6.3), LSP tool (6.3), SpecReport (6.3), Scheduler (6.0) | Half-finished |
| **C/D** | Metrics (3.0), TokenTracker (2.3), Checkpoint Writer (1.0) | Scaffold |

### Critical Issues Identified

1. **"Record-only" Pattern**: 15+ modules observe and log but never inject back into prompt or block behavior
2. **Only 2 Hard Gates**: Cardinal `block` (prevents tool execution) + Scheduler token budget (interrupts loop)
3. **Memory Not Persisted**: Metrics and TokenTracker use in-memory `Ref`, lost on restart
4. **Checkpoint Writer Broken**: `spawnRef.current` never assigned, always returns silently
5. **Auto-Dream Timer Bug**: In-memory timer resets to 0 on every restart, triggering dream on first prompt
6. **Memory FTS Empty**: `memory_fts` table has 0 entries, memory search returns nothing

### Highest ROI Improvements

| Priority | Improvement | Expected Effect |
|:---:|-------------|-----------------|
| P0 | Metrics/TokenTracker persistence to SQLite | Data survives restarts |
| P0 | Checkpoint Writer connect spawnRef | Activate checkpoint infrastructure |
| P1 | AST blast radius → prompt injection | Observation → closed-loop |
| P1 | AlignmentGuard detectFileDrift → main chain | Activate dead code |
| P1 | TokenTracker canAfford → prompt loop | Real budget gating |
| P2 | Auto-Dream timer persistence | Fix restart trigger bug |
| P2 | ModeRegistry inferMode → agent parsing | Mode affects behavior |
| P2 | Goal entry expansion (not just spec tool) | More general goal-driven |

---

## Recent Session Insights (2026-07-09)

### New Sessions Since Last Consolidation (2026-07-08 → 2026-07-09)
- **Total new**: 2 sessions
- **Dream**: +1 (Auto Dream)
- **Distill**: +1 (Auto Distill)

### Auto Dream/Distill Sessions (2026-07-09)
- **Dream sessions**: 40 total (was 39)
- **Distill sessions**: 40 total (was 39)
- **Observation**: Auto-dream/distill running regularly but memory tables still empty
- **Issue**: Memory persistence not working despite auto-dream triggers (80 total sessions, 0 memory entries)

### Recent Focus Areas (2026-07-09)
- **Video Pipeline**: New skill created for multi-agent video generation
  - SeedDance/可灵 API integration
  - Director → Scene Designer → Cinematographer pipeline
  - A/B/C testing for video generation approaches
- **Enhanced TUI Cleanup**: Removed enhanced plugin layer directory and enhanced-host.ts
  - `packages/opencode/src/plugin/tui/enhanced/` no longer exists
  - `enhanced-host.ts` removed
  - `tui-enhanced.ts` CLI command still exists
- **Memory System**: Critical bug persists — 78 dream/distill sessions produced 0 memory entries

### Auto Dream/Distill Sessions (2026-07-07)
- **Dream sessions**: 37 total (was 36)
- **Distill sessions**: 37 total (was 36)
- **Observation**: Auto-dream/distill running regularly but memory tables still empty
- **Issue**: Memory persistence not working despite auto-dream triggers

### 3D Engine Review Sessions (2026-07-04 to 2026-07-06)
- **Count**: 6 explore sessions
- **Purpose**: Comprehensive review of anime-creator 3D engine
- **Sessions**:
  - `review 3D引擎上下游链路` — Upstream/downstream analysis (2026-07-06)
  - `全面审查3D引擎系统` — Full system review (2026-07-05)
  - `Review 3D引擎代码质量` — Code quality review (2026-07-05)
  - `探索anime-creator项目结构` — Project structure exploration (2026-07-04)
  - `检查3D引擎文档一致性` — Documentation consistency check (2026-07-04)
  - `分析 anime-creator harness 层` — Harness layer analysis (2026-07-04)

### CreatorHelix Development (2026-07-05 to 2026-07-07)
- **New package**: `packages/creator-helix/`
- **Database tables**: `creator_helix_project` (64), `creator_helix_asset` (0), `creator_helix_shot` (0), `creator_helix_transition_log` (533)
- **Purpose**: Anime/video creation subsystem with state machine workflow
- **Status**: Active development, 64 projects created

### Anime Creator Compose Sessions (2026-07-04)
- **Sessions**: 
  - `Anime Creator 3D引擎最新开发需求` — Latest 3D engine development requirements
  - `Anime creator 图像输入端点错误排查` — Image input endpoint debugging
  - `Anime creator 开发现状与任务优先级` — Status and task prioritization

### API Key Management (2026-07-06)
- **Session**: `更换kimi for coding API密钥` (build)
- **Purpose**: Rotate kimi-for-coding API key

### Auto Dream/Distill Sessions (2026-07-07)
- **Dream sessions**: 37 total (was 36)
- **Distill sessions**: 37 total (was 36)
- **Observation**: Auto-dream/distill running regularly but memory tables still empty
- **Issue**: Memory persistence not working despite auto-dream triggers

### AlphaHelix Testing Sessions (2026-07-03 to 2026-07-05)
- **Count**: 34 sessions (unchanged)
- **Agent**: alpha-analyst
- **Purpose**: Testing alpha-analyst agent capabilities

### Build Session: "Helix Agent 现状与优化方向" (Previous)
- **Session ID**: `ses_0dcdd9cd5ffeDNi4UCbv7TJ7io`
- **Model**: mimo-v2.5-pro
- **Key Findings**:
  - Comprehensive analysis of current project status
  - Dead Code Activation Phase 1-6: All completed (21 services + 6 tools)
  - TUI externalization: Completed
  - OpenSpec system: Fully integrated
  - Memory Vector Store: Completed (FTS + Vector hybrid search)
  - History Service: Completed (FTS search, inject to user message)
  - Inbox System: Completed (send/list/markRead/markAllRead)
  - Distill Agent: Completed (shouldAutoDistill + independent agent)
  - Judge System: Completed (8 heuristic checks)
  - Max Mode: Completed (candidate generation + Judge evaluation)
  - Type checking: Passing (0 errors)
  - All phases completed!

### Build Session: "Helix Agent 能力集成开发" (Previous)
- **Session ID**: Current session
- **Model**: mimo-v2.5-pro
- **Key Findings**:
  - All development phases completed (Phase 1-4)
  - Memory Vector Store: FTS + Vector hybrid search with LM Studio bge-m3
  - History Service: FTS search, inject to user message
  - Inbox System: Actor-to-actor messaging, AlignmentGuard alerts
  - Judge System: 8 heuristic checks for code quality
  - Max Mode: Parallel candidate generation with Judge evaluation
  - All harness layers verified with real LLM calls
  - Type checking: Passing (0 errors)
  - 51+ tests passing

### SHORT_TERM_ATTACK_PLAN 完成状态 (2026-07-02)
| Phase | 内容 | 状态 | 完成度 |
|-------|------|------|--------|
| **Phase 0** | 基础设施 | ✅ 已完成 | 100% |
| **Phase 1** | 多智能体 Spec 生成 MVP | ⚠️ 部分完成 | 30% |
| **Phase 2** | Spec 生成与执行链路打通 | ⚠️ 部分完成 | 40% |
| **Phase 3** | 执行前验收层 | ✅ 已完成 | 80% |
| **Phase 4** | 完整执行中监控 | ✅ 已完成 | 100% |
| **Phase 5** | 执行后验收与判定 | ⚠️ 部分完成 | 60% |
| **Phase 6** | 端到端质量测试体系 | ✅ 已完成 | 70% |
| **Phase 7** | Spec 库与持续改进 | ⚠️ 部分完成 | 20% |
| **Phase 8** | AST 语义升级 | ✅ 已完成 | 80% |

### Harness Layer Verification (2026-07-02)
- **Test File**: `test/e2e/real-llm.test.ts`
- **Real LLM Calls**: MiMo V2.5 Pro via token-plan API
- **Results**:
  - Judge evaluation: ✅ Works (approve/reject/warn)
  - Assertion reduction detection: ✅ Works (detected 75% reduction)
  - History recording: ✅ Works (search returns correct results)
  - Security check: ✅ Works (detected dangerous patterns)
- **Conclusion**: All harness layers working correctly with real LLM

### Critical Issues Identified (2026-07-06)

#### 1. Memory Tables Empty ⚠️
- **Issue**: `memory_fts` and `memory_vec` tables have 0 entries
- **Impact**: Memory search returns nothing, dream/distill sessions not persisting
- **Evidence**: 40 dream + 40 distill sessions ran but memory tables still empty
- **Status**: Known bug, needs investigation (80 total sessions produced 0 memory entries)

#### 2. Empty Service Tables ⚠️
- **Inbox**: 0 entries (should have AlignmentGuard alerts)
- **Workflow runs**: 0 entries (should track session lifecycle)
- **Team entries**: 0 entries (should have team summaries)
- **Team members**: 0 entries
- **Spec library**: 0 entries (should accumulate specs)

#### 3. "Record-Only" Pattern (from MAIN_CHAIN_ASSESSMENT.md)
- **Issue**: 15+ modules observe and log but never inject back into prompt or block behavior
- **Impact**: Observations don't influence agent behavior
- **Status**: Identified, needs remediation

#### 4. Only 2 Hard Gates
- **Cardinal block**: Prevents tool execution
- **Scheduler token budget**: Interrupts loop
- **Impact**: Limited quality control enforcement

#### 5. In-Memory State Loss
- **Metrics**: Use in-memory `Ref`, lost on restart
- **TokenTracker**: Use in-memory `Ref`, lost on restart
- **Auto-Dream Timer**: Resets to 0 on every restart, triggering dream on first prompt

### Build Session: "helix agent 现状、实现质量与待办功能排查" (Previous)
- **Session ID**: `ses_0dd31ca72ffetA1WpKffEPUQpp`
- **Model**: mimo-v2.5-pro
- **Key Findings**:
  - Created `MAIN_CHAIN_ASSESSMENT.md` with comprehensive quality assessment
  - Identified "record-only" pattern in 15+ modules
  - Only 2 hard gates in entire system (Cardinal block + Scheduler token budget)
  - Highest ROI improvements identified (P0: Metrics/TokenTracker persistence, Checkpoint Writer activation)

### Explore Session: "探索 Helix Agent 项目结构" (Previous)
- **Session ID**: `ses_0dcdd71bcffe7d0h6Q0dQSq3kL`
- **Model**: mimo-v2.5-pro
- **Key Findings**:
  - Project structure analysis for build session
  - 32 packages in monorepo
  - Effect v4 beta (effect-smol) framework
  - SQLite FTS5 for full-text search

### Dream Sessions: Multiple Auto Dream (2026-07-02)
- **Count**: 7 sessions
- **Observation**: memory_fts table has 0 entries, memory search returns nothing
- **Issue**: Auto-Dream timer resets on every restart, triggering dream on first prompt

### Compose Session: "Helix Agent主链路状态与TUI外化评估" (Previous)
- **Session ID**: `ses_0e6c994a3ffe7CLvjAw8y1JPJu`
- **Model**: mimo-v2.5-pro
- **Key Findings**:
  - 21 services + 6 tools now integrated into main chain
  - TUI externalization complete (Token/Mode/Goal indicators + Task/Actor panels)
  - Memory Vector Store completed (2026-07-02)
  - Next priorities: History Service, Inbox + Distill, Judge + Max
  - Created `SHORT_TERM_ATTACK_PLAN.md` (v2.0 完美版) with 4-5 month roadmap

### Build Session: "Coding agent与workflow智能体交付质量验收问题调研" (Previous)
- **Session ID**: `ses_0e6c51767ffeTuzK05WgAYYMBg`
- **Model**: k2p7 (kimi-for-coding)
- **Key Findings**:
  - Quality assurance challenges researched (Anthropic, OpenAI, GitHub sources)
  - Created comprehensive quality gap analysis
  - Generated `SHORT_TERM_ATTACK_PLAN.md` with 9-phase implementation plan
  - Core insight: "集成≠有效" — integration doesn't equal effectiveness

### Explore Session: "Review文档与代码一致性" (Previous)
- **Session ID**: `ses_0e3d2f382ffeWua6uelIF3v7eW`
- **Model**: mimo-v2.5-pro
- **Verified**: All Phase 6 services are now actually called in main chain (not just registered)
- **Doc Status**: HELIX_AGENT_STATUS.md updated to v1.2 reflecting completion

### Dream Memory Consolidation (2026-07-09, ninth pass)
- **Purpose**: Consolidate verified information from trajectory database
- **Source**: 187 sessions from opencode-local.db
- **Key Updates**:
  - Session count: 185 → 187 (+2)
  - dream: 39 → 40 (+1)
  - distill: 39 → 40 (+1)
  - explore: 39 (unchanged)
  - build: 14 → 13 (-1)
  - ask: 10 → 11 (+1)
  - compose: 9 (unchanged)
  - alpha-analyst: 34 (unchanged)
  - Messages: 12,542 → 12,682 (+140)
  - Parts: 51,543 → 52,145 (+602)
  - Trace events: 9,946 → 10,122 (+176)
  - History FTS: 9,081 → 9,254 (+173)
  - Memory tables: Still empty (critical bug persists — 80 dream/distill sessions, 0 entries)
  - Token input: 120.1M → 121.8M (+1.6M)
  - Token output: 3.7M → 3.8M (+39K)
  - Token reasoning: 627,350 → 631,448 (+4K)
  - Token cache read: 2.66B → 2.68B (+17.5M)
  - Cost: $21.10 → $21.51 (+$0.41)
  - Daily activity: 2026-07-09 started with 2 sessions
  - Todo: 73 (was 71, +2: 3 completed, -1 pending)
  - Events: 172,925 → 175,005 (+2,080)
  - CreatorHelix: 61 → 64 projects (+3), 519 → 533 transition logs (+14)
  - New skills: anime-creator-test, db-inspect, git-commit-push
  - Git status: 25 uncommitted changes (was ~9)
  - LongCat-2.0: 15 sessions (was 16, -1)
  - mimo-v2.5-pro: 98 sessions (was 95, +3)
  - north-mini-code-free: 2 sessions (was 3, -1)

### Dream Memory Consolidation (2026-07-09, eighth pass)
- **Purpose**: Consolidate verified information from trajectory database
- **Source**: 185 sessions from opencode-local.db
- **Key Updates**:
  - Session count: 183 → 185 (+2)
  - dream: 38 → 39 (+1)
  - distill: 38 → 39 (+1)
  - explore: 39 (unchanged)
  - build: 14 (unchanged)
  - ask: 10 (unchanged)
  - compose: 9 (unchanged)
  - alpha-analyst: 34 (unchanged)
  - Messages: 12,045 → 12,542 (+497)
  - Parts: 49,722 → 51,543 (+1,821)
  - Trace events: 9,432 → 9,946 (+514)
  - History FTS: 8,564 → 9,081 (+517)
  - Memory tables: Still empty (critical bug persists — 78 dream/distill sessions, 0 entries)
  - Token input: 118.8M → 120.1M (+1.3M)
  - Token output: 3.7M → 3.8M (+94K)
  - Token reasoning: 618,438 → 627,350 (+9K)
  - Token cache read: 2.5B → 2.7B (+127M)
  - Cost: $20.90 → $21.10 (+$0.20)
  - Daily activity: 2026-07-08 increased from 6 to 8 sessions
  - Todo: 65 → 71 (+6: 5 completed, 1 pending)
  - Events: 166,165 → 172,925 (+6,760)
  - New skill: video-pipeline (multi-agent video generation pipeline)
  - Removed: Enhanced TUI plugin layer directory (15 components) and enhanced-host.ts
  - LongCat-2.0: 16 sessions (unchanged)

### Dream Memory Consolidation (2026-07-08, seventh pass)
- **Purpose**: Consolidate verified information from trajectory database
- **Source**: 183 sessions from opencode-local.db
- **Key Updates**:
  - Session count: 167 → 183 (+16)
  - explore: 27 → 39 (+12, major increase from TUI-related subagent sessions)
  - build: 12 → 14 (+2, system status checks)
  - dream: 37 → 38 (+1)
  - distill: 37 → 38 (+1)
  - alpha-analyst: 34 (unchanged)
  - ask: 10 (unchanged)
  - compose: 9 (unchanged)
  - Messages: 10,968 → 12,045 (+1,077)
  - Parts: 45,442 → 49,722 (+4,280)
  - Trace events: 7,977 → 9,432 (+1,455)
  - History FTS: 7,144 → 8,564 (+1,420)
  - Memory tables: Still empty (critical bug persists)
  - Token input: 113.6M → 118.8M (+5.2M)
  - Token output: 3.4M → 3.7M (+254K)
  - Token reasoning: 603,596 → 618,438 (+15K)
  - Token cache read: 2.4B → 2.5B (+141M)
  - Cost: $20.21 → $20.90 (+$0.69)
  - Daily activity: 2026-07-08 started with 6 sessions
  - LongCat-2.0: 4 → 16 sessions (+12, becoming secondary model)
  - New: TUI enhanced plugin layer (15 components)
  - New: AnimeHelix project (Blender + AI video creation)
  - New: CODE_AUDIT_AND_FIX_PLAN.md (comprehensive module audit)
  - New: DISTILL_REPORT.md (30-day tool usage analysis)

### Dream Memory Consolidation (2026-07-07, sixth pass)
- **Purpose**: Consolidate verified information from trajectory database
- **Source**: 167 sessions from opencode-local.db
- **Key Updates**:
  - Session count: 163 → 167 (+4)
  - dream: 36 → 37 sessions
  - distill: 36 → 37 sessions
  - alpha-analyst: 34 (unchanged)
  - explore: 26 → 27 sessions (+1, Helix TUI architecture)
  - build: 11 → 12 sessions (+1, TUI AI capability analysis)
  - ask: 10 (unchanged)
  - compose: 9 (unchanged)
  - Messages: 10,384 → 10,968 (+584)
  - Parts: 43,345 → 45,442 (+2,097)
  - Trace events: 7,389 → 7,977 (+588)
  - History FTS: 6,591 → 7,144 (+553)
  - Memory tables: Still empty (critical bug persists)
  - Token input: 84.6M → 113.6M (+29.0M)
  - Token output: 3.3M → 3.4M (+0.1M)
  - Token reasoning: 603,596 (new metric)
  - Token cache read: 2.4B (new metric)
  - Cost: $19.93 → $20.21 (+$0.28)
  - Daily activity: 2026-07-07 started with 7 sessions (was 3)
  - LongCat-2.0: 3 → 4 sessions (+1)

---

## Consolidation Metadata

**Last consolidated**: 2026-07-09 (dream pass, ninth pass)
**Source database**: `/Users/onetwo/.local/share/opencode/opencode-local.db`
**Total sessions analyzed**: 187
**Date range**: 2026-06-29 to 2026-07-09
**Verification method**: Read-only SQLite queries on trajectory database

### Verified Facts
- ✅ Session count: 187 (verified via `SELECT COUNT(*) FROM session`)
- ✅ Agent breakdown: dream(40), distill(40), explore(39), alpha-analyst(34), build(13), ask(11), compose(9), empty(1)
- ✅ Model usage: mimo-v2.5-pro(98), k2p7(26), LongCat-2.0(15), mimo-v2.5 variants(11), north-mini-code-free(2)
- ✅ Memory tables: 0 entries (verified via `SELECT COUNT(*) FROM memory_fts/memory_vec`)
- ✅ History FTS: 9,254 entries (verified)
- ✅ Trace events: 10,122 (verified)
- ✅ Git branch: `tui-dev` (verified via `git branch --show-current`)
- ✅ Token usage: 121.8M input, 3.8M output, $21.51 cost (verified via `SELECT SUM(...)`)
- ✅ Session V2 tables: session_context_epoch(6), session_input(6), session_message(103)
- ✅ Events: 175,005 (verified)
- ✅ CreatorHelix: 64 projects, 533 transition logs (verified)
- ✅ Enhanced TUI plugin layer: Directory removed (verified via `ls`)
- ✅ AnimeHelix project: Created with AGENTS.md, assets, docs, knowledge (verified via `ls`)
- ✅ Code audit: CODE_AUDIT_AND_FIX_PLAN.md created (verified via `head`)
- ✅ Video pipeline skill: Created (verified via `ls`)
- ✅ New skills: anime-creator-test, db-inspect, git-commit-push (verified via `ls`)

### Known Issues (Verified)
1. **Memory tables empty**: 40 dream + 40 distill sessions ran but memory_fts/memory_vec still have 0 entries
2. **Service tables empty**: inbox(0), workflow_run(0), team(0), team_member(0), spec_library(0)
3. **In-memory state loss**: Metrics, TokenTracker, Auto-Dream Timer use in-memory Ref
4. **Record-only pattern**: 15+ modules observe but don't influence behavior (confirmed by CODE_AUDIT_AND_FIX_PLAN.md)

### New Since Last Consolidation (2026-07-08 eighth → ninth pass)
- **Sessions**: +2 (185 → 187)
- **Messages**: +140 (12,542 → 12,682)
- **Parts**: +602 (51,543 → 52,145)
- **Trace events**: +176 (9,946 → 10,122)
- **History FTS**: +173 (9,081 → 9,254)
- **Token input**: +1.6M (120.1M → 121.8M)
- **Token output**: +39K (3.7M → 3.8M)
- **Token reasoning**: +4K (627,350 → 631,448)
- **Token cache read**: +17.5M (2.66B → 2.68B)
- **Cost**: +$0.41 ($21.10 → $21.51)
- **Events**: +2,080 (172,925 → 175,005)
- **Dream/Distill**: 40 each (was 39)
- **Todo**: 73 (was 71, +2: 3 completed, -1 pending)
- **CreatorHelix projects**: 64 (was 61, +3)
- **CreatorHelix transition logs**: 533 (was 519, +14)
- **New skills**: anime-creator-test, db-inspect, git-commit-push
- **Git status**: 25 uncommitted changes (was ~9)
- **Daily activity**: 2026-07-09 started with 2 sessions (Auto Dream + Auto Distill)

### Next Actions
1. Investigate memory table persistence bug (critical — 80 dream/distill sessions produced 0 memory entries)
2. Activate Inbox, Workflow, Team, Spec library services
3. Implement persistence for Metrics/TokenTracker
4. Fix Auto-Dream timer persistence
5. Convert record-only modules to closed-loop feedback (see CODE_AUDIT_AND_FIX_PLAN.md)
6. Develop CreatorHelix package further (assets, shots — 64 projects, 0 assets, 0 shots)
7. Develop AnimeHelix project (Blender + AI video creation)
8. Develop video-pipeline skill further (SeedDance/可灵 API integration)
9. Clean up removed TUI enhanced plugin layer references
10. Commit staged changes (25 uncommitted files)

---

## Distill Pass (2026-07-05)

### Source
- **Database**: `/Users/onetwo/.local/share/opencode/opencode.db` (cross-project) + `opencode-local.db`
- **Scope**: 72+ HelixAgent sessions from past month, 11,245 tool calls analyzed
- **Method**: Read-only SQLite queries on `session`, `message`, `part` tables

### Workflow Frequency Analysis (top patterns)

| Pattern | Tool Calls | Frequency | Coverage |
|---------|-----------|-----------|----------|
| typecheck variants | bash ~150 | Daily | typecheck-fix skill ✅ |
| test runs | bash ~80 | Daily | test-fix skill ✅ |
| build | bash ~50 | Daily | **build-verify skill** (new) |
| TUI smoke | bash ~50 | Weekly | tui-smoke skill ✅ |
| git push | bash ~30 | Daily | git-push cmd ✅ |
| layer dep diagnosis | bash ~20 | Weekly | **layer-diagnose cmd** (new) |
| git status/diff/log | bash ~40 | Daily | **rapid-status cmd** (new) |
| service wiring grep | grep ~20 | Weekly | service-wiring cmd ✅ |
| upstream diff | bash ~15 | Weekly | compare-upstream cmd ✅ |

### Hot Files (most read/edited across sessions)

| File | Reads | Edits | Purpose |
|------|-------|-------|---------|
| `session/prompt.ts` | 95 | 30 | Core agent loop |
| `tui/app.tsx` | 86+71 | 125+115 | TUI entry (HelixAgent + Helix) |
| `tool/registry.ts` | 75 | 56 | Tool definitions |
| `session/processor.ts` | 43 | — | Session execution |
| `effect/app-runtime.ts` | 26 | 40 | Service layer composition |

### Assets Created (distill pass)

| Asset | Type | Rationale |
|-------|------|-----------|
| `build-verify` | skill | Unified typecheck→build→test→smoke (most repeated multi-step workflow, 200+ calls) |
| `layer-diagnose` | command | Find unprovided Effect layers (repeated TUI debugging pattern, 20+ calls) |
| `rapid-status` | command | One-shot health scan (repeated "where am I" pattern, 40+ calls) |

### Distill Metadata
- **Pass date**: 2026-07-05
- **Sessions analyzed**: 72+ (HelixAgent + trae_projects)
- **Tool calls analyzed**: 11,245
- **New assets**: 1 skill + 2 commands
- **Existing assets confirmed**: 7 skills + 18 commands + 2 agents
