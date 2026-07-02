import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { Cardinal } from "@/session/cardinal"

describe("Cardinal context", () => {
  it("security rule triggers with eval in diff", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "sess-1",
        taskTitle: "build",
        diff: 'const code = eval("alert(1)")',
        changedFiles: [],
        consecutiveFailures: 0,
        alignmentAlerts: 0,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("block")
      expect(decision!.reason).toContain("eval")
      expect(decision!.sessionID).toBe("sess-1")
      expect(decision!.timestamp).toBeGreaterThan(0)
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("security rule passes without eval", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "sess-1",
        taskTitle: "build",
        diff: 'const x = 1 + 2',
        changedFiles: [],
        consecutiveFailures: 0,
        alignmentAlerts: 0,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })
      expect(decision).toBeNull()
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("excessive_changes rule triggers", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "sess-1",
        taskTitle: "build",
        changedFiles: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"],
        estimatedFiles: 2,
        consecutiveFailures: 0,
        alignmentAlerts: 0,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("pause")
      expect(decision!.reason).toContain("改动文件数")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("consecutive_failures rule triggers", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "sess-1",
        taskTitle: "build",
        consecutiveFailures: 3,
        alignmentAlerts: 0,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("pause")
      expect(decision!.reason).toContain("连续失败")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("alignment rule triggers", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "sess-1",
        taskTitle: "build",
        alignmentAlerts: 3,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("stop")
      expect(decision!.reason).toContain("AlignmentGuard")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })

  it("token_limit rule triggers as warn", async () => {
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: "sess-1",
        taskTitle: "build",
        tokensUsed: 250_000,
        totalBudget: 1_000_000,
      })
      expect(decision).not.toBeNull()
      expect(decision!.level).toBe("warn")
      expect(decision!.reason).toContain("token")
    })
    await Effect.runPromise(program.pipe(Effect.provide(Cardinal.defaultLayer)))
  })
})
