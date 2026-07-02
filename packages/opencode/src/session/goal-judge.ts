import { Effect, Schema, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Goal } from "./goal"
import { Trace } from "@/trace/trace"

export const Verdict = Schema.Struct({
  ok: Schema.Boolean,
  impossible: Schema.optional(Schema.Boolean),
  reason: Schema.String,
  missingContext: Schema.optional(Schema.Array(Schema.String)),
})
export type Verdict = Schema.Schema.Type<typeof Verdict>

export interface PreflightInput {
  sessionID: string
  condition: string
  recentMessages?: string[]
}

export interface Interface {
  readonly preflight: (input: PreflightInput) => Effect.Effect<Verdict>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/GoalJudge") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const goal = yield* Goal.Service
    const trace = yield* Trace.Service

    const preflight = Effect.fn("GoalJudge.preflight")(function* (input: PreflightInput) {
      // If no goal is set, always ok
      if (!input.condition) {
        return { ok: true, reason: "No goal set" }
      }

      // Simple heuristic pre-check (no LLM call for now)
      // In the future, this could call an LLM to judge goal achievability
      const condition = input.condition.toLowerCase()

      // Check for obviously impossible goals
      const impossiblePatterns = [
        /impossible/,
        /cannot be done/,
        /not feasible/,
        /unreachable/,
      ]

      for (const pattern of impossiblePatterns) {
        if (pattern.test(condition)) {
          const verdict: Verdict = {
            ok: false,
            impossible: true,
            reason: `Goal appears impossible: ${input.condition}`,
          }

          yield* trace.emit({
            id: `goal-preflight-${Date.now()}`,
            type: "decision",
            name: "goal.preflight",
            status: "failed",
            metadata: { sessionID: input.sessionID, verdict },
          })

          return verdict
        }
      }

      // Check for missing context indicators
      const missingContextPatterns = [
        { pattern: /unclear|vague|ambiguous/, suggestion: "Clarify the specific requirements" },
        { pattern: /depends on|need to know/, suggestion: "Provide dependency information" },
      ]

      const missingContext: string[] = []
      for (const { pattern, suggestion } of missingContextPatterns) {
        if (pattern.test(condition)) {
          missingContext.push(suggestion)
        }
      }

      const verdict: Verdict = {
        ok: true,
        reason: "Goal appears achievable",
        missingContext: missingContext.length > 0 ? missingContext : undefined,
      }

      yield* trace.emit({
        id: `goal-preflight-${Date.now()}`,
        type: "decision",
        name: "goal.preflight",
        status: "success",
        metadata: { sessionID: input.sessionID, verdict },
      })

      return verdict
    })

    return Service.of({ preflight })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Goal.defaultLayer),
  Layer.provide(Trace.defaultLayer),
)

export const node = LayerNode.make({
  service: Service,
  layer: defaultLayer,
  deps: [Goal.node, Trace.node],
})

export * as GoalJudge from "./goal-judge"
