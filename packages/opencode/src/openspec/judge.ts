import { Effect, Context, Layer } from "effect"
import { OpenSpec, type SpecDoc, type SpecRequirement } from "./spec"

export interface SpecJudgeResult {
  readonly approved: boolean
  readonly implementedRequirements: string[]
  readonly missingRequirements: string[]
  readonly issues: string[]
  readonly suggestions: string[]
}

export interface Interface {
  readonly judgeSpecCompliance: (spec: SpecDoc) => Effect.Effect<SpecJudgeResult, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenSpecJudge") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const openSpec = yield* OpenSpec.Service

    const judgeSpecCompliance = Effect.fn("OpenSpecJudge.judgeSpecCompliance")(function* (spec: SpecDoc) {
      const implementedRequirements: string[] = []
      const missingRequirements: string[] = []
      const issues: string[] = []
      const suggestions: string[] = []

      for (const req of spec.requirements) {
        const passed = yield* openSpec.checkRequirement(req)
        if (passed) {
          implementedRequirements.push(req.id)
        } else {
          missingRequirements.push(req.id)
          issues.push(`Requirement not implemented: ${req.id} - ${req.title}`)
        }
      }

      const approved = missingRequirements.length === 0

      if (!approved) {
        suggestions.push(`Review and implement ${missingRequirements.length} missing requirements`)
      }

      return {
        approved,
        implementedRequirements,
        missingRequirements,
        issues,
        suggestions,
      }
    })

    return Service.of({ judgeSpecCompliance })
  }),
)

export const defaultLayer = Layer.suspend(() => layer.pipe(Layer.provide(OpenSpec.defaultLayer)))

export * as OpenSpecJudge from "./judge"
