# @helix-agent/opencode

Core application package for HelixAgent — the AI coding agent built on OpenCode architecture.

## Overview

This package contains the main application logic including:
- **Session management** — prompt handling, LLM streaming, tool execution
- **Provider system** — multi-provider LLM integration (MiMo, Anthropic, OpenAI, etc.)
- **Tool system** — built-in tools (read, write, edit, shell, glob, grep, etc.)
- **Actor/Task system** — concurrent sub-agent orchestration
- **Workflow engine** — JavaScript/JSON workflow script execution
- **Team collaboration** — database-persisted team management
- **AST analysis** — code dependency and blast radius analysis
- **Evolution flywheel** — DPO pair export for model improvement
- **Scheduler** — auto-dev scheduling with token budget management
- **OpenSpec** — structured requirements and verification system

## Development

```bash
# Install dependencies
bun install

# Start dev server (TUI)
bun dev

# Run typecheck
bun typecheck

# Run tests
bun test

# Run specific test suites
bun test test/session/        # Session tests
bun test test/tool/           # Tool tests
bun test test/server/         # Server API tests
```

## Architecture

```
src/
├── session/          # Session, Prompt, Processor, Status, Compaction
├── provider/         # LLM provider management
├── tool/             # Tool definitions and registry
├── actor/            # Actor concurrency system
├── task/             # Task tracking system
├── team/             # Team collaboration
├── workflow/         # Workflow engine
├── ast/              # AST analysis
├── evolution/        # Evolution flywheel
├── scheduler/        # Auto-dev scheduler
├── openspec/         # OpenSpec system
├── observability/    # AlignmentGuard, Trace
├── config/           # Configuration system
├── effect/           # Effect utilities, AppRuntime
├── server/           # HTTP API server
├── cli/              # CLI and TUI
└── ...
```

## Service Integration

The following services are integrated into the core execution path:

| Service | Integration Point | Description |
|---------|-------------------|-------------|
| **Workflow** | `session/prompt.ts` | Run lifecycle tracking (start/complete/cancel) |
| **Team** | `tool/actor.ts`, `tool/task.ts` | Member recording on actor/task creation |
| **AST** | `session/processor.ts`, `session/prompt.ts` | Changed-file tracking, blast radius analysis |
| **OpenSpecHook** | `session/processor.ts` | Compliance checks after tool calls |
| **Evolution** | `session/prompt.ts` | DPO pair export at loop end |
| **Scheduler** | `tool/todo.ts`, `session/prompt.ts` | Todo prioritization, token budget guard |

All optional services use `Effect.serviceOption` pattern — tests run without them, production enables via `AppRuntime`.

## Testing with Real LLM

```bash
# Set your API key (e.g., MiMo Token Plan)
export OPENCODE_API_KEY=<your-key>

# Run structured output integration test
bun test test/session/structured-output-integration.test.ts --timeout 120000
```

## License

MIT
