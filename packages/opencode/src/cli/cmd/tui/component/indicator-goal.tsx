import { createMemo, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"

export function GoalIndicator() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  
  const goal = createMemo(() => {
    if (route.type !== "session") return undefined
    return sync.data.session?.find(s => s.id === route.sessionID)?.goal
  })
  
  const verdict = createMemo(() => {
    if (route.type !== "session") return undefined
    return sync.data.session?.find(s => s.id === route.sessionID)?.lastVerdict
  })
  
  const statusColor = createMemo(() => {
    if (!verdict()) return theme.textMuted
    return verdict()?.ok ? theme.success : theme.warning
  })
  
  return (
    <Show when={goal()}>
      <text fg={statusColor()}>
        Goal: {goal()!.condition.length > 30 
          ? goal()!.condition.slice(0, 30) + "..." 
          : goal()!.condition
        }
      </text>
    </Show>
  )
}
