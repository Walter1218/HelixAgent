import { createMemo, For } from "solid-js"

interface Agent {
  name: string
  hidden?: boolean
}

export function AgentPanel(props: { agents?: Agent[]; current?: string }) {
  const agents = createMemo(() => (props.agents ?? []).filter(a => !a.hidden))
  const current = createMemo(() => props.current)
  
  return (
    <box flexDirection="column" gap={0}>
      <text style={{ bold: true }}>Agents</text>
      <For each={agents()}>
        {(agent) => (
          <box flexDirection="row" gap={1}>
            <text style={{ color: agent.name === current() ? "#4ade80" : "#888" }}>●</text>
            <text style={{ color: agent.name === current() ? "#fff" : "#888" }}>{agent.name}</text>
          </box>
        )}
      </For>
    </box>
  )
}
