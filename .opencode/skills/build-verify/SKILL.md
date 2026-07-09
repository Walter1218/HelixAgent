---
name: build-verify
description: Unified build verification pipeline — typecheck, build, test, and optional TUI smoke in one pass
---

# Build Verify

Single-pass verification pipeline that chains typecheck → build → test → optional TUI smoke.

## When To Use

- After any code change before committing
- Before pushing to remote
- After merging or rebasing
- When you need a full health check in one shot
- Before creating a PR

## Pattern

### 1. Typecheck

```bash
cd packages/opencode && bun typecheck 2>&1 | grep "error TS" | sort | uniq -c | sort -rn
```

If zero errors, proceed. Otherwise, stop and fix first (use `typecheck-fix` skill).

### 2. Build

```bash
cd packages/opencode && bun run script/build.ts --single 2>&1 | tail -10
```

Check exit code. If build fails, stop and fix.

### 3. Test (changed files only for speed)

```bash
cd packages/opencode && bun test --timeout 60000 2>&1 | tail -20
```

For targeted tests on changed files:
```bash
cd packages/opencode && bun test test/<changed-area>/ --timeout 60000 2>&1 | tail -20
```

### 4. TUI Smoke (optional, after TUI changes)

```bash
rm -rf .dev-home && mkdir -p .dev-home/data
MIMOCODE_HOME=$PWD/.dev-home timeout 10 bun run --conditions=browser src/index.ts 2>&1 | head -40
```

Check: Logo appears? No fatal errors? Clean exit on timeout?

### 5. Summary

Report pass/fail for each stage:
- ✅ Typecheck: N errors
- ✅ Build: success
- ✅ Tests: N passed, M failed
- ✅ TUI smoke: clean startup (if applicable)

## Quick Variant

For a fast check (typecheck + build only, skip tests):

```bash
cd packages/opencode && bun typecheck 2>&1 | tail -5 && bun run script/build.ts --single 2>&1 | tail -3
```

## Notes

- Always run from package directory, never repo root
- Use `typecheck-fix` skill if typecheck fails
- Use `test-fix` skill if tests fail
- Use `tui-smoke` skill for detailed TUI diagnosis
