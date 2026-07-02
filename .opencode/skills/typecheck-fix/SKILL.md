---
name: typecheck-fix
description: Automated typecheck-fix cycle — parse TypeScript errors, identify root causes, and fix them systematically
---

# Typecheck Fix

Automated cycle of running typecheck, parsing errors, and fixing them.

## When To Use

- After adding new services or modifying interfaces in Effect code
- After changing function signatures or adding/removing parameters
- After refactoring imports or module structure
- When `bun typecheck` reports TypeScript errors
- Before committing changes

## Pattern

### 1. Run typecheck and capture errors

```bash
cd packages/opencode && bun typecheck 2>&1 | grep "error TS" | sort | uniq -c | sort -rn
```

This gives a deduplicated count of each error. If the count is zero, done.

### 2. Categorize errors

Group errors by type:

| Error Code | Category | Typical Fix |
|-----------|----------|-------------|
| TS2345 | Argument type mismatch | Fix the argument or update the function signature |
| TS2339 | Property does not exist | Add the property, fix the import, or use optional chaining |
| TS2322 | Type assignment mismatch | Fix the type annotation or cast |
| TS2554 | Expected N arguments, got M | Add/remove arguments to match signature |
| TS7006 | Parameter implicitly has 'any' type | Add explicit type annotation |
| TS2307 | Cannot find module | Fix the import path or install the dependency |
| TS2724 | Module has no exported member | Fix the import name or add the export |
| TS18048 | Value is possibly 'undefined' | Add null check or use non-null assertion |
| TS2551 | Property does not exist (did you mean...) | Fix the typo |

### 3. Fix strategy per category

**Import errors (TS2307, TS2724)**:
- Read the target module to check what's actually exported
- Fix the import statement
- If the module was renamed/moved, update all import sites

**Type mismatch errors (TS2345, TS2322)**:
- Read both the caller and the callee
- Determine if the caller is wrong (passing wrong type) or the callee is wrong (expecting wrong type)
- Fix the side that's incorrect — do NOT add `as any` casts

**Missing arguments (TS2554)**:
- Read the function signature
- Add the missing arguments with appropriate defaults or values

**Undefined access (TS18048)**:
- Add a guard clause or use optional chaining (`?.`)
- In Effect code, use `Schema.decodeUnknownOption` or pattern matching

### 4. Iterative fix loop

```bash
# Run, fix, repeat until clean
cd packages/opencode && bun typecheck 2>&1 | grep "error TS" | wc -l
```

- Fix errors in dependency order (fix leaf modules before their consumers)
- After each batch of fixes, re-run typecheck to catch cascading changes
- Stop when error count reaches zero

### 5. Parallel subagent pattern

For large error counts (>10), split into parallel subagents by file:

- Each subagent reads one file with errors + its direct dependencies
- Each subagent produces a list of fixes (oldString → newString)
- Apply fixes sequentially to avoid merge conflicts

### 6. Post-fix verification

After typecheck passes:
```bash
cd packages/opencode && bun typecheck 2>&1 | tail -5
```

Confirm no new warnings were introduced. Then run affected tests:
```bash
cd packages/opencode && bun test test/session/ test/tool/ 2>&1 | tail -20
```

## Common Patterns in This Codebase

### Effect service interface mismatch
```typescript
// Interface says:
export interface Interface {
  readonly doThing: (input: string) => Effect.Effect<Output>
}
// Implementation accidentally has:
doThing(input: number) // wrong param type
```

Fix: Match the implementation to the interface.

### Missing Layer dependency
```typescript
// Service A needs Service B, but B isn't in AppLayer
export const layer = Layer.effect(ServiceA, Effect.gen(function* () {
  const b = yield* ServiceB // TS2345: ServiceB not provided
}))
```

Fix: Add ServiceB to `AppLayer` in `app-runtime.ts` or provide a mock layer.

### Schema field rename
```typescript
// Schema field was renamed but usage sites weren't updated
const result = yield* Schema.decodeUnknown(MySchema)(input)
result.oldFieldName // TS2339: does not exist
```

Fix: Update all usage sites to use the new field name.

## Rules

- Never use `as any`, `// @ts-ignore`, or `// @ts-expect-error` to silence errors
- Fix the root cause, not the symptom
- When an error is in generated code (`src/generated/`), regenerate instead of editing
- Prefer fixing the type signature over adding runtime checks when the type is known
- In Effect code, prefer `Schema.decodeUnknownOption` over manual `JSON.parse` + type guards
- After fixing, run the full typecheck, not just the files you changed — cascading errors are common
