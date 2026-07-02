import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { OpenSpec, type SpecDoc, type SpecRequirement } from "./spec"
import { OpenSpecJudge } from "./judge"
import { Trace } from "@/trace/trace"

export interface RequirementResult {
  requirementId: string
  title: string
  approved: boolean
  verificationType: string
  verificationTarget: string
  output?: string
  error?: string
}

export interface SpecReport {
  specPath: string
  specTitle: string
  overallApproved: boolean
  requirementResults: RequirementResult[]
  missingRequirements: string[]
  achievedRequirements: string[]
  timestamp: number
}

export interface Interface {
  readonly generateReport: (specPath: string, sessionID: string) => Effect.Effect<SpecReport>
  readonly generateReportFromSpec: (spec: SpecDoc, sessionID: string) => Effect.Effect<SpecReport>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SpecReport") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const openSpec = yield* OpenSpec.Service
    const judge = yield* OpenSpecJudge.Service
    const trace = yield* Trace.Service

    const generateReportFromSpec = Effect.fn("SpecReport.generateReportFromSpec")(function* (
      spec: SpecDoc,
      sessionID: string,
    ) {
      const results: RequirementResult[] = []

      for (const req of spec.requirements) {
        const result = yield* openSpec.checkRequirement(req).pipe(
          Effect.catch(() => Effect.succeed(false)),
        )

        results.push({
          requirementId: req.id,
          title: req.title,
          approved: result,
          verificationType: req.verification.type,
          verificationTarget: req.verification.target,
        })
      }

      const report: SpecReport = {
        specPath: spec.filePath,
        specTitle: spec.title,
        overallApproved: results.every((r) => r.approved),
        requirementResults: results,
        missingRequirements: results.filter((r) => !r.approved).map((r) => r.requirementId),
        achievedRequirements: results.filter((r) => r.approved).map((r) => r.requirementId),
        timestamp: Date.now(),
      }

      // Trace the report generation
      yield* trace.emit({
        id: `spec-report-${Date.now()}`,
        type: "decision",
        name: "spec.report",
        status: report.overallApproved ? "success" : "failed",
        metadata: {
          sessionID,
          specTitle: spec.title,
          total: results.length,
          achieved: report.achievedRequirements.length,
          missing: report.missingRequirements.length,
        },
      })

      return report
    })

    const generateReport = Effect.fn("SpecReport.generateReport")(function* (
      specPath: string,
      sessionID: string,
    ) {
      const spec = yield* openSpec.parseSpecFile(specPath).pipe(Effect.orDie)
      return yield* generateReportFromSpec(spec, sessionID)
    })

    return Service.of({ generateReport, generateReportFromSpec })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(OpenSpec.defaultLayer),
  Layer.provide(OpenSpecJudge.defaultLayer),
  Layer.provide(Trace.defaultLayer),
)

export const node = LayerNode.make({
  service: Service,
  layer: defaultLayer,
  deps: [Trace.node],
})

export * as SpecReport from "./report"
