import { createMemo } from "solid-js"

export function TokenIndicator(props: { used?: number; budget?: number }) {
  const used = createMemo(() => props.used ?? 0)
  const budget = createMemo(() => props.budget ?? 1000000)
  
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }
  
  return (
    <text>{formatTokens(used())}/{formatTokens(budget())} tokens</text>
  )
}
