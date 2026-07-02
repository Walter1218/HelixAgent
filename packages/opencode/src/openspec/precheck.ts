import { Effect, Schema, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { OpenSpec, type SpecDoc } from "./spec"
import { Trace } from "@/trace/trace"
import path from "path"
import fs from "fs"

export const SpecViolation = Schema.Struct({
  specFile: Schema.String,
  specTitle: Schema.String,
  requirementId: Schema.String,
  requirementTitle: Schema.String,
  plannedFile: Schema.String,
  verificationType: Schema.String,
})
export type SpecViolation = Schema.Schema.Type<typeof SpecViolation>

export const PrecheckReport = Schema.Struct({
  affectedSpecs: Schema.Array(Schema.String),
  violations: Schema.Array(SpecViolation),
  hasViolations: Schema.Boolean,
  summary: Schema.String,
})
export type PrecheckReport = Schema.Schema.Type<typeof PrecheckReport>

export interface PrecheckInput {
  sessionID: string
  plannedFiles: string[]
}

export interface Interface {
  readonly precheck: (input: PrecheckInput) => Effect.Effect<PrecheckReport>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenSpecPrecheck") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const openSpec = yield* OpenSpec.Service
    const trace = yield* Trace.Service

    const precheck = Effect.fn("OpenSpecPrecheck.precheck")(function* (input: PrecheckInput) {
      // Find all spec files
      const specDir = path.join(process.cwd(), "openspec", "specs")
      let specFiles: string[] = []
      try {
        specFiles = fs.readdirSync(specDir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => path.join(specDir, f))
      } catch {
        // No spec directory
      }

      if (specFiles.length === 0) {
        return {
          affectedSpecs: [],
          violations: [],
          hasViolations: false,
          summary: "No spec files found",
        }
      }

      const violations: SpecViolation[] = []
      const affectedSpecs: string[] = []

      for (const specFile of specFiles) {
        const spec = yield* openSpec.parseSpecFile(specFile).pipe(
          Effect.catch(() => Effect.succeed(null)),
        )
        if (!spec) continue

        // Check if any planned file matches spec requirements
        for (const req of spec.requirements) {
          const verification = req.verification as { type: string; target: string }
          const target = verification.target

          for (const plannedFile of input.plannedFiles) {
            // Check if the planned file is referenced in the verification target
            if (target.includes(plannedFile) || plannedFile.includes(target.split(":")[0])) {
              if (!affectedSpecs.includes(specFile)) {
                affectedSpecs.push(specFile)
              }

              violations.push({
                specFile,
                specTitle: spec.title,
                requirementId: req.id,
                requirementTitle: req.title,
                plannedFile,
                verificationType: verification.type,
              })
            }
          }
        }
      }

      const report: PrecheckReport = {
        affectedSpecs,
        violations,
        hasViolations: violations.length > 0,
        summary: violations.length === 0
          ? "No spec violations detected"
          : `${violations.length} potential violation(s) in ${affectedSpecs.length} spec(s)`,
      }

      yield* trace.emit({
        id: `openspec-precheck-${Date.now()}`,
        type: "decision",
        name: "openspec.precheck",
        status: report.hasViolations ? "failed" : "success",
        metadata: { sessionID: input.sessionID, report },
      })

      return report
    })

    return Service.of({ precheck })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(OpenSpec.defaultLayer),
  Layer.provide(Trace.defaultLayer),
)

export const node = LayerNode.make({
  service: Service,
  layer: defaultLayer,
  deps: [Trace.node],
})

export * as OpenSpecPrecheck from "./precheck"
