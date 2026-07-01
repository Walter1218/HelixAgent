import { createMemo, For, Show } from "solid-js"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useRoute } from "../context/route"

const STATUS_ICONS: Record<string, string> = {
  open: "⏳",
  in_progress: "🔄",
  done: "✅",
  blocked: "🚫",
  abandoned: "❌",
}

export function TaskPanel() {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()

  const sessionID = createMemo(() => {
    if (route.data.type !== "session") return undefined
    return route.data.sessionID
  })

  const tasks = createMemo(() => {
    const id = sessionID()
    if (!id) return []
    return sync.data.task[id] ?? []
  })

  const activeTasks = createMemo(() => tasks().filter((t) => t.status !== "done" && t.status !== "abandoned"))
  const completedTasks = createMemo(() => tasks().filter((t) => t.status === "done"))

  return (
    <Show when={tasks().length > 0}>
      <box flexShrink={0} gap={1}>
        <text fg={theme.text}>
          <b>Tasks</b>
          <span style={{ fg: theme.textMuted }}> ({activeTasks().length} active)</span>
        </text>
        <For each={activeTasks().slice(0, 5)}>
          {(task) => (
            <text fg={theme.textMuted}>
              {STATUS_ICONS[task.status] ?? "⏳"} {task.title.length > 30 ? task.title.slice(0, 30) + "..." : task.title}
            </text>
          )}
        </For>
        <Show when={completedTasks().length > 0}>
          <text fg={theme.textMuted}>
            + {completedTasks().length} completed
          </text>
        </Show>
      </box>
    </Show>
  )
}
