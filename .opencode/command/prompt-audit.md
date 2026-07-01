---
description: Trace and audit the prompt assembly pipeline for cache optimization and correctness
model: opencode/gpt-5.4
subtask: true
---

Audit the prompt assembly pipeline in HelixAgent to verify correctness and identify KV cache optimization opportunities.

## Input

$ARGUMENTS — optional focus area (e.g., "cache hit rate", "system prompt order", "context sources")

## Audit Checklist

### 1. System Prompt Assembly
Read `packages/opencode/src/session/prompt.ts` and `packages/opencode/src/session/system.ts`:
- What components contribute to the system prompt? (env, instructions, mcpInstructions, skills)
- In what order are they assembled?
- Which parts are static (same every turn) vs dynamic (change per turn)?
- Approximate token count per component

### 2. Instruction Loading
Read `packages/opencode/src/session/instruction.ts`:
- How are AGENTS.md/CLAUDE.md files discovered and loaded?
- What's the precedence order (global → project → nested)?
- Are instructions cached or re-read every turn?

### 3. Context Source Registry
Read `packages/opencode/src/session/system-context/`:
- What context sources are registered?
- Which are baseline (epoch-start) vs dynamic (per-turn)?
- How are mid-conversation system messages generated?

### 4. Message Projection
Read `packages/opencode/src/session/message-v2.ts`:
- How are messages projected for the model?
- How does compaction affect message history?
- Are there any message filters that could affect cache keys?

### 5. KV Cache Impact
Analyze the assembled prompt for cache efficiency:
- Is the system prompt prefix stable across turns?
- Are dynamic elements (date, file list, context usage) placed at the end?
- Would reordering components improve cache hit rate?
- Are there any per-turn mutations in the static prefix?

### 6. Compliance Check
Read `specs/prompt-context-assembly.md` if it exists:
- Does the current implementation follow the spec?
- Are there deviations from the documented order?
- Are per-turn dynamic items correctly placed in user messages (not system prompt)?

## Output

Produce a structured report:

```
## Prompt Assembly Audit

### System Prompt Components (in order)
| Component | Type | Approx Tokens | Cache Impact |
|-----------|------|---------------|--------------|

### Issues Found
1. [DESCRIPTION] — [FILE:LINE]

### Optimization Opportunities
1. [DESCRIPTION] — [EXPECTED IMPACT]

### Compliance
- [PASS/FAIL] — [CHECK NAME]
```

## Rules

- Read-only analysis. Do not modify any files.
- Report exact line numbers for any issues found.
- Compare against `specs/prompt-context-assembly.md` if it exists.
- Consider the V2 session core rules from AGENTS.md when evaluating correctness.
