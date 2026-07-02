import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Trace } from "@/trace/trace"
import type { CardinalDecision } from "@/session/cardinal"

export type RollbackType = "none" | "revert-last-tool" | "revert-all-changes" | "abort-session"

export interface RollbackStrategy {
  type: RollbackType
  trigger: "cardinal_block" | "cardinal_stop" | "openspec_violation" | "manual"
  reason: string
  userConfirm: boolean
}

export interface RollbackResult {
  strategy: RollbackStrategy
  executed: boolean
  revertedFiles: string[]
  error?: string
}

export interface Interface {
  readonly evaluate: (decision: CardinalDecision | { type: string; reason: string }) => Effect.Effect<RollbackStrategy>
  readonly execute: (strategy: RollbackStrategy, sessionID: string) => Effect.Effect<RollbackResult>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Rollback") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const trace = yield* Trace.Service

    const evaluate = Effect.fn("Rollback.evaluate")(function* (decision) {
      // Determine rollback strategy based on decision
      if ("level" in decision) {
        // CardinalDecision
        switch (decision.level) {
          case "block":
            return {
              type: "revert-last-tool" as RollbackType,
              trigger: "cardinal_block" as const,
              reason: decision.reason,
              userConfirm: false,
            }
          case "stop":
            return {
              type: "abort-session" as RollbackType,
              trigger: "cardinal_stop" as const,
              reason: decision.reason,
              userConfirm: true,
            }
          default:
            return {
              type: "none" as RollbackType,
              trigger: "cardinal_block" as const,
              reason: decision.reason,
              userConfirm: false,
            }
        }
      }

      // OpenSpec violation
      return {
        type: "revert-last-tool" as RollbackType,
        trigger: "openspec_violation" as const,
        reason: decision.reason,
        userConfirm: false,
      }
    })

    const execute = Effect.fn("Rollback.execute")(function* (strategy, sessionID) {
      if (strategy.type === "none") {
        return { strategy, executed: false, revertedFiles: [] }
      }

      yield* trace.emit({
        id: `rollback-${Date.now()}`,
        type: "decision",
        name: `rollback.${strategy.type}`,
        status: "success",
        metadata: {
          sessionID,
          trigger: strategy.trigger,
          reason: strategy.reason,
        },
      })

      // In a real implementation, this would:
      // - revert-last-tool: use SessionRevert to undo the last tool call
      // - revert-all-changes: use Git to reset to the last clean state
      // - abort-session: stop the session and notify the user

      return {
        strategy,
        executed: true,
        revertedFiles: [],
      }
    })

    return Service.of({ evaluate, execute })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Trace.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [Trace.node] })

export * as Rollback from "./rollback"
