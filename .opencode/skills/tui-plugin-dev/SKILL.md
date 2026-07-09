---
name: tui-plugin-dev
description: TUI plugin development lifecycle — plugin scope, reactive state, ErrorBoundary, tmux testing, SDK integration
---

# TUI Plugin Development

Development workflow for Helix TUI plugins — creating, testing, and debugging sidebar/panel plugins in the externalized TUI architecture.

## When To Use

- Creating a new sidebar or panel plugin for Helix TUI
- Debugging plugin rendering issues (blank panels, crashes, stale state)
- Integrating SDK data into plugin components
- Testing plugin changes without killing the main TUI
- Validating plugin configuration and schema

## Distinction from `tui-smoke`

| Concern | `tui-smoke` | `tui-plugin-dev` |
|---------|-------------|-------------------|
| Focus | Startup verification | Plugin development |
| When | After layer/runtime changes | When creating/debugging plugins |
| Scope | Does TUI boot? | Does my plugin render correctly? |
| Approach | One-shot launch test | Iterative tmux-based dev loop |

## Architecture Overview

```
Plugin Host (opencode)
├── runtime.ts — plugin lifecycle, scope creation
├── internal.ts — built-in plugin registration
└── adapters.tsx — SDK-to-plugin data bridge

TUI (packages/tui)
├── app.tsx — plugin host startup, slot registration
├── context/data.tsx — reactive session state
└── plugin/slots.ts — HostPluginApi interface

Plugin SDK (packages/plugin)
└── src/tui.ts — TuiState type, plugin contract
```

## Pattern

### 1. Plugin Scope Creation

Plugins run in a scope with access to reactive session state:

```typescript
// In runtime.ts — createPluginScope provides the execution context
const scope = createPluginScope({
  session: () => currentSession,
  sdk: sdkClient,
  // ...
})
```

Key: The `session()` accessor is reactive — it updates when the session changes. Use it in SolidJS signals for live data.

### 2. Reactive Session State

Access session data through the plugin API, not direct imports:

```typescript
// ✅ Good: reactive accessor
const session = api.state.session()
const messages = session.messages

// ❌ Bad: static import (won't update)
import { useSession } from "@/context/data"
```

The plugin API ensures proper cleanup and reactivity boundaries.

### 3. ErrorBoundary Wrapping

Always wrap plugin components in ErrorBoundary to prevent one plugin from crashing the entire TUI:

```tsx
import { ErrorBoundary } from "solid-js"

function MyPlugin() {
  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
      <PluginContent />
    </ErrorBoundary>
  )
}
```

**Why**: Plugin errors should be isolated. Without ErrorBoundary, a single plugin crash takes down the whole TUI.

### 4. Null Safety for Data Access

Plugin data can be undefined during initialization or transitions:

```tsx
// ✅ Good: guard against undefined
const text = () => part()?.text ?? ""

// ❌ Bad: direct access (crashes on undefined)
const text = () => part.text
```

Common undefined sources:
- `part.text` — message parts may not have text
- `session()` — may be null during session transitions
- `tool.state` — tool invocation state may be pending

### 5. tmux-Based Development Loop

Test plugin changes without killing the running TUI:

```bash
# Start a separate TUI instance in tmux
tmux new-session -d -s tui-dev 'cd packages/opencode && bun dev'

# Wait for startup
sleep 5

# Capture current state
tmux capture-pane -pt tui-dev

# Make changes, then restart
tmux kill-session -t tui-dev
tmux new-session -d -s tui-dev 'cd packages/opencode && bun dev'
```

**Why**: Using `bun dev` directly blocks the terminal. tmux allows iterative testing while keeping your development session active.

### 6. Configuration Validation

TUI configuration lives in `~/.config/opencode/config.json`. Validate against the schema:

```bash
# Check for invalid keys
bun dev 2>&1 | grep -i "unrecognized\|invalid\|config"
```

Common issues:
- `Unrecognized key: webSearch` — config key doesn't exist in current version
- Provider config mismatches — API key format or base URL errors

### 7. SDK Integration

When a plugin needs data not yet exposed by the SDK:

1. Check if the endpoint exists in `packages/protocol/src/groups/`
2. If not, add it there first
3. Run `bun run generate` from `packages/client`
4. Use the generated SDK method in the plugin

```bash
# After protocol changes
cd packages/client && bun run generate 2>&1 | tail -10

# Verify generated types
grep -n "newMethod" packages/sdk/js/src/v2/gen/sdk.gen.ts
```

**Key constraint**: Do not edit `src/generated` or `src/generated-effect` directly. Always regenerate.

### 8. Recovery Patterns

When plugin changes break the TUI:

```bash
# Revert specific files
git checkout -- packages/opencode/src/plugin/tui/enhanced/
git checkout -- packages/tui/src/

# Revert SDK changes
git checkout -- packages/client/src/generated-effect/ packages/client/src/generated/

# Clean up test artifacts
rm -rf packages/opencode/src/plugin/tui/enhanced/
```

## Plugin File Structure

```
packages/opencode/src/plugin/tui/
├── runtime.ts          # Plugin lifecycle, scope creation
├── internal.ts         # Built-in plugin registration
└── adapters.tsx        # SDK-to-plugin data bridge

packages/tui/src/
├── app.tsx             # Plugin host startup
├── context/data.tsx    # Reactive session state
└── plugin/
    ├── slots.ts        # HostPluginApi interface
    └── adapters.tsx    # Plugin data adapters
```

## Common Pitfalls

1. **Direct session imports** — Use `api.state.session()` accessor, not `useSession()` hook
2. **Missing ErrorBoundary** — Every plugin component needs error isolation
3. **Unguarded `.text` access** — Always use `?.text ?? ""` for message parts
4. **Blocking terminal with `bun dev`** — Use tmux for iterative testing
5. **Editing generated code** — Always `bun run generate`, never hand-edit `src/generated/`
6. **Config key typos** — Validate against schema before testing

## Integration

- Use `tui-smoke` skill for startup-level diagnosis (black screen, missing services)
- Use `typecheck-fix` skill after plugin type changes
- Use `build-verify` skill before committing plugin changes
- Run `/learn` after debugging sessions to capture non-obvious findings
