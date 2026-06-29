import { createMemo, For } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useLocal } from "../context/local"

export function AgentPanel() {
  const { theme } = useTheme()
  const local = useLocal()
  
  const agents = createMemo(() => {
    return local.agent.list().filter((a: any) => !a.hidden)
  })
  
  const current = createMemo(() => {
    return local.agent.current()?.name
  })
  
  return (
    <box flexDirection="column" gap={0}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>Agents</text>
      <For each={agents()}>
        {(agent: any) => (
          <box flexDirection="row" gap={1}>
            <text fg={agent.name === current() ? theme.success : theme.textMuted}>●</text>
            <text fg={agent.name === current() ? theme.text : theme.textMuted}>{agent.name}</text>
          </box>
        )}
      </For>
    </box>
  )
}
