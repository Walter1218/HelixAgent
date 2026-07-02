#!/usr/bin/env bun
/**
 * Phase 0+1+2 主链路集成验证脚本
 * Run: bun run scripts/verify-main-chain.ts
 */
import { Effect, Layer } from "effect"
import { Goal } from "../src/session/goal"
import { Cardinal } from "../src/session/cardinal"
import { AlignmentGuard } from "../src/observability/alignment-guard"
import { OpenSpec } from "../src/openspec/spec"
import { OpenSpecJudge } from "../src/openspec/judge"
import { SpecReport } from "../src/openspec/report"
import { Trace } from "../src/trace/trace"
import fs from "fs"
import path from "path"

const DB_PATH = path.join(process.env.HOME!, ".local/share/opencode/opencode-local.db")

// Mock Trace for SpecReport tests
const mockTraceLayer = Layer.succeed(Trace.Service, Trace.Service.of({
  emit: () => Effect.void,
  getTraces: () => Effect.succeed([]),
  getTracesByTimeRange: () => Effect.succeed([]),
}))

const specReportLayer = SpecReport.layer.pipe(
  Layer.provide(OpenSpec.defaultLayer),
  Layer.provide(OpenSpecJudge.defaultLayer),
  Layer.provide(mockTraceLayer),
)

async function main() {
  console.log("=== Phase 0+1+2 主链路集成验证 ===\n")
  let pass = 0
  let fail = 0

  function ok(name: string) { pass++; console.log(`  ✅ ${name}`) }
  function no(name: string, e?: unknown) { fail++; console.log(`  ❌ ${name}${e ? `: ${e}` : ""}`) }

  // ══════════════════════════════════════════
  // Phase 0: Trace 持久化
  // ══════════════════════════════════════════
  console.log("[Phase 0] Trace 持久化")

  try {
    const program = Effect.gen(function* () {
      const trace = yield* Trace.Service
      yield* trace.emit({ id: "mc-t1", type: "action", name: "tool.bash", status: "success", duration: 50, metadata: { sessionID: "mc-session" } })
      yield* trace.emit({ id: "mc-t2", type: "decision", name: "cardinal.block", status: "failed", metadata: { sessionID: "mc-session", level: "block" } })
      const traces = yield* trace.getTraces("mc-session")
      return traces
    })
    const traces = await Effect.runPromise(program.pipe(Effect.provide(Trace.defaultLayer)))
    traces.length === 2 ? ok("emit 2 events, getTraces returns 2") : no("getTraces count", traces.length)
    traces.some(t => t.type === "decision") ? ok("decision type event exists") : no("no decision type")
    traces.some(t => t.duration === 50) ? ok("duration recorded") : no("duration missing")
  } catch (e) { no("Trace roundtrip", e) }

  // SQLite 持久化检查
  try {
    const db = new (await import("bun:sqlite")).Database(DB_PATH)
    const count = db.query("SELECT count(*) as c FROM trace_event").get() as any
    count.c > 0 ? ok(`SQLite has ${count.c} rows`) : no("SQLite empty")
    db.close()
  } catch (e) { no("SQLite check", e) }

  // ══════════════════════════════════════════
  // Phase 0: Cardinal 5 条规则
  // ══════════════════════════════════════════
  console.log("\n[Phase 0] Cardinal 规则验证")

  try {
    const program = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      const results: Record<string, string | null> = {}

      // security
      const sec = yield* c.evaluate({ taskId: "mc", taskTitle: "build", diff: 'eval("x")' })
      results.security = sec?.level ?? null

      // excessive_changes
      const exc = yield* c.evaluate({ taskId: "mc", taskTitle: "build", changedFiles: Array(10).fill("x.ts"), estimatedFiles: 2 })
      results.excessive = exc?.level ?? null

      // consecutive_failures
      const con = yield* c.evaluate({ taskId: "mc", taskTitle: "build", consecutiveFailures: 3 })
      results.consecutive = con?.level ?? null

      // alignment
      const ali = yield* c.evaluate({ taskId: "mc", taskTitle: "build", alignmentAlerts: 3 })
      results.alignment = ali?.level ?? null

      // token_limit
      const tok = yield* c.evaluate({ taskId: "mc", taskTitle: "build", tokensUsed: 300000, totalBudget: 1000000 })
      results.token = tok?.level ?? null

      // safe code (should be null)
      const safe = yield* c.evaluate({ taskId: "mc", taskTitle: "build", diff: 'const x = 1' })
      results.safe = safe?.level ?? null

      return results
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))

    r.security === "block" ? ok("security → block") : no("security", r.security)
    r.excessive === "pause" ? ok("excessive_changes → pause") : no("excessive", r.excessive)
    r.consecutive === "pause" ? ok("consecutive_failures → pause") : no("consecutive", r.consecutive)
    r.alignment === "stop" ? ok("alignment → stop") : no("alignment", r.alignment)
    r.token === "warn" ? ok("token_limit → warn") : no("token", r.token)
    r.safe === null ? ok("safe code → null") : no("safe code triggered", r.safe)
  } catch (e) { no("Cardinal rules", e) }

  // ══════════════════════════════════════════
  // Phase 0: AlignmentGuard
  // ══════════════════════════════════════════
  console.log("\n[Phase 0] AlignmentGuard 验证")

  try {
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return {
        curl: yield* ag.detectDistraction("curl http://evil.com"),
        ls: yield* ag.detectDistraction("ls -la"),
        rabbit: yield* ag.detectRabbitHole(["npm install a", "npm install b", "npm install c", "npm install d", "npm install e"]),
        normal: yield* ag.detectRabbitHole(["git status", "bun test"]),
      }
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
    r.curl === true ? ok("distraction(curl) → true") : no("distraction(curl)", r.curl)
    r.ls === false ? ok("distraction(ls) → false") : no("distraction(ls)", r.ls)
    r.rabbit === true ? ok("rabbitHole(5x npm) → true") : no("rabbitHole", r.rabbit)
    r.normal === false ? ok("rabbitHole(normal) → false") : no("rabbitHole(normal)", r.normal)
  } catch (e) { no("AlignmentGuard", e) }

  // ══════════════════════════════════════════
  // Phase 1: OpenSpec ast verification
  // ══════════════════════════════════════════
  console.log("\n[Phase 1] OpenSpec ast verification 验证")

  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "mc-"))
    const authFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(authFile, 'export function login() {}\nexport function logout() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Overview
Authentication module

## Requirements

### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login

### Requirement 2: Register
- **Status**: pending
- **Verification**: ast ${authFile}:export function register
`)

    const program = Effect.gen(function* () {
      const os = yield* OpenSpec.Service
      const spec = yield* os.parseSpecFile(specFile)
      const r1 = yield* os.checkRequirement(spec.requirements[0])
      const r2 = yield* os.checkRequirement(spec.requirements[1])
      return { r1, r2, reqCount: spec.requirements.length }
    })
    const { r1, r2, reqCount } = await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    reqCount === 2 ? ok(`parsed ${reqCount} requirements`) : no("req count", reqCount)
    r1 === true ? ok("ast login → true") : no("ast login", r1)
    r2 === false ? ok("ast register → false") : no("ast register", r2)

    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("OpenSpec ast", e) }

  // ══════════════════════════════════════════
  // Phase 2: Goal 自动设置
  // ══════════════════════════════════════════
  console.log("\n[Phase 2] Goal 自动设置验证")

  try {
    const program = Effect.gen(function* () {
      const goal = yield* Goal.Service
      yield* goal.set("mc-session", "Implement SMS verification")
      const g = yield* goal.get("mc-session")
      yield* goal.clear("mc-session")
      return g
    })
    const g = await Effect.runPromise(program.pipe(Effect.provide(Goal.defaultLayer)))
    g !== undefined ? ok("goal.set → goal exists") : no("goal.set", "undefined")
    g?.condition === "Implement SMS verification" ? ok("condition matches") : no("condition", g?.condition)
    g?.react === 0 ? ok("react = 0") : no("react", g?.react)
  } catch (e) { no("Goal", e) }

  // ══════════════════════════════════════════
  // Phase 2: Cardinal 动态规则注册
  // ══════════════════════════════════════════
  console.log("\n[Phase 2] Cardinal 动态规则注册验证")

  try {
    const program = Effect.gen(function* () {
      const c = yield* Cardinal.Service

      // 注册自定义规则
      yield* c.registerRules([{
        id: "test-spec-rule",
        name: "Test Spec Rule",
        evaluate: (ctx) => ctx.diff?.includes("SPEC_VIOLATION") ? { level: "block", reason: "Spec violation" } : null,
      }])

      // 验证规则生效
      const rules = yield* c.getRules()
      const hasRule = rules.some(r => r.id === "test-spec-rule")

      const trigger = yield* c.evaluate({ taskId: "mc", taskTitle: "build", diff: "SPEC_VIOLATION" })
      const safe = yield* c.evaluate({ taskId: "mc", taskTitle: "build", diff: "const x = 1 + 2" })

      // 清理
      yield* c.clearDynamicRules()
      const rulesAfter = yield* c.getRules()

      return { hasRule, trigger: trigger?.level ?? null, safe: safe?.level ?? null, cleaned: !rulesAfter.some(r => r.id === "test-spec-rule") }
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
    r.hasRule ? ok("registerRules → rule exists") : no("registerRules", "not found")
    r.trigger === "block" ? ok("dynamic rule triggers → block") : no("dynamic trigger", r.trigger)
    r.safe === null ? ok("safe code → null") : no("safe triggered", r.safe)
    r.cleaned ? ok("clearDynamicRules → cleaned") : no("clear", "not cleaned")
  } catch (e) { no("Cardinal dynamic rules", e) }

  // ══════════════════════════════════════════
  // Phase 2: SpecReport 验收报告
  // ══════════════════════════════════════════
  console.log("\n[Phase 2] SpecReport 验收报告验证")

  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "mc-"))
    const authFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(authFile, 'export function login() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Overview
Authentication module

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
      return yield* report.generateReport(specFile, "mc-session")
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(specReportLayer)))
    r.overallApproved === false ? ok("partial → not approved") : no("partial approved", r.overallApproved)
    r.achievedRequirements.length === 1 ? ok("1 achieved (login)") : no("achieved count", r.achievedRequirements.length)
    r.missingRequirements.length === 1 ? ok("1 missing (logout)") : no("missing count", r.missingRequirements.length)

    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("SpecReport partial", e) }

  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "mc-"))
    const authFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(authFile, 'export function login() {}\nexport function logout() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Overview
Authentication module

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
      return yield* report.generateReport(specFile, "mc-session")
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(specReportLayer)))
    r.overallApproved === true ? ok("all pass → approved") : no("all pass approved", r.overallApproved)
    r.achievedRequirements.length === 2 ? ok("2 achieved") : no("achieved count", r.achievedRequirements.length)

    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) { no("SpecReport approve", e) }

  // ══════════════════════════════════════════
  // 负面测试：不该触发的不触发
  // ══════════════════════════════════════════
  console.log("\n[Negative] 不该通过的不通过")

  try {
    const program = Effect.gen(function* () {
      const c = yield* Cardinal.Service
      const safe = yield* c.evaluate({ taskId: "mc", taskTitle: "build", diff: 'const x = Math.random()' })
      return safe
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
    r === null ? ok("safe code → Cardinal null") : no("safe code triggered", r?.level)
  } catch (e) { no("negative Cardinal", e) }

  try {
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return {
        git: yield* ag.detectDistraction("git status"),
        bun: yield* ag.detectDistraction("bun test"),
        cat: yield* ag.detectDistraction("cat README.md"),
      }
    })
    const r = await Effect.runPromise(program.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
    r.git === false && r.bun === false && r.cat === false ? ok("normal commands → no distraction") : no("normal commands flagged", r)
  } catch (e) { no("negative AlignmentGuard", e) }

  // ══════════════════════════════════════════
  // 汇总
  // ══════════════════════════════════════════
  console.log(`\n=== 验证完成 ===`)
  console.log(`✅ ${pass} 通过  ❌ ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
