import { Context, Effect, Layer, Ref } from "effect"
import { Bus } from "@/bus"
import { Database } from "@/storage"
import { Log } from "@/util"
import { Actor, ActorStatus, ActorOutcome } from "./schema"
import { ActorRegistered, ActorStatusChanged, ActorStuck } from "./events"
import type { SessionID } from "@/session/schema"

const log = Log.create({ service: "actor.registry" })

const SCAN_INTERVAL_MS = 60_000
const STUCK_THRESHOLD_MS = 5 * 60 * 1000

export interface Interface {
  readonly register: (actor: Actor) => Effect.Effect<void>
  readonly updateStatus: (sessionID: SessionID, actorID: string, update: { status: ActorStatus; lastOutcome?: ActorOutcome; lastError?: string }) => Effect.Effect<void>
  readonly get: (sessionID: SessionID, actorID: string) => Effect.Effect<Actor | undefined>
  readonly listBySession: (sessionID: SessionID) => Effect.Effect<Actor[]>
  readonly listActive: () => Effect.Effect<Actor[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ActorRegistry") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const actors = yield* Ref.make(new Map<string, Actor>())

    const register = Effect.fn("ActorRegistry.register")(function* (actor: Actor) {
      yield* Ref.update(actors, (map) => {
        map.set(actor.actorID, actor)
        return map
      })
      log.info("actor.registered", { actorID: actor.actorID, agent: actor.agent, mode: actor.mode })
      yield* bus.publish(ActorRegistered, {
        sessionID: actor.sessionID,
        actorID: actor.actorID,
        mode: actor.mode,
        parentActorID: actor.parentActorID,
        description: actor.description,
        agent: actor.agent,
        background: actor.background,
      }).pipe(Effect.catch(() => Effect.void))
    })

    const updateStatus = Effect.fn("ActorRegistry.updateStatus")(function* (
      sessionID: SessionID,
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
      log.info("actor.status_changed", { actorID, status: update.status, outcome: update.lastOutcome })
      yield* bus.publish(ActorStatusChanged, {
        sessionID,
        actorID,
        status: update.status,
        lastOutcome: update.lastOutcome,
        turnCount: 0,
        lastTurnTime: Date.now(),
        error: update.lastError,
      }).pipe(Effect.catch(() => Effect.void))
    })

    const get = Effect.fn("ActorRegistry.get")(function* (sessionID: SessionID, actorID: string) {
      const map = yield* Ref.get(actors)
      return map.get(actorID)
    })

    const listBySession = Effect.fn("ActorRegistry.listBySession")(function* (sessionID: SessionID) {
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

export const defaultLayer = layer.pipe(Layer.provide(Bus.defaultLayer))
