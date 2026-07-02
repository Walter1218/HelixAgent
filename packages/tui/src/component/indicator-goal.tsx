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

  const verdictIcon = createMemo(() => {
    const v = goal()?.verdict
    if (!v) return "🎯"
    return v.ok ? "✓" : "✗"
  })

  const verdictColor = createMemo(() => {
    const v = goal()?.verdict
    if (!v) return theme.warning
    return v.ok ? theme.success : theme.error
  })

  const verdictHint = createMemo(() => {
    const v = goal()?.verdict
    if (!v || v.ok) return ""
    const reason = v.reason
    return reason.length > 20 ? reason.slice(0, 20) + "..." : reason
  })

  return (
    <Show when={goal()}>
      {(g) => (
        <text fg={verdictColor()}>
          {verdictIcon()} {g().condition.length > 30 ? g().condition.slice(0, 30) + "..." : g().condition}
          {g().react > 0 ? ` (${g().react})` : ""}
          <Show when={verdictHint()}>
            <span style={{ fg: theme.textMuted }}> — {verdictHint()}</span>
          </Show>
        </text>
      )}
    </Show>
  )
}
