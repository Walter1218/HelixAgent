import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { GoalJudge } from "@/session/goal-judge"
import { CardinalPreflight } from "@/session/preflight"
import { OpenSpecPrecheck } from "@/openspec/precheck"
import { Goal } from "@/session/goal"
import { Cardinal } from "@/session/cardinal"
import { OpenSpec } from "@/openspec/spec"
import { Trace } from "@/trace/trace"
import fs from "fs"
import path from "path"

// Mock Trace layer
const mockTraceLayer = Layer.succeed(Trace.Service, Trace.Service.of({
  emit: () => Effect.void,
  getTraces: () => Effect.succeed([]),
  getTracesByTimeRange: () => Effect.succeed([]),
}))

// GoalJudge layer
const goalJudgeLayer = GoalJudge.layer.pipe(
  Layer.provide(Goal.defaultLayer),
  Layer.provide(mockTraceLayer),
)

// CardinalPreflight layer
const cardinalPreflightLayer = CardinalPreflight.layer.pipe(
  Layer.provide(Cardinal.defaultLayer),
  Layer.provide(mockTraceLayer),
)

// OpenSpecPrecheck layer
const openSpecPrecheckLayer = OpenSpecPrecheck.layer.pipe(
  Layer.provide(OpenSpec.defaultLayer),
  Layer.provide(mockTraceLayer),
)

describe("Phase 3: Pre-execution verification", () => {
  // ══════════════════════════════════════════
  // 3.1 Goal Judge 预检
  // ══════════════════════════════════════════

  it("3.1: Goal Judge returns ok for achievable goal", async () => {
    const program = Effect.gen(function* () {
      const judge = yield* GoalJudge.Service
      const verdict = yield* judge.preflight({
        sessionID: "test",
        condition: "Implement user login with JWT authentication",
      })
      expect(verdict.ok).toBe(true)
      expect(verdict.reason).toContain("achievable")
    })
    await Effect.runPromise(program.pipe(Effect.provide(goalJudgeLayer)))
  })

  it("3.1: Goal Judge returns ok when no goal set", async () => {
    const program = Effect.gen(function* () {
      const judge = yield* GoalJudge.Service
      const verdict = yield* judge.preflight({
        sessionID: "test",
        condition: "",
      })
      expect(verdict.ok).toBe(true)
      expect(verdict.reason).toContain("No goal")
    })
    await Effect.runPromise(program.pipe(Effect.provide(goalJudgeLayer)))
  })

  it("3.1: Goal Judge detects impossible goal", async () => {
    const program = Effect.gen(function* () {
      const judge = yield* GoalJudge.Service
      const verdict = yield* judge.preflight({
        sessionID: "test",
        condition: "This task is impossible to complete",
      })
      expect(verdict.ok).toBe(false)
      expect(verdict.impossible).toBe(true)
    })
    await Effect.runPromise(program.pipe(Effect.provide(goalJudgeLayer)))
  })

  // ══════════════════════════════════════════
  // 3.2 Cardinal 预检
  // ══════════════════════════════════════════

  it("3.2: Cardinal Preflight returns proceed for safe changes", async () => {
    const program = Effect.gen(function* () {
      const preflight = yield* CardinalPreflight.Service
      const report = yield* preflight.preflight({
        sessionID: "test",
        plannedFiles: ["src/utils.ts", "src/helpers.ts"],
      })
      expect(report.recommendation).toBe("proceed")
      expect(report.risks.length).toBe(0)
    })
    await Effect.runPromise(program.pipe(Effect.provide(cardinalPreflightLayer)))
  })

  it("3.2: Cardinal Preflight detects critical files", async () => {
    const program = Effect.gen(function* () {
      const preflight = yield* CardinalPreflight.Service
      const report = yield* preflight.preflight({
        sessionID: "test",
        plannedFiles: ["src/auth/login.ts", ".env"],
      })
      expect(report.risks.some(r => r.rule === "critical_file")).toBe(true)
      expect(report.recommendation).toBe("confirm")
    })
    await Effect.runPromise(program.pipe(Effect.provide(cardinalPreflightLayer)))
  })

  it("3.2: Cardinal Preflight detects excessive changes", async () => {
    const program = Effect.gen(function* () {
      const preflight = yield* CardinalPreflight.Service
      const report = yield* preflight.preflight({
        sessionID: "test",
        estimatedFileCount: 20,
      })
      expect(report.risks.some(r => r.rule === "excessive_changes")).toBe(true)
      expect(report.recommendation).toBe("confirm")
    })
    await Effect.runPromise(program.pipe(Effect.provide(cardinalPreflightLayer)))
  })

  it("3.2: Cardinal Preflight detects delete operations", async () => {
    const program = Effect.gen(function* () {
      const preflight = yield* CardinalPreflight.Service
      const report = yield* preflight.preflight({
        sessionID: "test",
        hasDeleteOperations: true,
      })
      expect(report.risks.some(r => r.rule === "delete_operations")).toBe(true)
      expect(report.recommendation).toBe("proceed") // warn level, not pause
    })
    await Effect.runPromise(program.pipe(Effect.provide(cardinalPreflightLayer)))
  })

  // ══════════════════════════════════════════
  // 3.3 OpenSpec Pre-check
  // ══════════════════════════════════════════

  it("3.3: OpenSpec Precheck finds no violations for unrelated files", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "precheck-"))
    const specDir = path.join(process.cwd(), "openspec", "specs")
    fs.mkdirSync(specDir, { recursive: true })

    const specFile = path.join(specDir, "test-precheck.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast src/auth.ts:export function login
`)

    const program = Effect.gen(function* () {
      const precheck = yield* OpenSpecPrecheck.Service
      const report = yield* precheck.precheck({
        sessionID: "test",
        plannedFiles: ["src/utils.ts", "src/helpers.ts"],
      })
      expect(report.hasViolations).toBe(false)
    })

    await Effect.runPromise(program.pipe(Effect.provide(openSpecPrecheckLayer)))
    fs.unlinkSync(specFile)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it("3.3: OpenSpec Precheck finds violations for matching files", async () => {
    const specDir = path.join(process.cwd(), "openspec", "specs")
    fs.mkdirSync(specDir, { recursive: true })

    const specFile = path.join(specDir, "test-precheck-2.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast src/auth.ts:export function login
`)

    const program = Effect.gen(function* () {
      const precheck = yield* OpenSpecPrecheck.Service
      const report = yield* precheck.precheck({
        sessionID: "test",
        plannedFiles: ["src/auth.ts"],
      })
      expect(report.hasViolations).toBe(true)
      expect(report.violations.length).toBeGreaterThan(0)
      expect(report.violations[0].plannedFile).toBe("src/auth.ts")
    })

    await Effect.runPromise(program.pipe(Effect.provide(openSpecPrecheckLayer)))
    fs.unlinkSync(specFile)
  })

  // ══════════════════════════════════════════
  // Negative tests
  // ══════════════════════════════════════════

  it("Negative: Cardinal Preflight returns proceed for no files", async () => {
    const program = Effect.gen(function* () {
      const preflight = yield* CardinalPreflight.Service
      const report = yield* preflight.preflight({
        sessionID: "test",
      })
      expect(report.recommendation).toBe("proceed")
      expect(report.risks.length).toBe(0)
    })
    await Effect.runPromise(program.pipe(Effect.provide(cardinalPreflightLayer)))
  })

  it("Negative: OpenSpec Precheck returns no violations when no specs exist", async () => {
    // Remove ALL spec files from the directory
    const specDir = path.join(process.cwd(), "openspec", "specs")
    try {
      const entries = fs.readdirSync(specDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(specDir, entry.name)
        if (entry.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true })
        } else {
          fs.unlinkSync(fullPath)
        }
      }
    } catch {}

    const program = Effect.gen(function* () {
      const precheck = yield* OpenSpecPrecheck.Service
      const report = yield* precheck.precheck({
        sessionID: "test",
        plannedFiles: ["src/auth.ts"],
      })
      // Should have no violations if no spec files exist
      expect(report.affectedSpecs.length).toBe(0)
    })

    await Effect.runPromise(program.pipe(Effect.provide(openSpecPrecheckLayer)))
  })
})
