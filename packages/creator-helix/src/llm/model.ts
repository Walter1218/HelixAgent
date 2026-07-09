export * as LlmModel from "./model"

import { Config, Effect, Option, Redacted, Schema } from "effect"
import type { ToolSchema } from "@opencode-ai/llm"
import { LongCat } from "./longcat"

export const generateObject = (
  input: {
    readonly system: string
    readonly prompt: string
    readonly schema: ToolSchema<any>
    readonly maxTokens?: number
  },
): Effect.Effect<unknown, Error, never> =>
  Effect.gen(function* () {
    const longcatKey = yield* Effect.option(Config.redacted("LONGCAT_API_KEY"))
    if (Option.isNone(longcatKey)) {
      return yield* Effect.fail(new Error("No LLM API key configured. Set LONGCAT_API_KEY or OPENAI_API_KEY."))
    }

    const baseUrlOption = yield* Effect.option(Config.string("LONGCAT_BASE_URL"))
    const baseURL = Option.getOrElse(baseUrlOption, () => "https://api.longcat.chat/openai")
    return yield* LongCat.generateObject({
      apiKey: longcatKey.value,
      baseURL,
      model: "LongCat-2.0",
      system: input.system,
      prompt: input.prompt,
      schema: input.schema as Schema.Schema<unknown>,
      maxTokens: input.maxTokens,
    })
  })
