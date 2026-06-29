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

export interface TraceConfig {
  enabled: boolean
  samplingEnabled: boolean
  samplingRate: number
  maxTraces: number
  retentionDays: number
}

export const DEFAULT_TRACE_CONFIG: TraceConfig = {
  enabled: true,
  samplingEnabled: false,
  samplingRate: 1.0,
  maxTraces: 10000,
  retentionDays: 7,
}

export function createTraceId(): string {
  return `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function formatTraceTree(events: TraceEvent[]): string {
  if (events.length === 0) return "(no trace events)"

  interface TreeNode extends TraceEvent {
    children: TreeNode[]
  }

  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const ev of events) {
    map.set(ev.id, { ...ev, children: [] })
  }
  for (const ev of events) {
    const node = map.get(ev.id)!
    if (ev.parentId && map.has(ev.parentId)) {
      map.get(ev.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const lines: string[] = []
  const render = (node: TreeNode, prefix: string, isLast: boolean) => {
    const connector = isLast ? "└── " : "├── "
    const icon = node.status === "success" ? "✓" : node.status === "failed" ? "✗" : "…"
    const dur = node.duration ? ` (${formatDuration(node.duration)})` : ""
    lines.push(`${prefix}${connector}${icon} ${node.name}${dur}`)

    const childPrefix = prefix + (isLast ? "    " : "│   ")
    for (let i = 0; i < node.children.length; i++) {
      render(node.children[i], childPrefix, i === node.children.length - 1)
    }
  }

  for (let i = 0; i < roots.length; i++) {
    render(roots[i], "", i === roots.length - 1)
  }

  return lines.join("\n")
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}

export function filterByStatus(events: TraceEvent[], status: TraceEvent["status"]): TraceEvent[] {
  return events.filter(e => e.status === status)
}

export function filterByType(events: TraceEvent[], type: TraceEvent["type"]): TraceEvent[] {
  return events.filter(e => e.type === type)
}

export function getDuration(events: TraceEvent[]): number {
  if (events.length === 0) return 0
  const starts = events.map(e => e.timestamp)
  const ends = events.map(e => e.timestamp + (e.duration || 0))
  return Math.max(...ends) - Math.min(...starts)
}

export * as Trace from "./trace"
