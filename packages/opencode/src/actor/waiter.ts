import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"
import { ActorRegistry } from "./registry"
import type { Actor } from "./schema"

export interface WaitResult {
  status: "pending" | "running" | "idle" | "timeout" | "unknown"
  actor_id: string
  description?: string
  agent?: string
  background?: boolean
  turnCount?: number
  lastTurnTime?: number
  result?: string
  error?: string
  lastOutcome?: "success" | "failure" | "cancelled"
  reportedStatus?: "success" | "partial" | "failed" | "blocked"
  reportedSummary?: string
  time?: { created: number; updated: number; completed?: number }
}

export interface Interface {
  readonly wait: (input: { actorID: string; timeoutMs?: number }) => Effect.Effect<WaitResult>
  readonly status: (input: { actorID: string }) => Effect.Effect<WaitResult>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ActorWaiter") {}

function actorToResult(actor: Actor | undefined, actorID: string): WaitResult {
  if (!actor) {
    return { status: "unknown", actor_id: actorID }
  }

  return {
    status: actor.status,
    actor_id: actor.actorID,
    description: actor.description,
    agent: actor.agent,
    background: actor.background,
    turnCount: actor.turnCount,
    lastTurnTime: actor.lastTurnTime,
    error: actor.lastError,
    lastOutcome: actor.lastOutcome,
    time: actor.time,
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const registry = yield* ActorRegistry.Service

    const wait = Effect.fn("ActorWaiter.wait")(function* (input: { actorID: string; timeoutMs?: number }) {
      const deadline = Date.now() + (input.timeoutMs ?? 60_000)

      while (true) {
        const actor = yield* registry.get("", input.actorID)
        if (!actor) {
          return { status: "unknown" as const, actor_id: input.actorID }
        }

        if (actor.status === "idle") {
          return actorToResult(actor, input.actorID)
        }

        if (Date.now() >= deadline) {
          return { status: "timeout" as const, actor_id: input.actorID }
        }

        yield* Effect.sleep("500 millis")
      }
    })

    const status = Effect.fn("ActorWaiter.status")(function* (input: { actorID: string }) {
      const actor = yield* registry.get("", input.actorID)
      return actorToResult(actor, input.actorID)
    })

    return Service.of({ wait, status })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(ActorRegistry.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [ActorRegistry.node] })

export * as ActorWaiter from "./waiter"
