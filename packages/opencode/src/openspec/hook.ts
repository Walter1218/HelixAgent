import { Effect, Context, Layer } from "effect"
import { OpenSpec, type SpecDoc } from "./spec"
import { OpenSpecJudge } from "./judge"

export interface SpecCheckResult {
  readonly affectedSpecs: SpecDoc[]
  readonly results: Array<{
    readonly spec: SpecDoc
    readonly approved: boolean
    readonly missingRequirements: string[]
  }>
  readonly allApproved: boolean
}

export interface Interface {
  readonly checkAfterToolCall: (toolName: string, filePath?: string) => Effect.Effect<SpecCheckResult, Error>
  readonly checkSpec: (specPath: string) => Effect.Effect<SpecCheckResult, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenSpecHook") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const openSpec = yield* OpenSpec.Service
    const judge = yield* OpenSpecJudge.Service

    const checkAfterToolCall = Effect.fn("OpenSpecHook.checkAfterToolCall")(function* (
      toolName: string,
      filePath?: string,
    ) {
      const allSpecs = yield* openSpec.parseAllSpecs()

      const affectedSpecs = allSpecs.filter((spec) => {
        if (filePath && spec.filePath.includes(filePath)) return true
        return spec.requirements.some((req) =>
          req.verification.target.includes(filePath ?? "") ||
          req.description.toLowerCase().includes(toolName.toLowerCase()),
        )
      })

      if (affectedSpecs.length === 0) {
        return { affectedSpecs: [], results: [], allApproved: true }
      }

      const results: SpecCheckResult["results"] = []
      for (const spec of affectedSpecs) {
        const result = yield* judge.judgeSpecCompliance(spec)
        results.push({
          spec,
          approved: result.approved,
          missingRequirements: result.missingRequirements,
        })
      }

      return {
        affectedSpecs,
        results,
        allApproved: results.every((r) => r.approved),
      }
    })

    const checkSpec = Effect.fn("OpenSpecHook.checkSpec")(function* (specPath: string) {
      const spec = yield* openSpec.parseSpecFile(specPath)
      const result = yield* judge.judgeSpecCompliance(spec)
      return {
        affectedSpecs: [spec],
        results: [{
          spec,
          approved: result.approved,
          missingRequirements: result.missingRequirements,
        }],
        allApproved: result.approved,
      }
    })

    return Service.of({ checkAfterToolCall, checkSpec })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(OpenSpec.defaultLayer),
    Layer.provide(OpenSpecJudge.defaultLayer),
  ),
)

export * as OpenSpecHook from "./hook"
