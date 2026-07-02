---
name: tui-smoke
description: Systematic TUI startup verification — detect black screens, provider failures, and rendering issues
---

# TUI Smoke Test

Systematic diagnosis of TUI startup failures, black screens, and rendering issues.

## When To Use

- TUI shows black screen on startup
- Ctrl+C doesn't exit the TUI
- AI service fails to initialize in TUI
- Provider or model resolution errors at startup
- After changing `app-runtime.ts`, `app.tsx`, or layer composition
- Before merging changes to TUI entry points

## Diagnostic Steps

### 1. Clean launch test

```bash
rm -rf .dev-home && mkdir -p .dev-home/data
MIMOCODE_HOME=$PWD/.dev-home timeout 15 bun run --conditions=browser src/index.ts 2>&1 | head -80
```

Check: Does the process start? Does it print a logo? Does it exit cleanly on timeout?

### 2. Layer resolution check

Read `packages/opencode/src/effect/app-runtime.ts`:
- Verify all services in `AppLayer` have their dependencies satisfied
- Check for circular imports or missing `Layer.succeed` stubs
- Look for `Layer.effect(Service, Effect.gen(...))` that reference services not yet in the merge

### 3. Provider bootstrap check

Read `packages/opencode/src/cli/cmd/tui.ts` and `packages/opencode/src/provider/provider.ts`:
- Verify provider config is loaded before model resolution
- Check that `MIMOCODE_HOME` or equivalent env var is set
- Look for `Effect.gen` blocks that `yield*` a provider before it's available

### 4. Import graph verification

```bash
cd packages/tui && bun --conditions=browser --eval 'await import("./src/app.tsx"); console.log("OK");' 2>&1
```

If this fails, the import graph has a broken dependency. Parse the error for the missing module.

### 5. Error pattern matching

Common failure patterns and their root causes:

| Pattern | Root Cause |
|---------|-----------|
| `Service not found` | Missing layer registration in `AppLayer` |
| `Cannot find module` | Missing dependency in `package.json` or broken import |
| `TypeError: undefined is not a function` | Service interface mismatch — method exists in interface but not implementation |
| Black screen (no output) | Layer provisioning hangs on a dependency that never resolves |
| Logo renders but no prompt | Provider/model layer fails after UI bootstrap |
| Ctrl+C unresponsive | Signal handler not registered or fiber not interruptible |

### 6. Subagent decomposition

For complex failures, split into parallel subagents:

- **Subagent A**: Read `app-runtime.ts`, list all services, check each has its deps
- **Subagent B**: Read the TUI entry point (`app.tsx` or `index.ts`), trace the startup sequence
- **Subagent C**: Read provider config + model resolution, check for env var or config issues
- **Subagent D**: Check test infrastructure — run `bun test test/tui/` and analyze failures

## Report Format

```markdown
## TUI Smoke Report

### Launch Test
- Process starts: ✅/❌
- Logo renders: ✅/❌
- Prompt appears: ✅/❌
- Ctrl+C works: ✅/❌

### Layer Health
| Service | Registered | Dependencies Met | Status |
|---------|-----------|-----------------|--------|
| ... | ✅/❌ | ✅/❌ | OK/BROKEN |

### Issues Found
1. [DESCRIPTION] — [FILE:LINE] — [ROOT CAUSE]

### Fix Recommendations
1. [CONCRETE FIX]
```

## Rules

- Always test with a clean `.dev-home` to avoid cached state masking issues
- Use `timeout` to prevent hanging processes
- Capture stderr separately — TUI rendering goes to stdout, errors to stderr
- When the issue is a missing service dependency, check both the direct dependency AND the transitive chain
- Do not modify files during diagnosis unless the fix is trivially obvious
- After fixing, re-run the smoke test to confirm
