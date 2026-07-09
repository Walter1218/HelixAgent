export * as SeedDream from "./index"

import { Effect } from "effect"
import { SeedDreamModelId, SeedDreamDefaultWidth, SeedDreamDefaultHeight, SeedDanceApiKey } from "../config"

export interface ImageGenOptions {
  readonly prompt: string
  readonly negativePrompt?: string
  readonly width?: number
  readonly height?: number
  readonly seed?: number
  readonly responseFormat?: "url" | "b64_json"
}

export interface ImageGenResult {
  readonly url: string
  readonly width: number
  readonly height: number
  readonly seed: number
}

export const generateImage = (options: ImageGenOptions): Effect.Effect<ImageGenResult, Error> =>
  Effect.gen(function* () {
    const apiKey = yield* SeedDanceApiKey
    const model = yield* SeedDreamModelId
    const width = options.width ?? 1024
    const height = options.height ?? 1024

    const body = {
      model,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      size: `${width}x${height}`,
      seed: options.seed ?? -1,
      response_format: options.responseFormat ?? "url",
    }

    const res = yield* Effect.tryPromise({
      try: () => fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      catch: (e) => new Error(`SeedDream fetch failed: ${e}`),
    })

    if (!res.ok) {
      const text = yield* Effect.tryPromise(() => res.text())
      return yield* Effect.fail(new Error(`SeedDream API error: ${res.status} ${text}`))
    }

    const data = yield* Effect.tryPromise(() => res.json() as Promise<{ data: Array<{ url: string; width?: number; height?: number; seed?: number }> }>)
    const item = data.data[0]
    if (!item) return yield* Effect.fail(new Error("SeedDream returned no images"))

    return {
      url: item.url,
      width: item.width ?? width,
      height: item.height ?? height,
      seed: item.seed ?? -1,
    }
  })

export const generatePortrait = (prompt: string, width = 720, height = 1280) =>
  generateImage({ prompt, width, height })

export const generateConceptArt = (prompt: string, width = 1920, height = 1080) =>
  generateImage({ prompt, width, height })

export const generatePropImage = (prompt: string, width = 1024, height = 1024) =>
  generateImage({ prompt, width, height })
