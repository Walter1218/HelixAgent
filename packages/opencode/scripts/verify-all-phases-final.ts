#!/usr/bin/env bun
/**
 * Phase 0-8 全系统验证脚本
 * Run: bun run scripts/verify-all-phases-final.ts
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
import { Rollback } from "../src/session/rollback"
import { Trace } from "../src/trace/trace"
import { extractContract } from "../src/ast/ast"
import fs from "fs"
import path from "path"

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
const rollbackLayer = Rollback.layer.pipe(Layer.provide(mockTraceLayer))

async function main() {
  console.log("=== Phase 0-8 全系统验证 ===\n")
  let pass = 0, fail = 0
  const ok = (name: string) => { pass++; console.log(`  ✅ ${name}`) }
  const no = (name: string, e?: unknown) => { fail++; console.log(`  ❌ ${name}${e ? ": " + String(e) : ""}`) }

  // ═══ Phase 0: 基础设施 ═══
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
  } catch (e) { no("Trace", e) }

  try {
    const p = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      return {
        sec: yield* c.evaluate({ taskId: "p0", taskTitle: "build", diff: 'eval("x")' }),
        safe: yield* c.evaluate({ taskId: "p0", taskTitle: "build", diff: "const x = 1" }),
      }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Cardinal.defaultLayer)))
    r.sec?.level === "block" ? ok("Cardinal security→block") : no("Cardinal security", r.sec?.level)
    r.safe === null ? ok("Cardinal safe→null") : no("Cardinal safe", r.safe?.level)
  } catch (e) { no("Cardinal", e) }

  try {
    const p = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return {
        curl: yield* ag.detectDistraction("curl http://evil.com"),
        ls: yield* ag.detectDistraction("ls -la"),
        rabbit: yield* ag.detectRabbitHole(["npm install a", "npm install b", "npm install c", "npm install d", "npm install e"]),
      }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
    r.curl === true ? ok("AlignmentGuard distraction(curl)") : no("distraction(curl)", r.curl)
    r.ls === false ? ok("AlignmentGuard distraction(ls)") : no("distraction(ls)", r.ls)
    r.rabbit === true ? ok("AlignmentGuard rabbitHole") : no("rabbitHole", r.rabbit)
  } catch (e) { no("AlignmentGuard", e) }

  // ═══ Phase 1: OpenSpec ast ═══
  console.log("\n[Phase 1] OpenSpec ast")
  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "all-"))
    const f = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(f, 'export function login() {}\nexport function register() {}')
    const s = path.join(tmpDir, "spec.md")
    fs.writeFileSync(s, `# Auth\n## Requirements\n### Requirement 1: Login\n- **Status**: pending\n- **Verification**: ast ${f}:export function login\n### Requirement 2: Register\n- **Status**: pending\n- **Verification**: ast ${f}:export function missing`)

    const p = Effect.gen(function* () {
      const os = yield* OpenSpec.Service
      const spec = yield* os.parseSpecFile(s)
      return { r1: yield* os.checkRequirement(spec.requirements[0]), r2: yield* os.checkRequirement(spec.requirements[1]) }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(OpenSpec.defaultLayer)))
    r.r1 === true ? ok("OpenSpec ast match") : no("OpenSpec ast match", r.r1)
    r.r2 === false ? ok("OpenSpec ast miss") : no("OpenSpec ast miss", r.r2)
    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("OpenSpec ast", e) }

  // ═══ Phase 2: Spec-执行打通 ═══
  console.log("\n[Phase 2] Spec-执行打通")
  try {
    const p = Effect.gen(function* () {
      const g = yield* Goal.Service
      yield* g.set("p08", "Implement feature X")
      const goal = yield* g.get("p08")
      yield* g.clear("p08")
      return goal
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Goal.defaultLayer)))
    r?.condition === "Implement feature X" ? ok("Goal.set") : no("Goal.set", r?.condition)
  } catch (e) { no("Goal", e) }

  try {
    const p = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      yield* c.registerRules([{ id: "p08-dyn", name: "Test", evaluate: (ctx) => ctx.diff?.includes("DYN_BLOCK") ? { level: "block", reason: "dyn" } : null }])
      const r = yield* c.evaluate({ taskId: "p08", taskTitle: "build", diff: "DYN_BLOCK" })
      yield* c.clearDynamicRules()
      return r?.level
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Cardinal.defaultLayer)))
    r === "block" ? ok("Cardinal dynamic rule") : no("Cardinal dynamic", r)
  } catch (e) { no("Cardinal dynamic", e) }

  // ═══ Phase 3: 执行前验收 ═══
  console.log("\n[Phase 3] 执行前验收")
  try {
    const p = Effect.gen(function* () {
      const j = yield* GoalJudge.Service
      return { ok: yield* j.preflight({ sessionID: "p08", condition: "Implement login" }), impossible: yield* j.preflight({ sessionID: "p08", condition: "This is impossible" }) }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(goalJudgeLayer)))
    r.ok.ok === true ? ok("GoalJudge ok") : no("GoalJudge ok", r.ok.ok)
    r.impossible.ok === false && r.impossible.impossible === true ? ok("GoalJudge impossible") : no("GoalJudge impossible", r.impossible)
  } catch (e) { no("GoalJudge", e) }

  try {
    const p = Effect.gen(function* () {
      const pf = yield* CardinalPreflight.Service
      return { safe: yield* pf.preflight({ sessionID: "p08", plannedFiles: ["src/utils.ts"] }), critical: yield* pf.preflight({ sessionID: "p08", plannedFiles: [".env"] }) }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(cardinalPreflightLayer)))
    r.safe.recommendation === "proceed" ? ok("Preflight safe→proceed") : no("Preflight safe", r.safe.recommendation)
    r.critical.recommendation === "confirm" ? ok("Preflight critical→confirm") : no("Preflight critical", r.critical.recommendation)
  } catch (e) { no("Preflight", e) }

  // ═══ Phase 4: Trace 全程记录 ═══
  console.log("\n[Phase 4] Trace 全程记录")
  try {
    const p = Effect.gen(function* () {
      const t = yield* Trace.Service
      yield* t.emit({ id: "p4-cardinal", type: "decision", name: "cardinal.block", status: "failed", metadata: { sessionID: "p4" } })
      yield* t.emit({ id: "p4-openspec", type: "decision", name: "openspec.check", status: "success", metadata: { sessionID: "p4" } })
      yield* t.emit({ id: "p4-goal", type: "decision", name: "goal.evaluate", status: "success", metadata: { sessionID: "p4" } })
      return yield* t.getTraces("p4")
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(Trace.defaultLayer)))
    r.length === 3 ? ok("Trace 3 events") : no("Trace count", r.length)
    r.some(t => t.name === "cardinal.block") ? ok("Trace cardinal") : no("Trace cardinal")
    r.some(t => t.name === "openspec.check") ? ok("Trace openspec") : no("Trace openspec")
    r.some(t => t.name === "goal.evaluate") ? ok("Trace goal") : no("Trace goal")
  } catch (e) { no("Trace Phase 4", e) }

  // ═══ Phase 5: 执行后验收 ═══
  console.log("\n[Phase 5] 执行后验收")
  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "p08-"))
    const f = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(f, 'export function login() {}\nexport function logout() {}')
    const s = path.join(tmpDir, "spec.md")
    fs.writeFileSync(s, `# Auth\n## Requirements\n### Requirement 1: Login\n- **Status**: pending\n- **Verification**: ast ${f}:export function login\n### Requirement 2: Logout\n- **Status**: pending\n- **Verification**: ast ${f}:export function logout`)

    const p = Effect.gen(function* () {
      const r = yield* SpecReport.Service
      return yield* r.generateReport(s, "p08")
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(specReportLayer)))
    r.overallApproved === true ? ok("SpecReport approve") : no("SpecReport", r.overallApproved)
    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("SpecReport", e) }

  // ═══ Phase 7: Rollback ═══
  console.log("\n[Phase 7] Rollback 机制")
  try {
    const p = Effect.gen(function* () {
      const rb = yield* Rollback.Service
      const blockStrategy = yield* rb.evaluate({ level: "block", reason: "eval detected" })
      const stopStrategy = yield* rb.evaluate({ level: "stop", reason: "too many failures" })
      const warnStrategy = yield* rb.evaluate({ level: "warn", reason: "high token usage" })
      return { blockStrategy, stopStrategy, warnStrategy }
    })
    const r = await Effect.runPromise(p.pipe(Effect.provide(rollbackLayer)))
    r.blockStrategy.type === "revert-last-tool" ? ok("Rollback block→revert-last-tool") : no("Rollback block", r.blockStrategy.type)
    r.stopStrategy.type === "abort-session" ? ok("Rollback stop→abort-session") : no("Rollback stop", r.stopStrategy.type)
    r.warnStrategy.type === "none" ? ok("Rollback warn→none") : no("Rollback warn", r.warnStrategy.type)
  } catch (e) { no("Rollback", e) }

  // ═══ Phase 8: AST 语义升级 ═══
  console.log("\n[Phase 8] AST 语义升级")
  try {
    const code = `
export class UserService {
  private db: Database
  public async getUser(id: string): Promise<User> {
    return this.db.query(id)
  }
  public deleteUser(id: string): void {
    this.db.delete(id)
  }
}

export function authenticate(user: string, pass: string): boolean {
  return true
}

export const config = { debug: true }
`
    const contract = extractContract(code)
    contract.classes.length === 1 ? ok("AST extract 1 class") : no("AST classes", contract.classes.length)
    contract.classes[0].name === "UserService" ? ok("AST class name") : no("AST class name", contract.classes[0].name)
    contract.classes[0].methods.length >= 2 ? ok(`AST methods: ${contract.classes[0].methods.join(", ")}`) : no("AST methods", contract.classes[0].methods.length)
    contract.classes[0].properties.length >= 1 ? ok(`AST properties: ${contract.classes[0].properties.join(", ")}`) : no("AST properties", contract.classes[0].properties.length)
    contract.functions.length >= 1 ? ok("AST extract functions") : no("AST functions", contract.functions.length)
    contract.exports.length >= 3 ? ok(`AST exports: ${contract.exports.join(", ")}`) : no("AST exports", contract.exports.length)
  } catch (e) { no("AST", e) }

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

  // ═══ 汇总 ═══
  console.log(`\n=== 验证完成 ===`)
  console.log(`✅ ${pass} 通过  ❌ ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
