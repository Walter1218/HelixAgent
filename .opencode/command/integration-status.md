---
description: Check if a component/module is fully wired into the main pipeline (not just registered)
model: opencode/gpt-5.4
subtask: true
---

Check whether a component, module, or feature is fully integrated into the main execution pipeline — not just defined or registered, but actually invoked at runtime.

## Input

$ARGUMENTS — the component name, module path, or feature to check (e.g., "TokenTracker", "packages/opencode/src/token/tracker.ts", "shell safety", "dream")

## Process

### 1. Locate the component

- Find the module file(s) using glob and grep
- Read the main implementation file
- Identify the service interface / exported API

### 2. Check registration

- Is the service registered in a Layer? (search for `Layer.effect(Service,` or similar)
- Is it included in the app runtime layer composition? Check `packages/opencode/src/effect/app-runtime.ts` or equivalent
- Is it in the dependency chain that reaches the main entrypoint?

### 3. Check actual invocation

- Search for call sites: `grep` for the service name, method names, or `yield* ServiceName`
- Distinguish between:
  - **Registered but never called** — service exists in the layer graph but no code path invokes it
  - **Called in tests only** — has test coverage but no production call site
  - **Called from main pipeline** — actually wired into session processing, tool execution, or the agent loop
- Check if the invocation is in the hot path or only in a dead/disabled code path

### 4. Check completeness

- Are all interface methods implemented? (compare interface vs implementation)
- Are there stub methods that return `Effect.void` or hardcoded values?
- If the component has a `defaultLayer`, is it the one actually used in production?

### 5. Report

```
## Integration Status: [COMPONENT]

| Aspect | Status | Details |
|--------|--------|---------|
| Module exists | ✅/❌ | [path] |
| Service defined | ✅/❌ | [interface] |
| Layer registered | ✅/❌ | [where] |
| In app runtime | ✅/❌ | [where] |
| Called from main pipeline | ✅/❌/⚠️ | [call sites] |
| All methods implemented | ✅/❌ | [gaps] |
| Tests exist | ✅/❌ | [test files] |

### Verdict
[INTEGRATED / PARTIALLY INTEGRATED / NOT INTEGRATED / DEAD CODE]

### Next Steps (if not fully integrated)
- [ ] [CONCRETE ACTION]
```

## Rules

- "Registered" is not "integrated" — the service must be called from a live code path
- Check both the Effect layer graph AND the runtime call sites
- If the component is part of a larger system (e.g., "6 dead code modules"), check each one individually
- Do not modify files — this is read-only analysis
- Use `@explore` subagent pattern for parallel checks across multiple components
