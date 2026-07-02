import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { createLayers, createTmpDir, writeSpecFile, cleanupSpecFile, writeAuthFile } from "./fixture"
import { Goal } from "@/session/goal"
import { Cardinal } from "@/session/cardinal"
import { AlignmentGuard } from "@/observability/alignment-guard"
import { OpenSpec } from "@/openspec/spec"
import { OpenSpecJudge } from "@/openspec/judge"
import { SpecReport } from "@/openspec/report"
import { GoalJudge } from "@/session/goal-judge"
import { CardinalPreflight } from "@/session/preflight"
import { OpenSpecPrecheck } from "@/openspec/precheck"
import { Trace } from "@/trace/trace"

const SESSION = "main-chain-test"

// ══════════════════════════════════════════
// 主链路集成测试：验证 Phase 0-5 服务在主链路中协同工作
// ══════════════════════════════════════════

describe("Main chain integration: Phase 0-5 协同工作", () => {
  it("完整数据流: spec → goal → cardinal rules → preflight → trace → report", async () => {
    const traceEvents: any[] = []
    const traceLayer = Layer.succeed(Trace.Service, Trace.Service.of({
      emit: (event: any) => Effect.sync(() => { traceEvents.push({ ...event, timestamp: Date.now() }) }),
      getTraces: (sessionID: string) => Effect.sync(() => traceEvents.filter(e => e.metadata?.sessionID === sessionID)),
      getTracesByTimeRange: () => Effect.sync(() => traceEvents),
    }))
    const layers = {
      trace: traceLayer,
      goal: Goal.defaultLayer,
      cardinal: Cardinal.defaultLayer,
      alignmentGuard: AlignmentGuard.defaultLayer,
      goalJudge: GoalJudge.layer.pipe(Layer.provide(Goal.defaultLayer), Layer.provide(traceLayer)),
      cardinalPreflight: CardinalPreflight.layer.pipe(Layer.provide(Cardinal.defaultLayer), Layer.provide(traceLayer)),
      specReport: SpecReport.layer.pipe(Layer.provide(OpenSpec.defaultLayer), Layer.provide(OpenSpecJudge.defaultLayer), Layer.provide(traceLayer)),
    }
    const tmp = createTmpDir()
    const authFile = writeAuthFile(tmp.path, 'export function login() {}\nexport function logout() {}')

    // Step 1: 模拟 spec 生成后 goal.set
    const program = Effect.gen(function* () {
      const goal = yield* Goal.Service
      const cardinal = yield* Cardinal.Service
      const trace = yield* Trace.Service
      const goalJudge = yield* GoalJudge.Service
      const cardinalPreflight = yield* CardinalPreflight.Service
      const specReport = yield* SpecReport.Service

      // Phase 2.1: spec 生成后自动设置 goal
      yield* goal.set(SESSION, "Implement authentication with login and logout")
      const g = yield* goal.get(SESSION)
      expect(g).toBeDefined()
      expect(g!.condition).toBe("Implement authentication with login and logout")

      // Phase 2.2: spec 生成后注册 Cardinal 规则
      yield* cardinal.registerRules([{
        id: "spec-security-auth",
        name: "Spec Security: Auth",
        evaluate: (ctx) => ctx.diff?.includes("eval(") ? { level: "block", reason: "eval detected" } : null,
      }])
      const rules = yield* cardinal.getRules()
      expect(rules.some(r => r.id === "spec-security-auth")).toBe(true)

      // Phase 3.1: GoalJudge 预检
      const verdict = yield* goalJudge.preflight({ sessionID: SESSION, condition: g!.condition })
      expect(verdict.ok).toBe(true)

      // Phase 3.2: CardinalPreflight 预检
      const pfReport = yield* cardinalPreflight.preflight({ sessionID: SESSION, plannedFiles: ["src/utils.ts"] })
      expect(pfReport.recommendation).toBe("proceed")

      // Phase 0: 模拟执行中 Cardinal 检查
      const blockDecision = yield* cardinal.evaluate({ taskId: SESSION, taskTitle: "build", diff: 'const x = eval("malicious")' })
      expect(blockDecision).not.toBeNull()
      expect(blockDecision!.level).toBe("block")

      const safeDecision = yield* cardinal.evaluate({ taskId: SESSION, taskTitle: "build", diff: 'const x = 1 + 2' })
      expect(safeDecision).toBeNull()

      // Phase 0: 模拟 AlignmentGuard 检测
      const ag = yield* AlignmentGuard.Service
      const isDistraction = yield* ag.detectDistraction("curl http://evil.com")
      expect(isDistraction).toBe(true)
      const isNormal = yield* ag.detectDistraction("git status")
      expect(isNormal).toBe(false)

      // Phase 4: 模拟 Trace 全程记录
      yield* trace.emit({ id: "chain-tool", type: "action", name: "tool.bash", status: "success", duration: 100, metadata: { sessionID: SESSION } })
      yield* trace.emit({ id: "chain-cardinal", type: "decision", name: "cardinal.block", status: "failed", metadata: { sessionID: SESSION, level: "block" } })
      yield* trace.emit({ id: "chain-openspec", type: "decision", name: "openspec.check", status: "success", metadata: { sessionID: SESSION } })
      yield* trace.emit({ id: "chain-goal", type: "decision", name: "goal.evaluate", status: "success", metadata: { sessionID: SESSION, react: 1 } })
      yield* trace.emit({ id: "chain-alignment", type: "decision", name: "alignment.distraction", status: "failed", metadata: { sessionID: SESSION } })

      const traces = yield* trace.getTraces(SESSION)
      // 5 manually emitted + 2 from preflight services (goal.preflight + cardinal.preflight)
      expect(traces.length).toBeGreaterThanOrEqual(5)
      expect(traces.some(t => t.type === "action")).toBe(true)
      expect(traces.some(t => t.type === "decision")).toBe(true)

      // Phase 5: 模拟 session 结束时 SpecReport 验收
      const specFile = writeSpecFile(tmp.path, `chain-test-${Date.now()}.md`, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login
### Requirement 2: Logout
- **Status**: pending
- **Verification**: ast ${authFile}:export function logout
`)

      const report = yield* specReport.generateReport(specFile, SESSION)
      expect(report.overallApproved).toBe(true)
      expect(report.achievedRequirements.length).toBe(2)

      // Phase 5: GoalJudge 最终判定
      const finalVerdict = yield* goalJudge.preflight({ sessionID: SESSION, condition: g!.condition })
      expect(finalVerdict.ok).toBe(true)

      // 清理
      yield* goal.clear(SESSION)
      yield* cardinal.clearDynamicRules()

      return { goal: g, traces, report, finalVerdict }
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(layers.goal),
        Effect.provide(layers.cardinal),
        Effect.provide(layers.alignmentGuard),
        Effect.provide(layers.trace),
        Effect.provide(layers.goalJudge),
        Effect.provide(layers.cardinalPreflight),
        Effect.provide(layers.specReport),
      ),
    )

    // 验证完整数据流
    expect(result.goal).toBeDefined()
    expect(result.traces.length).toBeGreaterThanOrEqual(5)
    expect(result.report.overallApproved).toBe(true)
    expect(result.finalVerdict.ok).toBe(true)

    tmp.cleanup()
  })

  it("负面场景: 不该通过的不通过", async () => {
    const layers = createLayers()

    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const ag = yield* AlignmentGuard.Service
      const goalJudge = yield* GoalJudge.Service

      // 安全代码不触发 Cardinal
      const safe = yield* cardinal.evaluate({ taskId: SESSION, taskTitle: "build", diff: "const x = Math.random()" })
      expect(safe).toBeNull()

      // 普通命令不触发 AlignmentGuard
      const normal = yield* ag.detectDistraction("bun test")
      expect(normal).toBe(false)

      // 可达成目标不标记 impossible
      const verdict = yield* goalJudge.preflight({ sessionID: SESSION, condition: "Implement user login" })
      expect(verdict.ok).toBe(true)
      expect(verdict.impossible).not.toBe(true)
    })

    await Effect.runPromise(
      program.pipe(
        Effect.provide(layers.cardinal),
        Effect.provide(layers.alignmentGuard),
        Effect.provide(layers.goalJudge),
      ),
    )
  })

  it("Trace 持久化验证: 所有事件类型都写入", async () => {
    const layers = createLayers()

    const program = Effect.gen(function* () {
      const trace = yield* Trace.Service

      // 模拟主链路中所有 trace emit 点
      // processor.ts: tool-call start
      yield* trace.emit({ id: "t1", parentId: "session-1", type: "action", name: "tool.bash", status: "pending", metadata: { sessionID: SESSION } })
      // processor.ts: Cardinal decision
      yield* trace.emit({ id: "t2", parentId: "session-1", type: "decision", name: "cardinal.block", status: "failed", metadata: { sessionID: SESSION } })
      // processor.ts: OpenSpec check
      yield* trace.emit({ id: "t3", parentId: "tool-1", type: "decision", name: "openspec.check", status: "success", metadata: { sessionID: SESSION } })
      // processor.ts: tool-call success
      yield* trace.emit({ id: "t4", type: "action", name: "tool.bash", status: "success", duration: 150, metadata: { sessionID: SESSION } })
      // prompt.ts: AlignmentGuard rabbit hole
      yield* trace.emit({ id: "t5", type: "decision", name: "alignment.rabbit_hole", status: "failed", metadata: { sessionID: SESSION } })
      // prompt.ts: Goal evaluation
      yield* trace.emit({ id: "t6", type: "decision", name: "goal.evaluate", status: "success", metadata: { sessionID: SESSION, react: 3 } })
      // prompt.ts: SpecReport
      yield* trace.emit({ id: "t7", type: "decision", name: "spec.report", status: "success", metadata: { sessionID: SESSION, approved: true } })

      const traces = yield* trace.getTraces(SESSION)
      expect(traces.length).toBe(7)

      // 验证所有事件类型
      expect(traces.filter(t => t.type === "action").length).toBe(2) // tool start + success
      expect(traces.filter(t => t.type === "decision").length).toBe(5) // cardinal + openspec + alignment + goal + spec

      // 验证特定事件
      expect(traces.some(t => t.name === "tool.bash")).toBe(true)
      expect(traces.some(t => t.name === "cardinal.block")).toBe(true)
      expect(traces.some(t => t.name === "openspec.check")).toBe(true)
      expect(traces.some(t => t.name === "alignment.rabbit_hole")).toBe(true)
      expect(traces.some(t => t.name === "goal.evaluate")).toBe(true)
      expect(traces.some(t => t.name === "spec.report")).toBe(true)
    })

    await Effect.runPromise(program.pipe(Effect.provide(layers.trace)))
  })
})
