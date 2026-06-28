import { Context, Effect, Layer, Ref } from "effect"
import { Actor, ActorStatus, ActorOutcome } from "./schema"

export interface Interface {
  readonly register: (actor: Actor) => Effect.Effect<void>
  readonly updateStatus: (sessionID: string, actorID: string, update: { status: ActorStatus; lastOutcome?: ActorOutcome; lastError?: string }) => Effect.Effect<void>
  readonly get: (sessionID: string, actorID: string) => Effect.Effect<Actor | undefined>
  readonly listBySession: (sessionID: string) => Effect.Effect<Actor[]>
  readonly listActive: () => Effect.Effect<Actor[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ActorRegistry") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const actors = yield* Ref.make(new Map<string, Actor>())

    const register = Effect.fn("ActorRegistry.register")(function* (actor: Actor) {
      yield* Ref.update(actors, (map) => {
        map.set(actor.actorID, actor)
        return map
      })
    })

    const updateStatus = Effect.fn("ActorRegistry.updateStatus")(function* (
      sessionID: string,
      actorID: string,
      update: { status: ActorStatus; lastOutcome?: ActorOutcome; lastError?: string }
    ) {
      yield* Ref.update(actors, (map) => {
        const actor = map.get(actorID)
        if (actor) {
          map.set(actorID, {
            ...actor,
            status: update.status,
            lastOutcome: update.lastOutcome ?? actor.lastOutcome,
            lastError: update.lastError ?? actor.lastError,
            lastTurnTime: Date.now(),
            turnCount: update.status === "running" ? actor.turnCount + 1 : actor.turnCount,
            time: { ...actor.time, updated: Date.now() },
          })
        }
        return map
      })
    })

    const get = Effect.fn("ActorRegistry.get")(function* (sessionID: string, actorID: string) {
      const map = yield* Ref.get(actors)
      return map.get(actorID)
    })

    const listBySession = Effect.fn("ActorRegistry.listBySession")(function* (sessionID: string) {
      const map = yield* Ref.get(actors)
      return Array.from(map.values()).filter((a) => a.sessionID === sessionID)
    })

    const listActive = Effect.fn("ActorRegistry.listActive")(function* () {
      const map = yield* Ref.get(actors)
      return Array.from(map.values()).filter((a) => a.status === "running" || a.status === "pending")
    })

    return Service.of({ register, updateStatus, get, listBySession, listActive })
  })
)

export const defaultLayer = layer
