import { Effect, Ref, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export const AUTO_DREAM_TITLE = "Auto Dream"
export const AUTO_DISTILL_TITLE = "Auto Distill"

export const DREAM_TASK = [
  "Run one automatic dream memory consolidation pass for the current project.",
  "",
  "Use the memory files as the working index and the raw opencode trajectory database as the source of truth.",
  "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
  "Consolidate only durable, verified information into project memory.",
].join("\n")

export const DISTILL_TASK = [
  "Run one automatic distill pass for the current project.",
  "",
  "Review the past month of sessions and identify repeated manual workflows worth packaging.",
  "Use the raw opencode trajectory database as the source of truth and memory files to spot cross-session patterns.",
  "Inventory existing skills, agents, and commands first so you reuse or extend instead of duplicating.",
  "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
  "Produce a compact shortlist, then create only the high-confidence missing assets.",
].join("\n")

export interface Interface {
  readonly shouldAutoDream: (intervalDays?: number) => Effect.Effect<boolean>
  readonly shouldAutoDistill: (intervalDays?: number) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AutoDream") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const lastDreamTime = yield* Ref.make(0)
    const lastDistillTime = yield* Ref.make(0)

    const shouldAutoDream = Effect.fn("AutoDream.shouldAutoDream")(function* (intervalDays = 7) {
      const now = Date.now()
      const last = yield* Ref.get(lastDreamTime)
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000
      if (now - last < intervalMs) return false
      yield* Ref.set(lastDreamTime, now)
      return true
    })

    const shouldAutoDistill = Effect.fn("AutoDream.shouldAutoDistill")(function* (intervalDays = 30) {
      const now = Date.now()
      const last = yield* Ref.get(lastDistillTime)
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000
      if (now - last < intervalMs) return false
      yield* Ref.set(lastDistillTime, now)
      return true
    })

    return Service.of({ shouldAutoDream, shouldAutoDistill })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as AutoDream from "./auto-dream"
