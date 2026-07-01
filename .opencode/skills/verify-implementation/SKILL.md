---
name: verify-implementation
description: Systematically verify documentation claims against actual code implementation, service wiring, and interface definitions
---

# Verify Implementation

Systematic verification of documentation, service wiring, and interface definitions against actual code.

## When To Use

- Checking if a development plan or status document matches reality
- Verifying which services are actually wired into the main pipeline
- Auditing interface completeness for externalization (TUI, API, etc.)
- Validating file paths, dependencies, and schema definitions in docs
- Post-migration or post-refactor consistency checks

## Pattern

### 1. Gather verification targets

Before starting, identify:
- **Documents to verify** — status docs, development plans, architecture docs
- **Code entry points** — main pipeline files (e.g., `processor.ts`, `prompt.ts`, `app-runtime.ts`)
- **Schema definitions** — config schemas, database schemas, API schemas

### 2. Decompose into parallel verification tasks

Split into independent subagent tasks. Each subagent should verify one category:

**Category A: Service Wiring**
- Read the main pipeline file (e.g., `processor.ts`)
- List every service that is `yield*` or called
- Compare against the document's claim of "integrated services"
- Report: service name, file:line, actually called (yes/no), document claims (yes/no)

**Category B: File Path Verification**
- Extract all file paths mentioned in the document
- Use `glob` to check each path exists
- Report: path, exists (yes/no), document claims it exists (yes/no)

**Category C: Interface Completeness**
- Read the service's interface definition
- Check if each method has a real implementation (not just `Effect.void` or stub)
- Check if the interface exposes what consumers need (TUI, API, etc.)
- Report: method name, has implementation (yes/no), is stub (yes/no)

**Category D: Schema/Config Verification**
- Read config schema definitions
- Check if document-mentioned fields exist in the schema
- Check if database tables match documented migrations
- Report: field/table name, exists in schema (yes/no), matches doc (yes/no)

### 3. Verification prompt template

```
Verify [CATEGORY] against actual code.

**Document claims:**
[LIST_OF_CLAIMS]

**Code to check:**
[FILE_PATHS]

For each claim, report:
- Claim: what the document says
- Reality: what the code actually shows
- Status: MATCH / MISMATCH / PARTIAL
- Evidence: file:line reference
- Fix: what needs to change (doc or code)
```

### 4. Synthesize verification report

After all subagents complete:
- Produce a summary table with columns: Check Item | Document Says | Code Shows | Status
- Group by status: PASS, FAIL, PARTIAL, NOT_FOUND
- For each FAIL/PARTIAL, provide specific fix recommendation
- Highlight critical mismatches that block downstream work

## Report Format

```markdown
## Verification Report: [DOCUMENT_NAME]

### Summary
- ✅ PASS: N items
- ❌ FAIL: N items
- ⚠️ PARTIAL: N items
- 🔍 NOT_FOUND: N items

### Service Wiring Verification
| Service | Document Claims | Actually Called | Status | Evidence |
|---------|----------------|----------------|--------|----------|
| Trace | Integrated | Yes | ✅ PASS | processor.ts:145 |
| Cardinal | Integrated | Partial | ⚠️ PARTIAL | processor.ts:384 (incomplete context) |

### File Path Verification
| Path | Document Claims | Exists | Status |
|------|----------------|--------|--------|
| src/session/trace.ts | Yes | Yes | ✅ PASS |
| src/session/history.ts | Yes | No | ❌ FAIL |

### Interface Completeness
| Method | Has Implementation | Is Stub | Status |
|--------|-------------------|---------|--------|
| getUsage() | Yes | No | ✅ PASS |
| getCurrentMode() | No | Yes | ❌ FAIL |
```

## Rules

- Always read actual code, never trust memory or assumptions
- Use `grep` for finding service calls (`yield*`, `.pipe(`) in pipeline files
- Use `glob` for verifying file paths exist
- Provide exact file:line references as evidence
- When a claim is PARTIAL, explain exactly what's missing
- Prefer reading the full pipeline file over searching for individual patterns
- Check both the service registration (in `app-runtime.ts` or layer) AND the actual call site
- A service being imported but never called is NOT integrated

## Integration

- After verification, update the document to match reality, or create tasks to fix the code
- Run `/review` after making fixes to verify the changes
