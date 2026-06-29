import { createMemo, Show } from "solid-js"

interface FooterProps {
  directory?: string
  mode?: string
  goal?: string
  tokensUsed?: number
  tokenBudget?: number
  permissions?: number
  lspCount?: number
  mcpCount?: number
  mcpError?: boolean
}

export function Footer(props: FooterProps) {
  const directory = createMemo(() => props.directory ?? "")
  const mode = createMemo(() => props.mode ?? "build")
  const goal = createMemo(() => props.goal)
  const tokensUsed = createMemo(() => props.tokensUsed ?? 0)
  const tokenBudget = createMemo(() => props.tokenBudget ?? 1000000)
  const permissions = createMemo(() => props.permissions ?? 0)
  const lspCount = createMemo(() => props.lspCount ?? 0)
  const mcpCount = createMemo(() => props.mcpCount ?? 0)
  const mcpError = createMemo(() => props.mcpError ?? false)
  
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
      <text>{directory()}</text>
      
      <box gap={2} flexDirection="row" flexShrink={0}>
        {/* Mode Indicator */}
        <text>{modeConfig[mode()] ?? "Build"}</text>
        
        {/* Goal Indicator */}
        <Show when={goal()}>
          <text>Goal: {goal()!.length > 30 ? goal()!.slice(0, 30) + "..." : goal()}</text>
        </Show>
        
        {/* Token Indicator */}
        <text>{formatTokens(tokensUsed())}/{formatTokens(tokenBudget())} tokens</text>
        
        {/* Permissions */}
        <Show when={permissions() > 0}>
          <text>△ {permissions()} Permission{permissions() > 1 ? "s" : ""}</text>
        </Show>
        
        {/* LSP */}
        <text>• {lspCount()} LSP</text>
        
        {/* MCP */}
        <Show when={mcpCount() > 0}>
          <text>⊙ {mcpCount()} MCP</text>
        </Show>
      </box>
    </box>
  )
}
