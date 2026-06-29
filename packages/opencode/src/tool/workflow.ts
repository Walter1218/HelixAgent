import * as Tool from "./tool"
import { Schema, Effect } from "effect"

export const Parameters = Schema.Struct({
  operation: Schema.Literals(["run", "status", "wait", "cancel", "resume"]),
  name: Schema.optional(Schema.String),
  script: Schema.optional(Schema.String),
  args: Schema.optional(Schema.Unknown),
  run_id: Schema.optional(Schema.String),
  timeout_ms: Schema.optional(Schema.Number),
})

export const WorkflowTool = Tool.define(
  "workflow",
  Effect.gen(function* () {
    return {
      description: "Run and manage workflows.",
      parameters: Parameters,
      execute: (_params, _ctx) =>
        Effect.gen(function* () {
          return { title: "not implemented", output: "Workflow execution is not yet implemented", metadata: {} }
        }),
    }
  }),
)
