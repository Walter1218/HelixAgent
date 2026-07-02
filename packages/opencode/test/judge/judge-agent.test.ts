/**
 * Judge Agent 测试
 * 
 * 运行：cd packages/opencode && bun test test/judge/judge-agent.test.ts --timeout 60000
 */

import { describe, it, expect } from "bun:test"
import { JudgeAgent } from "@/agent/judge-agent"
import { Effect } from "effect"

describe("Judge Agent", () => {
  it("should reject code with reduced assertions", async () => {
    const diff = `
- expect(1 + 1).toBe(2)
- expect(2 + 2).toBe(4)
- expect(3 + 3).toBe(6)
- expect(4 + 4).toBe(8)
+ expect(result).toBeTruthy()
`
    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service
      return yield* judge.evaluate({
        diff,
        changedFiles: ["test.ts"],
      })
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    console.log("✓ Assertion reduction check:", result.decision)
    console.log("  Reason:", result.reason)
    expect(result.decision).toBe("reject")
  })

  it("should reject code with dangerous patterns", async () => {
    const diff = `
+ const result = dangerousFunction(userInput)
+ const key = process.env.SECRET_KEY
`
    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service
      return yield* judge.evaluate({
        diff,
        changedFiles: ["security.ts"],
      })
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    console.log("✓ Security check:", result.decision)
    console.log("  Reason:", result.reason)
    expect(result.decision).toBe("reject")
  })

  it("should approve clean code", async () => {
    const diff = `
+ function add(a: number, b: number): number {
+   return a + b
+ }
+ 
+ expect(add(1, 2)).toBe(3)
`
    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service
      return yield* judge.evaluate({
        diff,
        changedFiles: ["math.ts"],
      })
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    console.log("✓ Clean code check:", result.decision)
    console.log("  Reason:", result.reason)
    expect(result.decision).toBe("approve")
  })

  it("should warn about mixed naming conventions", async () => {
    const diff = `
+ const userName = "test"
+ const user_name = "test"
+ const getUser = () => {}
+ const get_user = () => {}
+ const camelCase = true
+ const snake_case = true
+ const anotherCamel = true
+ const another_snake = true
+ const moreCamelCase = true
+ const more_snake_case = true
+ const finalCamel = true
+ const final_snake = true
`
    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service
      return yield* judge.evaluate({
        diff,
        changedFiles: ["naming.ts"],
      })
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    console.log("✓ Consistency check:", result.decision)
    console.log("  Reason:", result.reason)
    expect(result.decision).toBe("warn")
  })
})
