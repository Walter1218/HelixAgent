---
description: Systematic post-work review — find gaps, contradictions, and missing pieces (查漏补缺)
model: opencode/gpt-5.4
subtask: true
---

Perform a systematic gap analysis on recently completed work. This is the "double check" / "查漏补缺" workflow.

## Input

$ARGUMENTS — optional focus area (e.g., "dead code integration", "migration plan", a file path, or a feature name). If empty, review the current session's work.

## Process

### 1. Identify what was changed

- Run `git diff --stat` and `git diff --cached --stat` to see modified files
- Read the relevant documentation files (AGENTS.md, MEMORY.md, DEAD_*.md, TRANSFORM_PLAN.md, specs/) for the area being reviewed
- If a specific feature or plan was discussed, find its tracking document

### 2. Check for contradictions

- Compare the implementation against its documentation — do they agree?
- Check if referenced files/modules actually exist
- Check if documented APIs match actual code signatures
- Verify that claimed "completed" items are actually wired in, not just defined

### 3. Check for gaps

- Are there TODO/FIXME/placeholder comments in changed files?
- Are there stub functions or empty implementations?
- Are error paths handled or just logged?
- Are there imports or registrations that exist but are never called from the main pipeline?
- Are there test files that reference changed modules but weren't updated?

### 4. Check for stale content

- Does any documentation reference files that no longer exist?
- Are there outdated descriptions that contradict the current code?
- Are there plans or phases marked "pending" that were actually completed (or vice versa)?

### 5. Produce a structured report

```
## Gap Analysis Report

### Contradictions Found
1. [DESCRIPTION] — [DOC vs CODE discrepancy]

### Missing Pieces
1. [DESCRIPTION] — [WHAT'S NEEDED]

### Stale/Outdated Content
1. [DESCRIPTION] — [FILE:LINE]

### Action Items
- [ ] [CONCRETE NEXT STEP]
```

## Rules

- Be specific — cite file paths and line numbers
- Distinguish between "registered but not invoked" and "invoked but not tested"
- If the area has a tracking document (e.g., DEAD_CODE_*.md), cross-check every item against actual code
- Do not modify files during analysis — report only
- Keep the report concise: aim for the shortest list that catches real issues
