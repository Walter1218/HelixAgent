import { createMemo, Show } from "solid-js"

interface FooterProps {
  mode?: string
  goal?: string
  tokensUsed?: number
  tokenBudget?: number
}

export function FooterWithIndicators(props: FooterProps) {
  const mode = createMemo(() => props.mode ?? "build")
  const goal = createMemo(() => props.goal)
  const tokensUsed = createMemo(() => props.tokensUsed ?? 0)
  const tokenBudget = createMemo(() => props.tokenBudget ?? 1000000)
  
  const modeConfig: Record<string, string> = {
    ask: "Ask",
    build: "Build",
    plan: "Plan",
    compose: "Compose",
    max: "Max",
    loop: "Loop",
  }
  
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }
  
  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
      <text>{modeConfig[mode()] ?? "Build"}</text>
      
      <box gap={2} flexDirection="row" flexShrink={0}>
        <Show when={goal()}>
          <text>Goal: {goal()!.length > 30 ? goal()!.slice(0, 30) + "..." : goal()}</text>
        </Show>
        <text>{formatTokens(tokensUsed())}/{formatTokens(tokenBudget())} tokens</text>
      </box>
    </box>
  )
}
