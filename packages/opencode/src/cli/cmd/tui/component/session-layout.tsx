import { createMemo, Show, For } from "solid-js"

interface SessionLayoutProps {
  sessionID: string
  title?: string
  mode?: string
  goal?: string
  tokensUsed?: number
  tokenBudget?: number
  tasks?: any[]
  actors?: any[]
  traces?: any[]
  skills?: any[]
  agents?: any[]
  currentAgent?: string
  messages?: any[]
  children?: any
}

export function SessionLayout(props: SessionLayoutProps) {
  const mode = createMemo(() => props.mode ?? "build")
  const goal = createMemo(() => props.goal)
  const tokensUsed = createMemo(() => props.tokensUsed ?? 0)
  const tokenBudget = createMemo(() => props.tokenBudget ?? 1000000)
  const tasks = createMemo(() => props.tasks ?? [])
  const actors = createMemo(() => props.actors ?? [])
  const traces = createMemo(() => props.traces ?? [])
  const skills = createMemo(() => props.skills ?? [])
  const agents = createMemo(() => (props.agents ?? []).filter(a => !a.hidden))
  const currentAgent = createMemo(() => props.currentAgent)
  
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
  
  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return "✓"
      case "in_progress": return "●"
      case "blocked": return "⊘"
      case "running": return "●"
      case "idle": return "✓"
      case "pending": return "○"
      default: return "○"
    }
  }
  
  return (
    <box flexDirection="column" height="100%">
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
        <text>{props.title ?? "Session"}</text>
        <box gap={2} flexDirection="row">
          <text>{modeConfig[mode()] ?? "Build"}</text>
          <Show when={goal()}>
            <text>Goal: {goal()!.length > 30 ? goal()!.slice(0, 30) + "..." : goal()}</text>
          </Show>
          <text>{formatTokens(tokensUsed())}/{formatTokens(tokenBudget())} tokens</text>
        </box>
      </box>
      
      {/* Main Content */}
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        {/* Chat Area */}
        <box flexGrow={1} minHeight={0} paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1}>
          <Show when={props.messages}>
            <box flexGrow={1}>
              {/* Messages would be rendered here */}
            </box>
          </Show>
          
          {/* Input Area */}
          <box flexShrink={0}>
            <text>> Type a message...</text>
          </box>
        </box>
        
        {/* Sidebar */}
        <box width={42} flexDirection="column" gap={1} padding={1}>
          {/* Tasks */}
          <Show when={tasks().length > 0}>
            <box flexDirection="column" gap={0}>
              <text>Tasks</text>
              <For each={tasks()}>
                {(task: any) => (
                  <box flexDirection="row" gap={1}>
                    <text>{statusIcon(task.status)}</text>
                    <text>{task.id} {task.title}</text>
                  </box>
                )}
              </For>
            </box>
          </Show>
          
          {/* Actors */}
          <Show when={actors().length > 0}>
            <box flexDirection="column" gap={0}>
              <text>Subagents</text>
              <For each={actors()}>
                {(actor: any) => (
                  <box flexDirection="row" gap={1}>
                    <text>{actor.agent}</text>
                    <text>{statusIcon(actor.status)}</text>
                  </box>
                )}
              </For>
            </box>
          </Show>
          
          {/* Skills */}
          <Show when={skills().length > 0}>
            <box flexDirection="column" gap={0}>
              <text>Skills</text>
              <For each={skills()}>
                {(skill: any) => (
                  <box flexDirection="row" gap={1}>
                    <text>→</text>
                    <text>{skill.name}</text>
                  </box>
                )}
              </For>
            </box>
          </Show>
          
          {/* Agents */}
          <Show when={agents().length > 0}>
            <box flexDirection="column" gap={0}>
              <text>Agents</text>
              <For each={agents()}>
                {(agent: any) => (
                  <box flexDirection="row" gap={1}>
                    <text>{agent.name === currentAgent() ? "●" : "○"}</text>
                    <text>{agent.name}</text>
                  </box>
                )}
              </For>
            </box>
          </Show>
        </box>
      </box>
    </box>
  )
}
