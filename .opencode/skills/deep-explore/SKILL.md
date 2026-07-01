---
name: deep-explore
description: Systematically explore codebases using parallel subagents for deep structural analysis
---

# Deep Explore

Standard pattern for thorough codebase exploration using parallel subagents.

## When To Use

- Understanding an unfamiliar codebase or package
- Comparing two implementations of the same system
- Auditing completeness of a migration or refactor
- Mapping architecture before a large change

## Pattern

### 1. Scope the exploration

Before spawning subagents, define:
- **Target directories** — specific paths to explore
- **Questions to answer** — what do you need to know?
- **Comparison baseline** — if comparing, what's the reference?

### 2. Decompose into parallel tasks

Split the exploration into independent subagent tasks. Each subagent should:
- Read a bounded set of files (5–15 files per subagent)
- Answer specific questions about those files
- Return a structured report (not raw file dumps)

Good decomposition axes:
- By directory/package (e.g., "all files in `src/context/`")
- By concern (e.g., "plugin system", "state management", "rendering pipeline")
- By comparison side (e.g., "OpenCode version" vs "Helix version")

### 3. Subagent prompt template

```
Thoroughly explore [SCOPE]. I need:

1. [SPECIFIC_QUESTION_1]
2. [SPECIFIC_QUESTION_2]
3. [SPECIFIC_QUESTION_3]

For each file, report:
- File path and approximate line count
- Key imports and their packages
- Main exports/functions/components
- Implementation status (complete, partial, stub)
- Any TODO/FIXME/placeholder comments

Return findings concisely in structured format.
```

### 4. Synthesize results

After all subagents complete:
- Cross-reference findings
- Identify gaps, inconsistencies, or missing pieces
- Produce a summary table or structured report
- Highlight action items

## Rules

- Each subagent should read ≤ 15 files. If more files exist, split into multiple subagents.
- Always ask for line counts — they reveal implementation completeness.
- When comparing codebases, always fetch the reference version (e.g., from GitHub) in the same subagent that reads the local version.
- Prefer `webfetch` for remote GitHub files over asking users to provide them.
- Use `@explore` subagent mode for read-only exploration tasks.
- Use `@general` subagent mode when the task may need to run commands or modify files.

## Example: Comparing TUI implementations

```
Subagent 1: "Fetch OpenCode TUI app.tsx from GitHub (branch dev) and read Helix TUI app.tsx locally. Compare plugin slot usage, provider tree, and dialog registry."

Subagent 2: "Fetch OpenCode TUI sync.tsx from GitHub and read Helix sync.tsx locally. Compare store shape, session sync approach, and event handling."

Subagent 3: "Fetch OpenCode TUI theme/index.ts from GitHub and read Helix theme.tsx locally. Compare theme count, exports, and reactive system."
```

## Integration with `learn` command

After a deep exploration session, run `/learn` to extract non-obvious findings into AGENTS.md files at the appropriate directory level.
