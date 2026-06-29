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

export * as Evolution from "./evolution"
