import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText } from "ai"

const apiKey = "REDACTED_MIMO_API_KEY"
const baseURL = "https://token-plan-cn.xiaomimimo.com/v1"

const provider = createOpenAICompatible({ name: "mimo", apiKey, baseURL })
const model = provider("mimo-v2.5-pro")

describe("LLM debug", () => {
  it("simple JSON extraction", async () => {
    const result = await generateText({
      model,
      system: "You are a helpful assistant. Always respond with valid JSON only, no markdown formatting.",
      prompt: `You are a requirements analyst. Decompose the user's request into clear, structured requirements.

User request: Add a hello world endpoint

Rules:
- Identify the core goal in one sentence.
- Break down into atomic, independently verifiable requirements.
- Mark each requirement as functional/non-functional/security/performance/ux/compatibility.
- Assign priority: must / should / nice-to-have.
- List constraints, assumptions, and open questions.
- Identify the domain (e.g., auth, ui, api, database, etc.)

Output strictly as JSON matching this schema:
{
  "coreGoal": "string",
  "requirementDrafts": [{"id": "string", "title": "string", "description": "string", "type": "functional|non-functional|security|performance|ux|compatibility", "priority": "must|should|nice-to-have", "dependencies": []}],
  "constraints": ["string"],
  "assumptions": ["string"],
  "openQuestions": ["string"],
  "domain": "string"
}`,
      maxTokens: 2000,
    })
    console.log("Raw response:", result.text)
    expect(result.text).toBeTruthy()

    // Try to parse JSON
    const jsonMatch = result.text.match(/(\{[\s\S]*\})/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1])
      console.log("Parsed:", JSON.stringify(parsed, null, 2))
      expect(parsed.coreGoal).toBeTruthy()
    }
  }, 60000)
})
