import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"
import { Actor, SpawnMode, ContextMode, Lifecycle, ToolWhitelist } from "./schema"

export const RETURN_FORMAT_INSTRUCTION = `**Status**: success | partial | failed | blocked
**Summary**: <one sentence describing what happened>

[actual deliverable content...]

**Files touched**: <paths or "(none)">
**Findings worth promoting**: <bullet list or "(none)">`

export interface SpawnInput {
  mode: SpawnMode
  sessionID: string
  parentSessionID?: string
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

      return actor
    })

    return Service.of({ spawn })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as ActorSpawn from "./spawn"
