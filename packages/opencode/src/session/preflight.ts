import { Effect, Schema, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Cardinal, type CardinalDecision } from "./cardinal"
import { Trace } from "@/trace/trace"

export const CardinalRisk = Schema.Struct({
  level: Schema.Literals(["block", "pause", "stop", "warn"]),
  rule: Schema.String,
  reason: Schema.String,
})
export type CardinalRisk = Schema.Schema.Type<typeof CardinalRisk>

export const PreflightReport = Schema.Struct({
  risks: Schema.Array(CardinalRisk),
  recommendation: Schema.Literals(["proceed", "confirm", "abort"]),
  summary: Schema.String,
})
export type PreflightReport = Schema.Schema.Type<typeof PreflightReport>

export interface PreflightInput {
  sessionID: string
  plannedFiles?: string[]
  estimatedFileCount?: number
  hasDeleteOperations?: boolean
  hasExternalDependencies?: boolean
}

export interface Interface {
  readonly preflight: (input: PreflightInput) => Effect.Effect<PreflightReport>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/CardinalPreflight") {}

const CRITICAL_FILES = [
  /auth/i,
  /permission/i,
  /security/i,
  /\.env/,
  /config.*secret/i,
  /database.*schema/i,
  /migration/i,
  /ci\b/,
  /\.github\//,
]

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const cardinal = yield* Cardinal.Service
    const trace = yield* Trace.Service

    const preflight = Effect.fn("CardinalPreflight.preflight")(function* (input: PreflightInput) {
      const risks: CardinalRisk[] = []

      // Check for critical files
      if (input.plannedFiles) {
        for (const file of input.plannedFiles) {
          for (const pattern of CRITICAL_FILES) {
            if (pattern.test(file)) {
              risks.push({
                level: "pause",
                rule: "critical_file",
                reason: `Planned change to critical file: ${file}`,
              })
              break
            }
          }
        }
      }

      // Check for excessive file count
      if (input.estimatedFileCount && input.estimatedFileCount > 10) {
        risks.push({
          level: "pause",
          rule: "excessive_changes",
          reason: `Planned changes to ${input.estimatedFileCount} files (threshold: 10)`,
        })
      }

      // Check for delete operations
      if (input.hasDeleteOperations) {
        risks.push({
          level: "warn",
          rule: "delete_operations",
          reason: "Planned changes include file deletions",
        })
      }

      // Check for external dependency changes
      if (input.hasExternalDependencies) {
        risks.push({
          level: "warn",
          rule: "external_dependencies",
          reason: "Planned changes include external dependency modifications",
        })
      }

      // Determine recommendation
      const hasBlock = risks.some((r) => r.level === "block")
      const hasPause = risks.some((r) => r.level === "pause")

      const recommendation = hasBlock ? "abort" : hasPause ? "confirm" : "proceed"
      const summary = risks.length === 0
        ? "No risks detected"
        : `${risks.length} risk(s) detected: ${risks.map((r) => r.rule).join(", ")}`

      const report: PreflightReport = { risks, recommendation, summary }

      yield* trace.emit({
        id: `cardinal-preflight-${Date.now()}`,
        type: "decision",
        name: "cardinal.preflight",
        status: hasBlock ? "failed" : "success",
        metadata: { sessionID: input.sessionID, report },
      })

      return report
    })

    return Service.of({ preflight })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Cardinal.defaultLayer),
  Layer.provide(Trace.defaultLayer),
)

export const node = LayerNode.make({
  service: Service,
  layer: defaultLayer,
  deps: [Cardinal.node, Trace.node],
})

export * as CardinalPreflight from "./preflight"
