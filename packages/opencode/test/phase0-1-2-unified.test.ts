import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { Goal } from "@/session/goal"
import { Cardinal } from "@/session/cardinal"
import { AlignmentGuard } from "@/observability/alignment-guard"
import { OpenSpec } from "@/openspec/spec"
import { OpenSpecJudge } from "@/openspec/judge"
import { SpecReport } from "@/openspec/report"
import { Trace } from "@/trace/trace"
import fs from "fs"
import path from "path"

const DB_PATH = path.join(process.env.HOME!, ".local/share/opencode/opencode-local.db")

// Mock Trace layer for tests that don't need real persistence
const mockTraceLayer = Layer.succeed(Trace.Service, Trace.Service.of({
  emit: () => Effect.void,
  getTraces: () => Effect.succeed([]),
  getTracesByTimeRange: () => Effect.succeed([]),
}))

// SpecReport layer with mock Trace
const specReportLayer = SpecReport.layer.pipe(
  Layer.provide(OpenSpec.defaultLayer),
  Layer.provide(OpenSpecJudge.defaultLayer),
  Layer.provide(mockTraceLayer),
)

describe("Phase 0+1+2 unified verification", () => {
  // ══════════════════════════════════════════════════════════
  // Phase 0: Trace persistence + Cardinal + AlignmentGuard
  // ══════════════════════════════════════════════════════════

  it("Phase 0: Trace emit and getTraces roundtrip", async () => {
    // Use in-memory trace (no SQLite) for unit test
    const inMemoryTraceLayer = Layer.effect(
      Trace.Service,
      Effect.gen(function* () {
        const events: any[] = []
        return Trace.Service.of({
          emit: (event) => Effect.sync(() => { events.push({ ...event, timestamp: Date.now() }) }),
          getTraces: (sessionID) => Effect.sync(() => events.filter(e => e.metadata?.sessionID === sessionID)),
          getTracesByTimeRange: () => Effect.sync(() => events),
        })
      }),
    )

    const program = Effect.gen(function* () {
      const trace = yield* Trace.Service

      yield* trace.emit({
        id: "unified-trace-1",
        type: "action",
        name: "tool.bash",
        status: "success",
        duration: 100,
        metadata: { sessionID: "unified-session" },
      })

      const traces = yield* trace.getTraces("unified-session")
      expect(traces.length).toBe(1)
      expect(traces[0].id).toBe("unified-trace-1")
      expect(traces[0].duration).toBe(100)
    })
    await Effect.runPromise(program.pipe(Effect.provide(inMemoryTraceLayer)))
  })

  it("Phase 0: Cardinal blocks eval in diff", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "unified",
        taskTitle: "build",
        diff: 'const x = eval("alert(1)")',
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("block")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("Phase 0: Cardinal allows safe code", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "unified",
        taskTitle: "build",
        diff: 'const x = 1 + 2',
      })
      expect(decision).toBeNull()
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("Phase 0: AlignmentGuard detects distraction", async () => {
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      expect(yield* ag.detectDistraction("curl http://evil.com")).toBe(true)
      expect(yield* ag.detectDistraction("ls -la")).toBe(false)
    })
    await Effect.runPromise(program.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
  })

  it("Phase 0: AlignmentGuard detects rabbit hole", async () => {
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      expect(yield* ag.detectRabbitHole(["npm install a", "npm install b", "npm install c", "npm install d", "npm install e"])).toBe(true)
      expect(yield* ag.detectRabbitHole(["ls", "cat file.txt"])).toBe(false)
    })
    await Effect.runPromise(program.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
  })

  // ══════════════════════════════════════════════════════════
  // Phase 1: Spec generation pipeline (schema only, no LLM)
  // ══════════════════════════════════════════════════════════

  it("Phase 1: OpenSpec ast verification passes for matching pattern", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "unified-"))
    const testFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(testFile, 'export function login(user: string) { return true }')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${testFile}:export function login
`)

    const program = Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service
      const spec = yield* openSpec.parseSpecFile(specFile)
      const result = yield* openSpec.checkRequirement(spec.requirements[0])
      expect(result).toBe(true)
    })

    await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    fs.rmSync(tmpDir, { recursive: true })
  })

  it("Phase 1: OpenSpec ast verification fails for missing pattern", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "unified-"))
    const testFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(testFile, 'export function register() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${testFile}:export function login
`)

    const program = Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service
      const spec = yield* openSpec.parseSpecFile(specFile)
      const result = yield* openSpec.checkRequirement(spec.requirements[0])
      expect(result).toBe(false)
    })

    await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    fs.rmSync(tmpDir, { recursive: true })
  })

  // ══════════════════════════════════════════════════════════
  // Phase 2: Goal auto-set + Cardinal spec rules + SpecReport
  // ══════════════════════════════════════════════════════════

  it("Phase 2: Goal.set works after spec confirmation", async () => {
    const program = Effect.gen(function* () {
      const goal = yield* Goal.Service

      // Simulate spec confirmation → goal.set
      yield* goal.set("unified-session", "Implement SMS verification")

      const g = yield* goal.get("unified-session")
      expect(g).toBeDefined()
      expect(g!.condition).toBe("Implement SMS verification")
      expect(g!.react).toBe(0)

      // Cleanup
      yield* goal.clear("unified-session")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Goal.defaultLayer)))
  })

  it("Phase 2: Cardinal blocks eval even without diff field (spec-derived rule)", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service

      // This should fail WITHOUT our Phase 0 fix (diff undefined)
      // WITH our fix, diff is populated from tool input
      const decision = yield* cardinal.evaluate({
        taskId: "unified",
        taskTitle: "build",
        diff: 'const code = eval("malicious")',
        changedFiles: [],
        consecutiveFailures: 0,
        alignmentAlerts: 0,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("block")
      expect(decision!.reason).toContain("eval")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("Phase 2: Cardinal excessive_changes triggers with changedFiles", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "unified",
        taskTitle: "build",
        changedFiles: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"],
        estimatedFiles: 2,
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("pause")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("Phase 2: Cardinal dynamic rule registration works", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service

      // Register a custom rule
      yield* cardinal.registerRules([{
        id: "custom-test-rule",
        name: "Custom Test Rule",
        evaluate: (ctx) => {
          if (ctx.diff?.includes("CUSTOM_BLOCK")) {
            return { level: "block", reason: "Custom rule triggered" }
          }
          return null
        },
      }])

      // Verify the rule is active
      const rules = yield* cardinal.getRules()
      expect(rules.some(r => r.id === "custom-test-rule")).toBe(true)

      // Verify the rule triggers
      const decision = yield* cardinal.evaluate({
        taskId: "unified",
        taskTitle: "build",
        diff: "const x = CUSTOM_BLOCK",
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("block")
      expect(decision!.reason).toBe("Custom rule triggered")

      // Cleanup
      yield* cardinal.clearDynamicRules()
      const rulesAfter = yield* cardinal.getRules()
      expect(rulesAfter.some(r => r.id === "custom-test-rule")).toBe(false)
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("Phase 2: SpecReport generates correct results", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "unified-"))
    const testFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(testFile, 'export function login() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login function
- **Status**: pending
- **Verification**: ast ${testFile}:export function login

### Requirement 2: Logout function
- **Status**: pending
- **Verification**: ast ${testFile}:export function logout
`)

    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      const result = yield* report.generateReport(specFile, "unified-session")

      expect(result.specTitle).toBe("Auth")
      expect(result.requirementResults.length).toBe(2)
      expect(result.achievedRequirements.length).toBe(1) // login passes
      expect(result.missingRequirements.length).toBe(1) // logout fails
      expect(result.overallApproved).toBe(false)
    })

    await Effect.runPromise(program.pipe(Effect.provide(specReportLayer)))
    fs.rmSync(tmpDir, { recursive: true })
  })

  it("Phase 2: SpecReport approves when all requirements pass", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "unified-"))
    const testFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(testFile, 'export function login() {}\nexport function logout() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login function
- **Status**: pending
- **Verification**: ast ${testFile}:export function login

### Requirement 2: Logout function
- **Status**: pending
- **Verification**: ast ${testFile}:export function logout
`)

    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      const result = yield* report.generateReport(specFile, "unified-session")

      expect(result.overallApproved).toBe(true)
      expect(result.achievedRequirements.length).toBe(2)
      expect(result.missingRequirements.length).toBe(0)
    })

    await Effect.runPromise(program.pipe(Effect.provide(specReportLayer)))
    fs.rmSync(tmpDir, { recursive: true })
  })

  // ══════════════════════════════════════════════════════════
  // Negative tests: things that SHOULD fail
  // ══════════════════════════════════════════════════════════

  it("Negative: Cardinal does NOT block safe code", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "unified",
        taskTitle: "build",
        diff: 'const x = Math.random()',
        changedFiles: ["src/utils.ts"],
      })
      expect(decision).toBeNull()
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("Negative: AlignmentGuard does NOT flag normal commands", async () => {
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      expect(yield* ag.detectDistraction("git status")).toBe(false)
      expect(yield* ag.detectDistraction("bun test")).toBe(false)
      expect(yield* ag.detectDistraction("cat README.md")).toBe(false)
    })
    await Effect.runPromise(program.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
  })

  it("Negative: SpecReport does NOT approve when requirements fail", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "unified-"))
    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Empty
## Requirements
### Requirement 1: Nonexistent
- **Status**: pending
- **Verification**: ast /nonexistent/file.ts:export function missing
`)

    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      const result = yield* report.generateReport(specFile, "unified-session")
      expect(result.overallApproved).toBe(false)
      expect(result.missingRequirements.length).toBe(1)
    })

    await Effect.runPromise(program.pipe(Effect.provide(specReportLayer)))
    fs.rmSync(tmpDir, { recursive: true })
  })
})
