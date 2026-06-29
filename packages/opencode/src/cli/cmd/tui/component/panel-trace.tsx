import { createMemo, For, Show } from "solid-js"

interface TraceEvent {
  id: string
  parentId?: string
  name: string
  status: "success" | "failed" | "pending"
  duration?: number
  timestamp: number
}

interface TraceNode extends TraceEvent {
  children: TraceNode[]
}

export function TracePanel(props: { traces?: TraceEvent[] }) {
  const traces = createMemo(() => props.traces ?? [])
  const tree = createMemo(() => buildTraceTree(traces()))
  
  const totalDuration = createMemo(() => {
    const events = traces()
    if (events.length === 0) return 0
    const starts = events.map(e => e.timestamp)
    const ends = events.map(e => e.timestamp + (e.duration || 0))
    return Math.max(...ends) - Math.min(...starts)
  })
  
  const successCount = createMemo(() => traces().filter(t => t.status === "success").length)
  const failedCount = createMemo(() => traces().filter(t => t.status === "failed").length)
  
  return (
    <Show when={traces().length > 0}>
      <box flexDirection="column" gap={0}>
        <text style={{ bold: true }}>Execution Trace</text>
        <For each={tree()}>
          {(node) => <TraceNodeComponent node={node} level={0} />}
        </For>
        <text style={{ color: "#888" }}>
          Total: {formatDuration(totalDuration())} | {traces().length} events | ✓{successCount()} ✗{failedCount()}
        </text>
      </box>
    </Show>
  )
}

function TraceNodeComponent(props: { node: TraceNode; level: number }) {
  const indent = "  ".repeat(props.level)
  const icon = props.node.status === "success" ? "✓" : props.node.status === "failed" ? "✗" : "…"
  
  return (
    <box flexDirection="column">
      <text style={{ color: props.node.status === "failed" ? "#ef4444" : "#fff" }}>
        {indent}{icon} {props.node.name} ({formatDuration(props.node.duration ?? 0)})
      </text>
      <For each={props.node.children}>
        {(child) => <TraceNodeComponent node={child} level={props.level + 1} />}
      </For>
    </box>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}

function buildTraceTree(events: TraceEvent[]): TraceNode[] {
  const map = new Map<string, TraceNode>()
  const roots: TraceNode[] = []
  
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
  
  return roots
}
