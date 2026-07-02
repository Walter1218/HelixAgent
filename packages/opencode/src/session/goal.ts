import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer, Context } from "effect"
import z from "zod"

export type GoalVerdict = {
  ok: boolean
  impossible?: boolean
  reason: string
}

export type Goal = {
  condition: string
  react: number
  verdict?: GoalVerdict
}

export const Verdict = z.object({
  ok: z.boolean(),
  impossible: z.boolean().optional(),
  reason: z.string(),
})
export type Verdict = z.infer<typeof Verdict>

export const Event = {
  Updated: {
    type: "session.goal",
    properties: z.object({
      sessionID: z.string(),
      goal: z.object({ condition: z.string() }).optional(),
      lastVerdict: Verdict.extend({
        attempt: z.number(),
        messageID: z.string().optional(),
        error: z.boolean().optional(),
      }).optional(),
    }),
  },
}

export interface Interface {
  readonly set: (sessionID: string, condition: string) => Effect.Effect<void>
  readonly get: (sessionID: string) => Effect.Effect<Goal | undefined>
  readonly clear: (sessionID: string) => Effect.Effect<void>
  readonly bumpReact: (sessionID: string) => Effect.Effect<number>
  readonly setVerdict: (sessionID: string, verdict: GoalVerdict) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionGoal") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const goals = new Map<string, Goal>()

    const set = Effect.fn("SessionGoal.set")(function* (sessionID: string, condition: string) {
      goals.set(sessionID, { condition, react: 0 })
    })

    const get = Effect.fn("SessionGoal.get")(function* (sessionID: string) {
      return goals.get(sessionID)
    })

    const clear = Effect.fn("SessionGoal.clear")(function* (sessionID: string) {
      goals.delete(sessionID)
    })

    const bumpReact = Effect.fn("SessionGoal.bumpReact")(function* (sessionID: string) {
      const goal = goals.get(sessionID)
      if (!goal) return 0
      goal.react += 1
      return goal.react
    })

    const setVerdict = Effect.fn("SessionGoal.setVerdict")(function* (sessionID: string, verdict: GoalVerdict) {
      const goal = goals.get(sessionID)
      if (!goal) return
      goal.verdict = verdict
    })

    return Service.of({ set, get, clear, bumpReact, setVerdict })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as Goal from "./goal"
