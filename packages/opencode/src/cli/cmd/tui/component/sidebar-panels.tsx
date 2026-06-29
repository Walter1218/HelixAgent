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

interface SidebarProps {
  tasks?: Task[]
  actors?: Actor[]
  traces?: TraceEvent[]
  skills?: Skill[]
  agents?: Agent[]
  currentAgent?: string
}

export function SidebarWithPanels(props: SidebarProps) {
  const tasks = createMemo(() => props.tasks ?? [])
  const actors = createMemo(() => props.actors ?? [])
  const traces = createMemo(() => props.traces ?? [])
  const skills = createMemo(() => props.skills ?? [])
  const agents = createMemo(() => (props.agents ?? []).filter(a => !a.hidden))
  const currentAgent = createMemo(() => props.currentAgent)
  
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
