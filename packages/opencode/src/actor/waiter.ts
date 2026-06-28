import { Context, Effect, Layer, Deferred } from "effect"
import { Bus } from "@/bus"
import { Log } from "@/util"
import { ActorStatusChanged } from "./events"
import type { SessionID } from "@/session/schema"

const log = Log.create({ service: "actor.waiter" })

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
    const bus = yield* Bus.Service

    const wait = Effect.fn("ActorWaiter.wait")(function* (input: { actorID: string; timeoutMs?: number }) {
      const timeout = input.timeoutMs ?? 60_000
      log.info("actor.waiter.wait", { actorID: input.actorID, timeout })

      const deferred = yield* Deferred.make<WaitResult>()
      let resolved = false

      const unsubscribe = yield* bus.subscribeCallback(ActorStatusChanged, (event) => {
        if (event.properties.actorID === input.actorID && !resolved) {
          const status = event.properties.status
          if (status === "idle") {
            resolved = true
            Deferred.unsafeDone(deferred, Effect.succeed({
              status: "idle" as const,
              actor_id: input.actorID,
              lastOutcome: event.properties.lastOutcome,
              turnCount: event.properties.turnCount,
              lastTurnTime: event.properties.lastTurnTime,
              error: event.properties.error,
            }))
          }
        }
      })

      const result = yield* Deferred.await(deferred).pipe(
        Effect.timeout(timeout),
        Effect.catch(() => Effect.succeed({
          status: "timeout" as const,
          actor_id: input.actorID,
        })),
        Effect.ensuring(Effect.sync(unsubscribe)),
      )

      return result
    })

    const status = Effect.fn("ActorWaiter.status")(function* (input: { actorID: string }) {
      log.info("actor.waiter.status", { actorID: input.actorID })
      return {
        status: "unknown" as const,
        actor_id: input.actorID,
      }
    })

    return Service.of({ wait, status })
  })
)

export const defaultLayer = layer.pipe(Layer.provide(Bus.defaultLayer))
