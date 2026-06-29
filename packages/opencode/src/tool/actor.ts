import * as Tool from "./tool"
import { Schema, Effect } from "effect"
import { ActorRegistry } from "@/actor/registry"
import { ActorSpawn } from "@/actor/spawn"
import { ActorWaiter } from "@/actor/waiter"

export const Parameters = Schema.Struct({
  operation: Schema.Literals(["run", "spawn", "status", "wait", "cancel", "send"]),
  subagent_type: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  prompt: Schema.optional(Schema.String),
  actor_id: Schema.optional(Schema.String),
  to_actor_id: Schema.optional(Schema.String),
  content: Schema.optional(Schema.String),
  timeout_ms: Schema.optional(Schema.Number),
})

export const ActorTool = Tool.define(
  "actor",
  Effect.gen(function* () {
    const actorRegistry = yield* ActorRegistry.Service
    const actorSpawn = yield* ActorSpawn.Service
    const actorWaiter = yield* ActorWaiter.Service

    return {
      description: "Spawn and manage subagents for parallel task execution.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx) =>
        Effect.gen(function* () {
          switch (params.operation) {
            case "spawn": {
              const actor = yield* actorSpawn.spawn({
                mode: "subagent",
                sessionID: ctx.sessionID,
                agentType: params.subagent_type ?? "build",
                task: params.prompt ?? "",
                description: params.description,
                context: "state",
                tools: "INHERIT",
                background: false,
              })
              yield* actorRegistry.register(actor)
              return { title: `Spawned ${actor.actorID}`, output: JSON.stringify(actor), metadata: {} }
            }
            case "status": {
              if (!params.actor_id) return { title: "error", output: "actor_id required", metadata: {} }
              const result = yield* actorWaiter.status({ actorID: params.actor_id })
              return { title: `Status: ${result.status}`, output: JSON.stringify(result), metadata: {} }
            }
            default:
              return { title: "unsupported", output: `Operation ${params.operation} not yet implemented`, metadata: {} }
          }
        }),
    }
  }),
)
