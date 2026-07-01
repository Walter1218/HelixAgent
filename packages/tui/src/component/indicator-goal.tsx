import { createMemo, Show } from "solid-js"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useRoute } from "../context/route"

export function GoalIndicator() {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()

  const sessionID = createMemo(() => {
    if (route.data.type !== "session") return undefined
    return route.data.sessionID
  })

  const goal = createMemo(() => {
    const id = sessionID()
    if (!id) return undefined
    return sync.data.goal[id]
  })

  return (
    <Show when={goal()}>
      {(g) => (
        <text fg={theme.warning}>
          🎯 {g().condition.length > 30 ? g().condition.slice(0, 30) + "..." : g().condition}
          {g().react > 0 ? ` (${g().react})` : ""}
        </text>
      )}
    </Show>
  )
}
