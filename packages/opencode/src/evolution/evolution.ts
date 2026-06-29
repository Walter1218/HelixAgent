import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { FSUtil } from "@opencode-ai/core/fs-util"
import path from "path"
import { Trace } from "@/trace/trace"

export interface TraceEvent {
  id: string
  parentId?: string
  type: "node_start" | "node_end" | "action" | "decision" | "error"
  name: string
  status: "pending" | "success" | "failed"
  duration?: number
  metadata?: Record<string, unknown>
  timestamp: number
}

export interface DPOPair {
  chosen: TraceEvent[]
  rejected: TraceEvent[]
  reason: string
}

export interface EvolutionConfig {
  enabled: boolean
  autoExport: boolean
  exportIntervalDays: number
  minTraceCount: number
}

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  enabled: true,
  autoExport: true,
  exportIntervalDays: 1,
  minTraceCount: 10,
}

export function matchPairs(traces: TraceEvent[]): DPOPair[] {
  const pairs: DPOPair[] = []
  const successes = traces.filter(t => t.status === "success" && t.type === "action")
  const failures = traces.filter(t => t.status === "failed" && t.type === "action")

  for (const success of successes) {
    for (const failure of failures) {
      if (success.name === failure.name) {
        pairs.push({
          chosen: [success],
          rejected: [failure],
          reason: `Same tool "${success.name}" with different outcomes`,
        })
      }
    }
  }

  return pairs
}

export function filterDirtyTraces(traces: TraceEvent[]): TraceEvent[] {
  const DIRTY_PATTERNS = [
    /timeout/i,
    /out\s+of\s+memory/i,
    /rate\s*limit/i,
    /quota\s*exceeded/i,
    /model\s*overloaded/i,
  ]

  return traces.filter(trace => {
    if (trace.status !== "failed") return true
    const error = String(trace.metadata?.error || "")
    return !DIRTY_PATTERNS.some(pattern => pattern.test(error))
  })
}

export function exportToJsonl(pairs: DPOPair[]): string {
  return pairs.map(pair => JSON.stringify(pair)).join("\n")
}

export interface ExportResult {
  readonly sessionID: string
  readonly traceCount: number
  readonly pairCount: number
  readonly outputPath: string | undefined
}

export interface Interface {
  readonly matchPairs: (traces: TraceEvent[]) => Effect.Effect<DPOPair[]>
  readonly filterDirty: (traces: TraceEvent[]) => Effect.Effect<TraceEvent[]>
  readonly exportToJsonl: (pairs: DPOPair[]) => Effect.Effect<string>
  readonly exportSession: (sessionID: string) => Effect.Effect<ExportResult, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Evolution") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const trace = yield* Trace.Service

    const exportSession = Effect.fn("Evolution.exportSession")(function* (sessionID: string) {
      const traces = yield* trace.getTraces(sessionID)

      if (traces.length < DEFAULT_EVOLUTION_CONFIG.minTraceCount) {
        return { sessionID, traceCount: traces.length, pairCount: 0, outputPath: undefined }
      }

      const cleanTraces = filterDirtyTraces(traces)
      const pairs = matchPairs(cleanTraces)

      if (pairs.length === 0) {
        return { sessionID, traceCount: traces.length, pairCount: 0, outputPath: undefined }
      }

      const jsonl = exportToJsonl(pairs)
      const outputDir = path.join(process.cwd(), ".dogfooding", "dpo_pairs")
      yield* fs.ensureDir(outputDir)

      const date = new Date().toISOString().split("T")[0]
      const outputPath = path.join(outputDir, `${date}.jsonl`)

      const existing = yield* fs.readFileStringSafe(outputPath).pipe(
        Effect.catch(() => Effect.succeed(undefined)),
      )
      const content = existing ? `${existing}\n${jsonl}` : jsonl
      yield* fs.writeWithDirs(outputPath, content)

      return { sessionID, traceCount: traces.length, pairCount: pairs.length, outputPath }
    })

    return Service.of({
      matchPairs: (traces) => Effect.succeed(matchPairs(traces)),
      filterDirty: (traces) => Effect.succeed(filterDirtyTraces(traces)),
      exportToJsonl: (pairs) => Effect.succeed(exportToJsonl(pairs)),
      exportSession,
    })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Trace.defaultLayer),
)

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [FSUtil.node, Trace.node] })

export * as Evolution from "./evolution"
