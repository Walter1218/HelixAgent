import * as Tool from "./tool"
import { Schema, Effect } from "effect"

export const Parameters = Schema.Struct({
  operation: Schema.optional(Schema.Literals(["search"])),
  query: Schema.String,
  scope: Schema.optional(Schema.Literals(["global", "projects", "sessions"])),
  scope_id: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
})

export const MemoryTool = Tool.define(
  "memory",
  Effect.gen(function* () {
    return {
      description: "Search persistent memory across sessions, projects, and global knowledge.",
      parameters: Parameters,
      execute: (_params, _ctx) =>
        Effect.gen(function* () {
          return { title: "not implemented", output: "Memory search is not yet implemented", metadata: {} }
        }),
    }
  }),
)
