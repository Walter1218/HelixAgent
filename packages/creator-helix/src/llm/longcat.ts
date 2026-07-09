export * as LongCat from "./longcat"

import { Effect, Redacted, Schema } from "effect"

export interface CompletionResponse {
  readonly choices: ReadonlyArray<{
    readonly message: {
      readonly reasoning_content?: string
      readonly content?: string
    }
    readonly finish_reason: string
  }>
}

export const generateObject = (
  input: {
    readonly apiKey: Redacted.Redacted<string>
    readonly baseURL: string
    readonly model: string
    readonly system: string
    readonly prompt: string
    readonly schema: Schema.Schema<unknown>
    readonly maxTokens?: number
  },
): Effect.Effect<unknown, Error, never> =>
  Effect.gen(function* () {
    const schemaFields = Object.keys((input.schema as any).fields ?? {})
    const schemaHint = schemaFields.length > 0
      ? `\n\nReturn ONLY a JSON object with these fields: ${schemaFields.join(", ")}. No markdown, no explanation, just the JSON object.`
      : ""

    const response = yield* Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${input.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${Redacted.value(input.apiKey)}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: input.model,
            messages: [
              { role: "system", content: input.system + schemaHint },
              { role: "user", content: input.prompt },
            ],
            max_tokens: input.maxTokens ?? 2048,
          }),
        })
        return (await res.json()) as CompletionResponse
      },
      catch: (error) => new Error(`LongCat request failed: ${error}`),
    })

    const content = response.choices[0]?.message.content
    const reasoning = response.choices[0]?.message.reasoning_content

    const rawText = content || reasoning
    if (!rawText) {
      return yield* Effect.fail(new Error("LongCat returned empty content"))
    }

    const text = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()

    const json = yield* Effect.try({
      try: () => JSON.parse(text),
      catch: () => new Error(`LongCat output is not valid JSON: ${text}`),
    })

    return yield* Effect.try({
      try: () => Schema.decodeUnknownSync(input.schema as never)(json),
      catch: (error) => new Error(`LongCat output failed schema decode: ${error}`),
    })
  })
