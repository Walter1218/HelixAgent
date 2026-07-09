import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { runReqAgent } from "@/spec-generation/req-agent"
import { runMergeAgent } from "@/spec-generation/merge-agent"
import { runReviewAgent } from "@/spec-generation/review-agent"

const apiKey = process.env.MIMO_API_KEY ?? ""
const baseURL = "https://token-plan-cn.xiaomimimo.com/v1"

const provider = createOpenAICompatible({ name: "mimo", apiKey, baseURL })
const model = provider("mimo-v2.5-pro")

const TIMEOUT = 120_000

describe("spec-generation LLM e2e (focused)", () => {
  it(
    "req-agent produces valid output",
    async () => {
      const result = await Effect.runPromise(
        runReqAgent(model, {
          userPrompt: "Add a health check endpoint",
          sessionHistory: [],
        }),
      )
      console.log("[req-agent]", JSON.stringify(result, null, 2))
      expect(result.coreGoal).toBeTruthy()
      expect(result.requirementDrafts.length).toBeGreaterThanOrEqual(1)
      expect(result.domain).toBeTruthy()
    },
    TIMEOUT,
  )

  it(
    "req → merge → review chain works",
    async () => {
      const program = Effect.gen(function* () {
        // Step 1: req-agent
        console.log("[1] req-agent...")
        const req = yield* runReqAgent(model, {
          userPrompt: "Add rate limiting middleware",
          sessionHistory: [],
        })
        console.log("  coreGoal:", req.coreGoal)
        console.log("  requirements:", req.requirementDrafts.length)

        // Step 2: merge-agent (with minimal arch context)
        console.log("[2] merge-agent...")
        const merge = yield* runMergeAgent(model, {
          reqOutput: req,
          archOutput: {
            projectType: "typescript",
            techStack: ["typescript", "express"],
            filesToModify: [],
            filesToCreate: [{ path: "src/middleware/rate-limit.ts", action: "create", description: "Rate limiter" }],
            modulesToReuse: [],
            interfaces: [],
            dataFlow: [],
            risks: [],
            conventions: [],
          },
          criteria: req.requirementDrafts.map((r) => ({
            requirementId: r.id,
            description: r.description,
            verification: { type: "grep" as const, target: `src/middleware/rate-limit.ts:${r.title}` },
            confidence: "medium" as const,
            explanation: "grep verification",
          })),
        })
        console.log("  spec length:", merge.specMarkdown.length)

        // Step 3: review-agent
        console.log("[3] review-agent...")
        const review = yield* runReviewAgent(model, {
          specMarkdown: merge.specMarkdown,
          config: { minScore: 50 },
        })
        console.log("  score:", review.score)
        console.log("  verdict:", review.verdict)
        console.log("  issues:", review.issues.length)

        return { req, merge, review }
      })

      const result = await Effect.runPromise(program)

      // Verify req-agent
      expect(result.req.coreGoal).toBeTruthy()
      expect(result.req.requirementDrafts.length).toBeGreaterThanOrEqual(1)

      // Verify merge-agent
      expect(result.merge.specMarkdown).toContain("#")
      expect(result.merge.specMarkdown).toContain("Requirement")

      // Verify review-agent
      expect(result.review.score).toBeGreaterThanOrEqual(0)
      expect(result.review.score).toBeLessThanOrEqual(100)
      expect(["approve", "revise", "reject"]).toContain(result.review.verdict)
      expect(result.review.issues).toBeInstanceOf(Array)
      expect(result.review.strengths).toBeInstanceOf(Array)
    },
    TIMEOUT * 3,
  )
})
