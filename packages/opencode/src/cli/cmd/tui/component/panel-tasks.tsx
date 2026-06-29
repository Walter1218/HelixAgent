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
  
  return (
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
  )
}
