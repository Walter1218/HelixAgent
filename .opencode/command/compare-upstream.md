---
description: Compare local code against upstream OpenCode to find divergences and migration gaps
model: opencode/gpt-5.4
subtask: true
---

Compare the local HelixAgent code against upstream OpenCode to identify divergences.

## Input

$ARGUMENTS — a directory path or file pattern to compare (e.g., `packages/tui/src/`, `packages/opencode/src/session/`)

## Process

1. **Identify upstream source**: Use `gh api` or `webfetch` to fetch the corresponding file(s) from `anomalyco/opencode` branch `dev` on GitHub.

2. **Read local version**: Read the corresponding local file(s) in the HelixAgent project.

3. **For each file pair, report**:
   - **Line count delta** (local vs upstream)
   - **Import differences** — package name changes (`@opencode-ai/*` → `@mimo-ai/*`), new/removed imports
   - **Structural differences** — added/removed components, functions, types
   - **Behavioral differences** — different logic, different defaults, different error handling
   - **Helix-specific additions** — what local code adds that upstream doesn't have
   - **Missing upstream features** — what upstream has that local doesn't

4. **Produce a summary table**:

```
| File | Upstream Lines | Local Lines | Delta | Key Differences |
|------|---------------|-------------|-------|-----------------|
```

5. **List migration risks**: What would break if we rebased onto latest upstream?

## Rules

- Fetch upstream files via `webfetch` from raw.githubusercontent.com
- Always compare file-by-file, not just directory structure
- Note SDK package name differences (`@opencode-ai/sdk/v2` vs `@mimo-ai/sdk/v2`)
- Note schema library differences (Effect Schema vs Zod)
- Highlight any upstream API changes that would require local code adaptation
- Do NOT modify any files — this is a read-only analysis
