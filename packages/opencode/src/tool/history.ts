import * as Tool from "./tool"
import { Schema, Effect } from "effect"

export const Parameters = Schema.Struct({
  operation: Schema.Literals(["search", "around"]),
  query: Schema.optional(Schema.String),
  scope: Schema.optional(Schema.Literals(["project", "global"])),
  session_id: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.Array(Schema.String)),
  tool_name: Schema.optional(Schema.String),
  time_after: Schema.optional(Schema.Number),
  time_before: Schema.optional(Schema.Number),
  limit: Schema.optional(Schema.Number),
  message_id: Schema.optional(Schema.String),
  before: Schema.optional(Schema.Number),
  after: Schema.optional(Schema.Number),
})

export const HistoryTool = Tool.define(
  "history",
  Effect.gen(function* () {
    return {
      description: "Search historical sessions and conversations.",
      parameters: Parameters,
      execute: (_params, _ctx) =>
        Effect.gen(function* () {
          return { title: "not implemented", output: "History search is not yet implemented", metadata: {} }
        }),
    }
  }),
)
