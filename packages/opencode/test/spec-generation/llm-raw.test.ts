import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText } from "ai"
import { runReqAgent } from "@/spec-generation/req-agent"

const apiKey = "REDACTED_MIMO_API_KEY"
const baseURL = "https://token-plan-cn.xiaomimimo.com/v1"

const provider = createOpenAICompatible({ name: "mimo", apiKey, baseURL })
const model = provider("mimo-v2.5-pro")

describe("LLM raw call test", () => {
  it("basic generateText works", async () => {
    const result = await generateText({
      model,
      prompt: "Say hello in JSON format: {\"message\":\"hello\"}",
      maxTokens: 100,
    })
    console.log("Raw response:", result.text)
    expect(result.text).toBeTruthy()
  }, 30000)

  it("req-agent with simple prompt", async () => {
    const program = Effect.gen(function* () {
      console.log("Starting req-agent...")
      const result = yield* runReqAgent(model, {
        userPrompt: "Add a hello world endpoint",
        sessionHistory: [],
      })
      console.log("Result:", JSON.stringify(result, null, 2))
      expect(result.coreGoal).toBeTruthy()
    })
    await Effect.runPromise(program)
  }, 60000)
})
