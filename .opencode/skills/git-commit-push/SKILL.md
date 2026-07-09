---
name: git-commit-push
description: Standardized git workflow — stage, commit with conventional messages, and push to remote with verification
---

# Git Commit & Push

Standardized workflow for staging, committing, and pushing changes.

## When To Use

- After completing a feature or fix
- After typecheck and tests pass
- Before creating a PR
- When ready to share changes with team

## Pattern

### 1. Pre-commit verification

Always run build-verify first:

```bash
cd packages/opencode && bun typecheck 2>&1 | grep "error TS" | wc -l
```

If errors exist, fix them first (use typecheck-fix skill).

### 2. Check status

```bash
git status --short
git diff --stat
```

Review what changed. If unstaged changes exist, stage them.

### 3. Stage changes

```bash
# Stage all changes
git add -A

# Or stage specific files
git add packages/opencode/src/session/prompt.ts
```

### 4. Commit with conventional message

Use conventional commit format: `type(scope): summary`

```bash
# Feature
git commit -m "feat(session): add structured output support"

# Fix
git commit -m "fix(tui): resolve black screen on startup"

# Refactor
git commit -m "refactor(core): simplify memory service layer"

# Docs
git commit -m "docs: update AGENTS.md with new patterns"

# Chore
git commit -m "chore(sdk): regenerate types"
```

Valid types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

### 5. Push to remote

```bash
# Push to current branch
git push

# Push to specific branch
git push origin tui-dev

# Push with no-verify (skip hooks, use sparingly)
git push origin tui-dev --no-verify
```

### 6. Verify push succeeded

```bash
git log --oneline -3
git status
```

## Common Patterns

### HelixAgent project
```bash
cd /Users/onetwo/Documents/trae_projects/HelixAgent
git add -A && git status
git commit -m "feat(core): description"
git push origin tui-dev --no-verify
```

### Anime creator project
```bash
cd /Users/onetwo/Documents/trae_projects/anime-creator
git add -A && git status
git commit -m "feat(pipeline): description"
git push
```

## Anti-patterns

- Don't commit without running typecheck first
- Don't use `--no-verify` unless hooks are broken
- Don't commit secrets or API keys
- Don't force-push to shared branches
