import { Effect, Schema } from "effect"
import { generateText } from "ai"
import type { LanguageModelV3 } from "@ai-sdk/provider"

export class AgentOutputParseError {
  readonly _tag = "AgentOutputParseError"
  constructor(
    readonly agentName: string,
    readonly message: string,
  ) {}
}

export function callStructuredAgent<I, O>(
  name: string,
  prompt: (input: I) => string,
  schema: Schema.Schema<O>,
  model: LanguageModelV3,
  input: I,
  system?: string,
): Effect.Effect<O, AgentOutputParseError> {
  const decode = Schema.decodeUnknownSync(schema as any) as (input: unknown) => O

  return Effect.gen(function* () {
    const fullPrompt = prompt(input)

    const result = yield* Effect.tryPromise({
      try: () =>
        generateText({
          model,
          system: system ?? "You are a helpful assistant. Always respond with valid JSON only, no markdown formatting.",
          prompt: fullPrompt,
        }).then((r) => r.text),
      catch: (e) => new AgentOutputParseError(name, `LLM call failed: ${String(e)}`),
    })

    // Extract JSON from response (handle markdown code blocks)
    const jsonStr = extractJson(result)

    const parsed: unknown = yield* Effect.try({
      try: () => JSON.parse(jsonStr),
      catch: (e) => {
        console.log("[llm-call] JSON parse failed. Raw text:", result.slice(0, 1000))
        console.log("[llm-call] Extracted JSON:", jsonStr.slice(0, 500))
        return new AgentOutputParseError(name, `JSON parse failed: ${String(e)}. Raw: ${result.slice(0, 500)}`)
      },
    })

    const decoded = yield* Effect.try({
      try: () => decode(parsed),
      catch: (e) => {
        console.log("[llm-call] Schema decode failed. Parsed:", JSON.stringify(parsed).slice(0, 500))
        return new AgentOutputParseError(name, `Schema decode failed: ${String(e)}`)
      },
    })
    return decoded
  })
}

function extractJson(text: string): string {
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()

  // Try to find JSON object/array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) return jsonMatch[1].trim()

  // Return as-is
  return text.trim()
}

export function runAgentWithRetry<I, O>(
  name: string,
  prompt: (input: I) => string,
  schema: Schema.Schema<O>,
  model: LanguageModelV3,
  input: I,
  system?: string,
  maxRetries = 2,
): Effect.Effect<O, AgentOutputParseError> {
  return callStructuredAgent(name, prompt, schema, model, input, system).pipe(
    Effect.retry({
      times: maxRetries,
      while: (error) => error._tag === "AgentOutputParseError",
    }),
  )
}
