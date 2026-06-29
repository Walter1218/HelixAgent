import { createMemo, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"

export function TaskPanel() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  
  const tasks = createMemo(() => {
    if (route.type !== "session") return []
    const taskMap = sync.data.tasks?.[route.sessionID] ?? {}
    return Object.values(taskMap).sort((a: any, b: any) => a.id.localeCompare(b.id))
  })
  
  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return <text fg={theme.success}>✓</text>
      case "in_progress": return <text fg={theme.warning}>●</text>
      case "blocked": return <text fg={theme.error}>⊘</text>
      default: return <text fg={theme.textMuted}>○</text>
    }
  }
  
  return (
    <Show when={tasks().length > 0}>
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Tasks</text>
        <For each={tasks()}>
          {(task: any) => (
            <box flexDirection="row" gap={1}>
              {statusIcon(task.status)}
              <text fg={theme.text}>{task.id} {task.title}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
