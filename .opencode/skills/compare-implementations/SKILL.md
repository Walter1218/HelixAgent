---
name: compare-implementations
description: Structured side-by-side comparison of two codebase implementations, versions, or architectures
---

# Compare Implementations

Structured comparison of two implementations, codebases, or architectural approaches.

## When To Use

- Comparing a fork/variant against its upstream (e.g., Helix vs OpenCode)
- Evaluating two approaches to the same problem
- Assessing migration completeness (old vs new implementation)
- Reviewing a refactor by comparing before and after

## Pattern

### 1. Define comparison axes

Before spawning subagents, define:
- **Reference** — the baseline implementation (upstream, original, or "known good")
- **Target** — the implementation being evaluated (fork, new version, alternative)
- **Axes** — what dimensions to compare (architecture, APIs, completeness, patterns)

### 2. Decompose by component

Split into parallel subagent tasks, one per component or concern:

```
Subagent 1: Compare [COMPONENT_A] in reference vs target
Subagent 2: Compare [COMPONENT_B] in reference vs target
Subagent 3: Compare [COMPONENT_C] in reference vs target
```

Each subagent should:
- Read the same component from both implementations
- Compare structure, exports, interfaces, and key logic
- Note additions, removals, and modifications
- Assess completeness and quality of each side

### 3. Comparison prompt template

```
Compare [COMPONENT] between reference and target implementations.

**Reference**: [PATH_OR_URL]
**Target**: [PATH_OR_URL]

For each, analyze:
1. File structure and approximate line count
2. Key exports, interfaces, and types
3. Core logic and algorithms
4. Dependencies and imports
5. Implementation completeness (complete/partial/stub)
6. Notable patterns or anti-patterns

Then produce a diff summary:
- What's identical or equivalent
- What's added in target (not in reference)
- What's removed in target (was in reference)
- What's modified (same concept, different implementation)
- What's missing (referenced but not implemented)
```

### 4. Synthesize comparison report

After all subagents complete:
- Cross-reference component-level findings
- Identify systemic differences (not just per-component)
- Assess overall divergence level: minimal / moderate / major / fork
- Highlight actionable items: what to port, what to remove, what to document

## Report Format

```markdown
## Comparison Report: [TARGET] vs [REFERENCE]

### Summary
- Divergence level: [MINIMAL|MODERATE|MAJOR|FORK]
- Components compared: N
- Identical: N | Added: N | Removed: N | Modified: N | Missing: N

### Component: [NAME]
| Aspect | Reference | Target | Status |
|--------|-----------|--------|--------|
| Line count | 450 | 380 | -70 lines |
| Exports | 12 | 10 | 2 missing |
| Key algorithm | X | Y | Modified |
| Completeness | Complete | Partial | Missing: Z |

### Systemic Differences
1. [DIFFERENCE_1] — affects [COMPONENTS]
2. [DIFFERENCE_2] — affects [COMPONENTS]

### Action Items
- [ ] Port [FEATURE] from reference to target
- [ ] Remove dead code in target: [FILE:LINE]
- [ ] Document intentional divergence: [WHAT]
```

## Rules

- Always fetch/read the reference implementation in the same subagent that reads the target
- For remote references (GitHub), use `webfetch` to get the raw file content
- Compare at the structural level first, then dive into details
- Don't just diff — assess whether differences are intentional, improvements, or regressions
- Provide file:line references for all claims
- When comparing codebases with different languages or frameworks, map concepts rather than syntax
- Use `@explore` subagent for read-only comparison tasks

## Integration

- After comparison, run `verify-implementation` to check if divergence is documented
- Use findings to update migration plans or architecture docs
