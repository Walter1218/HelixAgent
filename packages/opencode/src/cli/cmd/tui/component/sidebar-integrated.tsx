import { createMemo, Show, For } from "solid-js"

interface Task {
  id: string
  title: string
  status: "open" | "in_progress" | "done" | "blocked" | "abandoned"
}

interface Actor {
  agent: string
  status: "pending" | "running" | "idle"
}

interface TraceEvent {
  id: string
  parentId?: string
  name: string
  status: "success" | "failed" | "pending"
  duration?: number
  timestamp: number
}

interface Skill {
  name: string
}

interface Agent {
  name: string
  hidden?: boolean
}

interface TraceNode extends TraceEvent {
  children: TraceNode[]
}

interface SidebarProps {
  sessionID?: string
  title?: string
  tasks?: Task[]
  actors?: Actor[]
  traces?: TraceEvent[]
  skills?: Skill[]
  agents?: Agent[]
  currentAgent?: string
}

export function Sidebar(props: SidebarProps) {
  const title = createMemo(() => props.title ?? "Session")
  const tasks = createMemo(() => props.tasks ?? [])
  const actors = createMemo(() => props.actors ?? [])
  const traces = createMemo(() => props.traces ?? [])
  const skills = createMemo(() => props.skills ?? [])
  const agents = createMemo(() => (props.agents ?? []).filter(a => !a.hidden))
  const currentAgent = createMemo(() => props.currentAgent)
  
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
  
  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return "✓"
      case "in_progress": return "●"
      case "blocked": return "⊘"
      case "running": return "●"
      case "idle": return "✓"
      case "pending": return "○"
      default: return "○"
    }
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1}>
      {/* Session Title */}
      <text>{title()}</text>
      <Show when={props.sessionID}>
        <text>{props.sessionID}</text>
      </Show>
      
      {/* Tasks Panel */}
      <Show when={tasks().length > 0}>
        <box flexDirection="column" gap={0}>
          <text>Tasks</text>
          <For each={tasks()}>
            {(task) => (
              <box flexDirection="row" gap={1}>
                <text>{statusIcon(task.status)}</text>
                <text>{task.id} {task.title}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
      
      {/* Actors Panel */}
      <Show when={actors().length > 0}>
        <box flexDirection="column" gap={0}>
          <text>Subagents</text>
          <For each={actors()}>
            {(actor) => (
              <box flexDirection="row" gap={1}>
                <text>{actor.agent}</text>
                <text>{statusIcon(actor.status)}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
      
      {/* Trace Panel */}
      <Show when={traces().length > 0}>
        <box flexDirection="column" gap={0}>
          <text>Execution Trace</text>
          <For each={tree()}>
            {(node) => <TraceNodeComponent node={node} level={0} />}
          </For>
          <text>
            Total: {formatDuration(totalDuration())} | {traces().length} events | ✓{successCount()} ✗{failedCount()}
          </text>
        </box>
      </Show>
      
      {/* Skills Panel */}
      <Show when={skills().length > 0}>
        <box flexDirection="column" gap={0}>
          <text>Skills</text>
          <For each={skills()}>
            {(skill) => (
              <box flexDirection="row" gap={1}>
                <text>→</text>
                <text>{skill.name}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
      
      {/* Agents Panel */}
      <Show when={agents().length > 0}>
        <box flexDirection="column" gap={0}>
          <text>Agents</text>
          <For each={agents()}>
            {(agent) => (
              <box flexDirection="row" gap={1}>
                <text>{agent.name === currentAgent() ? "●" : "○"}</text>
                <text>{agent.name}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}

function TraceNodeComponent(props: { node: TraceNode; level: number }) {
  const indent = "  ".repeat(props.level)
  const icon = props.node.status === "success" ? "✓" : props.node.status === "failed" ? "✗" : "…"
  
  return (
    <box flexDirection="column">
      <text>
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
