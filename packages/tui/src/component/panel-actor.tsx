import { createMemo, For, Show } from "solid-js"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useRoute } from "../context/route"

const STATUS_ICONS: Record<string, string> = {
  pending: "⏳",
  running: "🟢",
  idle: "💤",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  running: "#10b981",
  idle: "#6b7280",
}

const OUTCOME_ICONS: Record<string, string> = {
  success: "✅",
  failure: "❌",
  cancelled: "🚫",
}

export function ActorPanel() {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()

  const sessionID = createMemo(() => {
    if (route.data.type !== "session") return undefined
    return route.data.sessionID
  })

  const actors = createMemo(() => {
    const id = sessionID()
    if (!id) return []
    return sync.data.actor[id] ?? []
  })

  const activeActors = createMemo(() => actors().filter((a) => a.status === "running" || a.status === "pending"))
  const completedActors = createMemo(() => actors().filter((a) => a.status === "idle"))

  return (
    <Show when={actors().length > 0}>
      <box flexShrink={0} gap={1}>
        <text fg={theme.text}>
          <b>Actors</b>
          <span style={{ fg: theme.textMuted }}> ({activeActors().length} active)</span>
        </text>
        <For each={activeActors().slice(0, 5)}>
          {(actor) => (
            <text fg={STATUS_COLORS[actor.status] ?? theme.textMuted}>
              {STATUS_ICONS[actor.status] ?? "⏳"} {actor.agent}
              {actor.description ? ` - ${actor.description.slice(0, 20)}` : ""}
            </text>
          )}
        </For>
        <Show when={completedActors().length > 0}>
          <text fg={theme.textMuted}>
            + {completedActors().length} completed
          </text>
        </Show>
      </box>
    </Show>
  )
}
