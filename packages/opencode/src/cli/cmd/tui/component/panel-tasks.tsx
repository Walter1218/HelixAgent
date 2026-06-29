import { createMemo, For, Show } from "solid-js"

interface Task {
  id: string
  title: string
  status: "open" | "in_progress" | "done" | "blocked" | "abandoned"
}

export function TaskPanel(props: { tasks?: Task[] }) {
  const tasks = createMemo(() => props.tasks ?? [])
  
  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return "✓"
      case "in_progress": return "●"
      case "blocked": return "⊘"
      default: return "○"
    }
  }
  
  const statusColor = (status: string) => {
    switch (status) {
      case "done": return "#4ade80"
      case "in_progress": return "#fbbf24"
      case "blocked": return "#ef4444"
      default: return "#888"
    }
  }
  
  return (
    <Show when={tasks().length > 0}>
      <box flexDirection="column" gap={0}>
        <text style={{ bold: true }}>Tasks</text>
        <For each={tasks()}>
          {(task) => (
            <box flexDirection="row" gap={1}>
              <text style={{ color: statusColor(task.status) }}>{statusIcon(task.status)}</text>
              <text>{task.id} {task.title}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
