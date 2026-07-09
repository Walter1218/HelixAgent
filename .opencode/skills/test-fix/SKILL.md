---
name: test-fix
description: Automated test-failure fix cycle — run tests, parse failures, identify root causes, and fix them systematically
---

# Test Fix

Automated cycle of running tests, parsing failures, and fixing them.

## When To Use

- After modifying service implementations or interfaces
- After changing Effect layer composition or dependencies
- After refactoring imports or module structure
- When `bun test` reports failures
- Before committing changes

## Pattern

### 1. Run tests and capture failures

```bash
cd packages/opencode && bun test --timeout 60000 2>&1 | tail -50
```

For specific test files:
```bash
cd packages/opencode && bun test test/session/prompt.test.ts --timeout 60000 2>&1 | tail -50
```

For specific test names:
```bash
cd packages/opencode && bun test test/session/prompt.test.ts --timeout 60000 -t "test name" 2>&1 | tail -50
```

### 2. Categorize failures

| Failure Type | Pattern | Typical Fix |
|-------------|---------|-------------|
| Import error | `Cannot find module` | Fix import path or install dependency |
| Type error | `TypeError: ...` | Fix type mismatch or add null check |
| Assertion error | `Expected: ... Received: ...` | Fix logic or update expected value |
| Timeout | `Timeout of 60000ms exceeded` | Check for hanging promises or increase timeout |
| Layer error | `Service not found` | Add service to test layer composition |
| Mock error | `Cannot read properties of undefined` | Fix mock setup or add missing mock |

### 3. Fix strategy per category

**Import/Module errors**:
- Read the target module to verify exports
- Fix the import statement
- Check if the module was renamed/moved

**Layer/Service errors**:
- Read the test file to see how layers are composed
- Read `app-runtime.ts` to check the production layer
- Add missing services to the test layer

**Assertion errors**:
- Read the test expectation
- Read the actual implementation
- Determine if the test or implementation is correct
- Fix the incorrect side

**Timeout errors**:
- Check for unresolved promises
- Check for missing `await` or `Effect.runPromise`
- Check for infinite loops in test setup

### 4. Iterative fix loop

```bash
# Run, fix, repeat until clean
cd packages/opencode && bun test test/session/ --timeout 60000 2>&1 | grep -E "pass|fail"
```

- Fix failures in dependency order (fix leaf modules before their consumers)
- After each batch of fixes, re-run tests to catch cascading failures
- Stop when all tests pass

### 5. Parallel subagent pattern

For large failure counts (>5), split into parallel subagents by test file:

- Each subagent reads one failing test file + its direct dependencies
- Each subagent produces a list of fixes (oldString → newString)
- Apply fixes sequentially to avoid merge conflicts

### 6. Post-fix verification

After all tests pass:
```bash
cd packages/opencode && bun test --timeout 60000 2>&1 | tail -10
```

Confirm no new failures were introduced. Then run typecheck:
```bash
cd packages/opencode && bun typecheck 2>&1 | tail -5
```

## Common Patterns in This Codebase

### Missing service in test layer
```typescript
// Test fails with: Service not found
// Fix: Add the service to the test layer
const testLayer = Layer.mergeAll(
  ServiceA.defaultLayer,
  ServiceB.defaultLayer,
  // Add missing service here
)
```

### Wrong mock setup
```typescript
// Test fails with: Cannot read properties of undefined
// Fix: Add proper mock setup
const mockService = {
  method: vi.fn().mockResolvedValue(expectedValue),
}
```

### Stale assertion after refactor
```typescript
// Test fails with: Expected "old_value", Received "new_value"
// Fix: Update the assertion to match new behavior
expect(result).toBe("new_value")
```

## Rules

- Never use `skip` or `todo` to silence failures — fix the root cause
- When a test fails due to a bug in the implementation, fix the implementation
- When a test fails because the test is wrong (e.g., after a refactor), update the test
- After fixing, run the full test suite, not just the files you changed — cascading failures are common
- If a test is flaky (passes sometimes, fails sometimes), investigate the root cause — don't just re-run
- Prefer running tests from the package directory, not the repo root
