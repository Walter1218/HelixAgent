import { createMemo, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"

export function ActorPanel() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  
  const actors = createMemo(() => {
    if (route.type !== "session") return []
    const actorMap = sync.data.actors?.[route.sessionID] ?? {}
    return Object.values(actorMap).filter((a: any) => a.status !== "completed")
  })
  
  const statusColor = (status: string) => {
    switch (status) {
      case "running": return theme.warning
      case "idle": return theme.success
      case "pending": return theme.textMuted
      default: return theme.text
    }
  }
  
  return (
    <Show when={actors().length > 0}>
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Subagents</text>
        <For each={actors()}>
          {(actor: any) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>{actor.agent}</text>
              <text fg={statusColor(actor.status)}>{actor.status}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
