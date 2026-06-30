import * as Tool from "./tool"
import DESCRIPTION from "./actor.txt"
import { Schema, Effect } from "effect"
import { ActorRegistry } from "@/actor/registry"
import { ActorSpawn } from "@/actor/spawn"
import { ActorWaiter } from "@/actor/waiter"
import type { Actor } from "@/actor/schema"

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

type ActorMetadata = {
  actor_id?: string
  status?: string
}

function metadata(input: { actor_id?: string; status?: string }): ActorMetadata {
  return input
}

function formatActor(actor: Actor) {
  return JSON.stringify(actor)
}

export const ActorTool = Tool.define<
  typeof Parameters,
  ActorMetadata,
  ActorRegistry.Service | ActorSpawn.Service | ActorWaiter.Service
>(
  "actor",
  Effect.gen(function* () {
    const actorRegistry = yield* ActorRegistry.Service
    const actorSpawn = yield* ActorSpawn.Service
    const actorWaiter = yield* ActorWaiter.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<ActorMetadata>) =>
        Effect.gen(function* () {
          switch (params.operation) {
            case "run":
            case "spawn": {
              yield* ctx.ask({
                permission: "actor",
                patterns: [params.subagent_type ?? "build", params.prompt ?? ""],
                always: ["*"],
                metadata: {
                  operation: params.operation,
                  subagent_type: params.subagent_type,
                  description: params.description,
                  prompt: params.prompt,
                },
              })

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
              return {
                title: `Spawned ${actor.actorID}`,
                output: formatActor(actor),
                metadata: metadata({ actor_id: actor.actorID, status: actor.status }),
              }
            }

            case "status": {
              if (!params.actor_id) {
                return { title: "error", output: "actor_id required", metadata: metadata({}) }
              }
              const result = yield* actorWaiter.status({ actorID: params.actor_id })
              return {
                title: `Status: ${result.status}`,
                output: JSON.stringify(result),
                metadata: metadata({ actor_id: params.actor_id, status: result.status }),
              }
            }

            case "wait": {
              if (!params.actor_id) {
                return { title: "error", output: "actor_id required", metadata: metadata({}) }
              }
              const result = yield* actorWaiter.wait({ actorID: params.actor_id, timeoutMs: params.timeout_ms })
              return {
                title: `Wait result: ${result.status}`,
                output: JSON.stringify(result),
                metadata: metadata({ actor_id: params.actor_id, status: result.status }),
              }
            }

            case "cancel": {
              if (!params.actor_id) {
                return { title: "error", output: "actor_id required", metadata: metadata({}) }
              }
              const actor = yield* actorRegistry.get(ctx.sessionID, params.actor_id)
              if (!actor) {
                return {
                  title: "not found",
                  output: `Actor ${params.actor_id} not found`,
                  metadata: metadata({ actor_id: params.actor_id }),
                }
              }
              yield* actorRegistry.updateStatus(ctx.sessionID, params.actor_id, {
                status: "idle",
                lastOutcome: "cancelled",
              })
              return {
                title: "actor cancelled",
                output: `Actor ${params.actor_id} cancelled.`,
                metadata: metadata({ actor_id: params.actor_id, status: "cancelled" }),
              }
            }

            case "send": {
              const targetID = params.to_actor_id ?? params.actor_id
              if (!targetID) {
                return { title: "error", output: "actor_id or to_actor_id required", metadata: metadata({}) }
              }
              const actor = yield* actorRegistry.get(ctx.sessionID, targetID)
              if (!actor) {
                return {
                  title: "not found",
                  output: `Actor ${targetID} not found`,
                  metadata: metadata({ actor_id: targetID }),
                }
              }
              yield* actorRegistry.updateStatus(ctx.sessionID, targetID, {
                status: actor.status === "pending" ? "running" : actor.status,
                lastError: params.content,
              })
              return {
                title: "message sent",
                output: `Sent message to actor ${targetID}.`,
                metadata: metadata({ actor_id: targetID, status: actor.status }),
              }
            }
          }
        }).pipe(Effect.orDie),
    }
  }),
)
