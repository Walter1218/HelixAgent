import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionStatus } from "./status"
import { spawnRef } from "@/actor/spawn-ref"
import type { SessionID } from "./schema"

export interface Interface {
  readonly tryStartCheckpointWriter: (sessionID: SessionID) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionCheckpoint") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const status = yield* SessionStatus.Service

    const tryStartCheckpointWriter = Effect.fn("SessionCheckpoint.tryStartCheckpointWriter")(
      function* (sessionID: SessionID) {
        const sessionStatus = yield* status.get(sessionID)
        if (sessionStatus.type !== "idle") return
        if (!spawnRef.current) return

        yield* spawnRef.current.spawn({
          mode: "subagent",
          sessionID,
          agentType: "checkpoint-writer",
          task: "Write checkpoint for current session",
          context: "state",
          tools: "INHERIT",
          background: true,
        })
      }
    )

    return Service.of({ tryStartCheckpointWriter })
  })
)

export const defaultLayer = layer.pipe(Layer.provide(SessionStatus.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [SessionStatus.node] })

export * as SessionCheckpoint from "./checkpoint"
