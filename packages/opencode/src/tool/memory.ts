import * as Tool from "./tool"
import DESCRIPTION from "./memory.txt"
import { Schema, Effect } from "effect"
import { Memory } from "@opencode-ai/core/memory/service"

export const Parameters = Schema.Struct({
  operation: Schema.optional(Schema.Literals(["search"])),
  query: Schema.String,
  scope: Schema.optional(Schema.Literals(["global", "projects", "sessions", "cc"])),
  scope_id: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
})

const DEFAULT_LIMIT = 10

export const MemoryTool = Tool.define(
  "memory",
  Effect.gen(function* () {
    const memory = yield* Memory.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.metadata({ title: `Memory "${params.query}"`, metadata: { scope: params.scope } })

          yield* ctx.ask({
            permission: "memory",
            patterns: [params.query],
            always: ["*"],
            metadata: {
              query: params.query,
              scope: params.scope,
              scope_id: params.scope_id,
              type: params.type,
              limit: params.limit,
            },
          })

          yield* memory.reconcile()

          const results = yield* memory.search({
            query: params.query,
            scope: params.scope,
            scope_id: params.scope_id,
            type: params.type,
            limit: params.limit ?? DEFAULT_LIMIT,
          })

          if (results.length === 0) {
            return { title: "No memories found", output: "No matching memories found.", metadata: { count: 0 } }
          }

          const output = [
            `Found ${results.length} memory entr${results.length === 1 ? "y" : "ies"}:`,
            "",
            ...results.map(
              (result) =>
                `- [${result.scope}${result.scope_id ? `/${result.scope_id}` : ""}/${result.type}] ${result.path}\n  ${result.snippet}`,
            ),
          ].join("\n")

          return {
            title: `Memory: ${params.query}`,
            output,
            metadata: { count: results.length },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
