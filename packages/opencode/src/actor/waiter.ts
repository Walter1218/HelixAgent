import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer, Deferred } from "effect"

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

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const wait = Effect.fn("ActorWaiter.wait")(function* (input: { actorID: string; timeoutMs?: number }) {
      const timeout = input.timeoutMs ?? 60_000
      
      return {
        status: "unknown" as const,
        actor_id: input.actorID,
      }
    })

    const status = Effect.fn("ActorWaiter.status")(function* (input: { actorID: string }) {
      return {
        status: "unknown" as const,
        actor_id: input.actorID,
      }
    })

    return Service.of({ wait, status })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as ActorWaiter from "./waiter"
