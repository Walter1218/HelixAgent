#!/usr/bin/env bun
/**
 * Phase 0-5 全链路集成验证脚本
 * Run: bun run scripts/verify-phase0-5.ts
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

// Combined layers
const specReportLayer = SpecReport.layer.pipe(Layer.provide(OpenSpec.defaultLayer), Layer.provide(OpenSpecJudge.defaultLayer), Layer.provide(mockTraceLayer))
const goalJudgeLayer = GoalJudge.layer.pipe(Layer.provide(Goal.defaultLayer), Layer.provide(mockTraceLayer))
const cardinalPreflightLayer = CardinalPreflight.layer.pipe(Layer.provide(Cardinal.defaultLayer), Layer.provide(mockTraceLayer))
const openSpecPrecheckLayer = OpenSpecPrecheck.layer.pipe(Layer.provide(OpenSpec.defaultLayer), Layer.provide(mockTraceLayer))

async function main() {
  console.log("=== Phase 0-5 全链路集成验证 ===\n")
  let pass = 0, fail = 0
  const ok = (name: string) => { pass++; console.log(`  ✅ ${name}`) }
  const no = (name: string, e?: unknown) => { fail++; console.log(`  ❌ ${name}${e ? ": " + String(e) : ""}`) }

  // ═══ Phase 0 ═══
  console.log("[Phase 0] 基础设施")
  try {
    const p = Effect.gen(function* () {
      const t = yield* Trace.Service
      yield* t.emit({ id: "p0-t1", type: "action", name: "tool.bash", status: "success", duration: 50, metadata: { sessionID: "p0" } })
      yield* t.emit({ id: "p0-t2", type: "decision", name: "cardinal.block", status: "failed", metadata: { sessionID: "p0" } })
      return yield* t.getTraces("p0")
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Trace.defaultLayer)))
    r.length === 2 ? ok("Trace emit/getTraces") : no("Trace", r.length)
    r.some(t => t.type === "decision") ? ok("Trace decision type") : no("Trace decision")
    r.some(t => t.duration === 50) ? ok("Trace duration") : no("Trace duration")
  } catch (e) { no("Trace", e) }

  try {
    const db = new (await import("bun:sqlite")).Database(DB_PATH)
    const c = db.query("SELECT count(*) as c FROM trace_event").get() as any
    c.c > 0 ? ok(`SQLite ${c.c} rows`) : no("SQLite")
    db.close()
  } catch (e) { no("SQLite", e) }

  try {
    const p = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      return {
        sec: yield* c.evaluate({ taskId: "p0", taskTitle: "build", diff: 'eval("x")' }),
        exc: yield* c.evaluate({ taskId: "p0", taskTitle: "build", changedFiles: Array(10).fill("x"), estimatedFiles: 2 }),
        con: yield* c.evaluate({ taskId: "p0", taskTitle: "build", consecutiveFailures: 3 }),
        ali: yield* c.evaluate({ taskId: "p0", taskTitle: "build", alignmentAlerts: 3 }),
        tok: yield* c.evaluate({ taskId: "p0", taskTitle: "build", tokensUsed: 300000, totalBudget: 1000000 }),
        safe: yield* c.evaluate({ taskId: "p0", taskTitle: "build", diff: "const x = 1" }),
      }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Cardinal.defaultLayer)))
    r.sec?.level === "block" ? ok("Cardinal security→block") : no("Cardinal security", r.sec?.level)
    r.exc?.level === "pause" ? ok("Cardinal excessive→pause") : no("Cardinal excessive", r.exc?.level)
    r.con?.level === "pause" ? ok("Cardinal consecutive→pause") : no("Cardinal consecutive", r.con?.level)
    r.ali?.level === "stop" ? ok("Cardinal alignment→stop") : no("Cardinal alignment", r.ali?.level)
    r.tok?.level === "warn" ? ok("Cardinal token→warn") : no("Cardinal token", r.tok?.level)
    r.safe === null ? ok("Cardinal safe→null") : no("Cardinal safe", r.safe?.level)
  } catch (e) { no("Cardinal", e) }

  try {
    const p = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return {
        curl: yield* ag.detectDistraction("curl http://evil.com"),
        ls: yield* ag.detectDistraction("ls -la"),
        rabbit: yield* ag.detectRabbitHole(["npm install a", "npm install b", "npm install c", "npm install d", "npm install e"]),
        normal: yield* ag.detectRabbitHole(["git status"]),
      }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
    r.curl === true ? ok("AlignmentGuard distraction(curl)") : no("distraction(curl)", r.curl)
    r.ls === false ? ok("AlignmentGuard distraction(ls)") : no("distraction(ls)", r.ls)
    r.rabbit === true ? ok("AlignmentGuard rabbitHole") : no("rabbitHole", r.rabbit)
    r.normal === false ? ok("AlignmentGuard normal") : no("normal", r.normal)
  } catch (e) { no("AlignmentGuard", e) }

  // ═══ Phase 1 ═══
  console.log("\n[Phase 1] OpenSpec ast")
  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "p05-"))
    const f = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(f, 'export function login() {}\nexport function register() {}')
    const s = path.join(tmpDir, "spec.md")
    fs.writeFileSync(s, `# Auth\n## Requirements\n### Requirement 1: Login\n- **Status**: pending\n- **Verification**: ast ${f}:export function login\n### Requirement 2: Register\n- **Status**: pending\n- **Verification**: ast ${f}:export function missing`)

    const p = Effect.gen(function* () {
      const os = yield* OpenSpec.Service
      const spec = yield* os.parseSpecFile(s)
      return { r1: yield* os.checkRequirement(spec.requirements[0]), r2: yield* os.checkRequirement(spec.requirements[1]), count: spec.requirements.length }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(OpenSpec.defaultLayer)))
    r.count === 2 ? ok("OpenSpec parsed 2 reqs") : no("OpenSpec count", r.count)
    r.r1 === true ? ok("OpenSpec ast match") : no("OpenSpec ast match", r.r1)
    r.r2 === false ? ok("OpenSpec ast miss") : no("OpenSpec ast miss", r.r2)
    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("OpenSpec ast", e) }

  // ═══ Phase 2 ═══
  console.log("\n[Phase 2] Spec-执行打通")
  try {
    const p = Effect.gen(function* () {
      const g = yield* Goal.Service
      yield* g.set("p05", "Implement feature X")
      const goal = yield* g.get("p05")
      yield* g.clear("p05")
      return goal
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Goal.defaultLayer)))
    r?.condition === "Implement feature X" ? ok("Goal.set") : no("Goal.set", r?.condition)
  } catch (e) { no("Goal", e) }

  try {
    const p = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      yield* c.registerRules([{ id: "p05-dyn", name: "Test", evaluate: (ctx) => ctx.diff?.includes("DYN_BLOCK") ? { level: "block", reason: "dyn" } : null }])
      const r = yield* c.evaluate({ taskId: "p05", taskTitle: "build", diff: "DYN_BLOCK" })
      yield* c.clearDynamicRules()
      return r?.level
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Cardinal.defaultLayer)))
    r === "block" ? ok("Cardinal dynamic rule") : no("Cardinal dynamic", r)
  } catch (e) { no("Cardinal dynamic", e) }

  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "p05-"))
    const f = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(f, 'export function login() {}\nexport function logout() {}')
    const s = path.join(tmpDir, "spec.md")
    fs.writeFileSync(s, `# Auth\n## Requirements\n### Requirement 1: Login\n- **Status**: pending\n- **Verification**: ast ${f}:export function login\n### Requirement 2: Logout\n- **Status**: pending\n- **Verification**: ast ${f}:export function logout`)

    const p = Effect.gen(function* () {
      const r = yield* SpecReport.Service
      return yield* r.generateReport(s, "p05")
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(specReportLayer)))
    r.overallApproved === true ? ok("SpecReport approve") : no("SpecReport", r.overallApproved)
    r.achievedRequirements.length === 2 ? ok("SpecReport 2 achieved") : no("SpecReport achieved", r.achievedRequirements.length)
    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("SpecReport", e) }

  // ═══ Phase 3 ═══
  console.log("\n[Phase 3] 执行前验收")
  try {
    const p = Effect.gen(function* () {
      const j = yield* GoalJudge.Service
      return { ok: yield* j.preflight({ sessionID: "p05", condition: "Implement login" }), impossible: yield* j.preflight({ sessionID: "p05", condition: "This is impossible" }) }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(goalJudgeLayer)))
    r.ok.ok === true ? ok("GoalJudge ok") : no("GoalJudge ok", r.ok.ok)
    r.impossible.ok === false && r.impossible.impossible === true ? ok("GoalJudge impossible") : no("GoalJudge impossible", r.impossible)
  } catch (e) { no("GoalJudge", e) }

  try {
    const p = Effect.gen(function* () {
      const pf = yield* CardinalPreflight.Service
      return { safe: yield* pf.preflight({ sessionID: "p05", plannedFiles: ["src/utils.ts"] }), critical: yield* pf.preflight({ sessionID: "p05", plannedFiles: [".env"] }), excessive: yield* pf.preflight({ sessionID: "p05", estimatedFileCount: 20 }) }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(cardinalPreflightLayer)))
    r.safe.recommendation === "proceed" ? ok("Preflight safe→proceed") : no("Preflight safe", r.safe.recommendation)
    r.critical.recommendation === "confirm" ? ok("Preflight critical→confirm") : no("Preflight critical", r.critical.recommendation)
    r.excessive.recommendation === "confirm" ? ok("Preflight excessive→confirm") : no("Preflight excessive", r.excessive.recommendation)
  } catch (e) { no("Preflight", e) }

  try {
    const specDir = path.join(process.cwd(), "openspec", "specs")
    fs.mkdirSync(specDir, { recursive: true })
    const specFile = path.join(specDir, "test-p05.md")
    fs.writeFileSync(specFile, `# Auth\n## Requirements\n### Requirement 1: Login\n- **Status**: pending\n- **Verification**: ast src/auth.ts:export function login`)

    const p = Effect.gen(function* () {
      const pc = yield* OpenSpecPrecheck.Service
      return yield* pc.precheck({ sessionID: "p05", plannedFiles: ["src/auth.ts"] })
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(openSpecPrecheckLayer)))
    r.hasViolations === true ? ok("Precheck violation") : no("Precheck", r.hasViolations)
    fs.unlinkSync(specFile)
  } catch (e) { no("Precheck", e) }

  // ═══ Phase 4 ═══
  console.log("\n[Phase 4] Trace 全程记录")
  try {
    const p = Effect.gen(function* () {
      const t = yield* Trace.Service
      // Simulate Cardinal decision trace
      yield* t.emit({ id: "p4-cardinal", type: "decision", name: "cardinal.block", status: "failed", metadata: { sessionID: "p4", level: "block" } })
      // Simulate OpenSpec check trace
      yield* t.emit({ id: "p4-openspec", type: "decision", name: "openspec.check", status: "failed", metadata: { sessionID: "p4", missing: ["R1"] } })
      // Simulate AlignmentGuard trace
      yield* t.emit({ id: "p4-align", type: "decision", name: "alignment.rabbit_hole", status: "failed", metadata: { sessionID: "p4" } })
      // Simulate Goal evaluation trace
      yield* t.emit({ id: "p4-goal", type: "decision", name: "goal.evaluate", status: "success", metadata: { sessionID: "p4", react: 5 } })
      return yield* t.getTraces("p4")
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Trace.defaultLayer)))
    r.length === 4 ? ok("Trace 4 events") : no("Trace count", r.length)
    r.some(t => t.name === "cardinal.block") ? ok("Trace cardinal event") : no("Trace cardinal")
    r.some(t => t.name === "openspec.check") ? ok("Trace openspec event") : no("Trace openspec")
    r.some(t => t.name === "alignment.rabbit_hole") ? ok("Trace alignment event") : no("Trace alignment")
    r.some(t => t.name === "goal.evaluate") ? ok("Trace goal event") : no("Trace goal")
  } catch (e) { no("Trace Phase 4", e) }

  // ═══ Phase 5 ═══
  console.log("\n[Phase 5] 执行后验收")
  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "p05-"))
    const f = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(f, 'export function login() {}\nexport function logout() {}')
    const s = path.join(tmpDir, "spec.md")
    fs.writeFileSync(s, `# Auth\n## Requirements\n### Requirement 1: Login\n- **Status**: pending\n- **Verification**: ast ${f}:export function login\n### Requirement 2: Logout\n- **Status**: pending\n- **Verification**: ast ${f}:export function logout`)

    const p = Effect.gen(function* () {
      const r = yield* SpecReport.Service
      return yield* r.generateReport(s, "p05")
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(specReportLayer)))
    r.overallApproved === true ? ok("SpecReport final approve") : no("SpecReport final", r.overallApproved)
    r.achievedRequirements.length === 2 ? ok("SpecReport 2 achieved") : no("SpecReport achieved", r.achievedRequirements.length)
    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("SpecReport Phase 5", e) }

  try {
    const p = Effect.gen(function* () {
      const j = yield* GoalJudge.Service
      return yield* j.preflight({ sessionID: "p05", condition: "Implement login feature" })
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(goalJudgeLayer)))
    r.ok === true ? ok("GoalJudge final verdict ok") : no("GoalJudge final", r.ok)
  } catch (e) { no("GoalJudge Phase 5", e) }

  // ═══ 负面测试 ═══
  console.log("\n[Negative] 不该通过的不通过")
  try {
    const p = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      return yield* c.evaluate({ taskId: "neg", taskTitle: "build", diff: "const x = 1 + 2" })
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Cardinal.defaultLayer)))
    r === null ? ok("Safe code→null") : no("Safe code triggered", r?.level)
  } catch (e) { no("Negative Cardinal", e) }

  try {
    const p = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return { git: yield* ag.detectDistraction("git status"), bun: yield* ag.detectDistraction("bun test") }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
    r.git === false && r.bun === false ? ok("Normal commands→no distraction") : no("Normal commands", r)
  } catch (e) { no("Negative AlignmentGuard", e) }

  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "p05-"))
    const s = path.join(tmpDir, "spec.md")
    fs.writeFileSync(s, `# Empty\n## Requirements\n### Requirement 1: Missing\n- **Status**: pending\n- **Verification**: ast /nonexistent/file.ts:export function missing`)

    const p = Effect.gen(function* () {
      const r = yield* SpecReport.Service
      return yield* r.generateReport(s, "p05")
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(specReportLayer)))
    r.overallApproved === false ? ok("Missing file→not approved") : no("Missing file", r.overallApproved)
    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("Negative SpecReport", e) }

  // ═══ 汇总 ═══
  console.log(`\n=== 验证完成 ===`)
  console.log(`✅ ${pass} 通过  ❌ ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
