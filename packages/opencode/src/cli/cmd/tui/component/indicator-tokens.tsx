import { createMemo } from "solid-js"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"

export function TokenIndicator() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  
  const used = createMemo(() => {
    if (route.type !== "session") return 0
    return sync.data.session?.find(s => s.id === route.sessionID)?.tokensUsed ?? 0
  })
  
  const budget = createMemo(() => {
    return sync.data.config?.tokenBudget?.daily ?? 1000000
  })
  
  const percentage = createMemo(() => (used() / budget()) * 100)
  
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }
  
  return (
    <text fg={percentage() > 80 ? theme.error : theme.textMuted}>
      {formatTokens(used())}/{formatTokens(budget())} tokens
    </text>
  )
}
