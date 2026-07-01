import { createMemo, Show } from "solid-js"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useRoute } from "../context/route"

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

export function TokenIndicator() {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()

  const sessionID = createMemo(() => {
    if (route.data.type !== "session") return undefined
    return route.data.sessionID
  })

  const tokenStats = createMemo(() => {
    const id = sessionID()
    if (!id) return undefined
    return sync.data.token_stats[id]
  })

  const totalTokens = createMemo(() => {
    const stats = tokenStats()
    if (!stats) return 0
    return stats.totalTokens
  })

  return (
    <Show when={totalTokens() > 0}>
      <text fg={theme.textMuted}>
        💰 {formatTokens(totalTokens())} tokens
      </text>
    </Show>
  )
}
