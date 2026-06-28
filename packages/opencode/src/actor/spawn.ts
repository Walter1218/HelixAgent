import { Context, Effect, Layer } from "effect"
import { Bus } from "@/bus"
import { Log } from "@/util"
import { ActorRegistry } from "./registry"
import type { Actor, SpawnMode, ContextMode, Lifecycle, ToolWhitelist } from "./schema"
import type { SessionID, MessageID } from "@/session/schema"

const log = Log.create({ service: "actor.spawn" })

export const RETURN_FORMAT_INSTRUCTION = `**Status**: success | partial | failed | blocked
**Summary**: <one sentence describing what happened>

[actual deliverable content...]

**Files touched**: <paths or "(none)">
**Findings worth promoting**: <bullet list or "(none)">`

export interface SpawnInput {
  mode: SpawnMode
  sessionID: SessionID
  parentSessionID?: SessionID
  agentType: string
  task: string
  description?: string
  context: ContextMode
  tools: ToolWhitelist
  model?: { providerID: string; modelID: string }
  background: boolean
  parentActorID?: string
  task_id?: string
  cwd?: string
  lifecycle?: Lifecycle
}

export interface Interface {
  readonly spawn: (input: SpawnInput) => Effect.Effect<Actor>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ActorSpawn") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const registry = yield* ActorRegistry.Service

    const spawn = Effect.fn("ActorSpawn.spawn")(function* (input: SpawnInput) {
      const actorID = `${input.agentType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const now = Date.now()

      const actor: Actor = {
        sessionID: input.sessionID,
        actorID,
        mode: input.mode,
        parentActorID: input.parentActorID,
        status: "pending",
        lifecycle: input.lifecycle ?? "ephemeral",
        agent: input.agentType,
        description: input.description ?? input.task.slice(0, 100),
        contextMode: input.context,
        background: input.background,
        tools: input.tools,
        lastTurnTime: now,
        turnCount: 0,
        time: { created: now, updated: now },
      }

      yield* registry.register(actor)
      log.info("actor.spawned", { actorID, agent: input.agentType, mode: input.mode })

      return actor
    })

    return Service.of({ spawn })
  })
)

export const defaultLayer = layer.pipe(
  Layer.provide(Bus.defaultLayer),
  Layer.provide(ActorRegistry.defaultLayer),
)
