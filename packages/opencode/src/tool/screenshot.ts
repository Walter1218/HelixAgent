import * as Tool from "./tool"
import { Schema, Effect } from "effect"

export const Parameters = Schema.Struct({
  description: Schema.optional(Schema.String),
  include_annotations: Schema.optional(Schema.Boolean),
})

export const ScreenshotTool = Tool.define(
  "screenshot",
  Effect.gen(function* () {
    return {
      description: "Capture a screenshot of the current desktop or active browser window and analyze it.",
      parameters: Parameters,
      execute: (_params, _ctx) =>
        Effect.gen(function* () {
          return { title: "not implemented", output: "Screenshot capture is not yet implemented", metadata: {} }
        }),
    }
  }),
)
