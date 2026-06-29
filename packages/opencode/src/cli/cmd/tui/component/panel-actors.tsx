import { createMemo, For, Show } from "solid-js"

interface Actor {
  agent: string
  status: "pending" | "running" | "idle"
}

export function ActorPanel(props: { actors?: Actor[] }) {
  const actors = createMemo(() => props.actors ?? [])
  
  const statusColor = (status: string) => {
    switch (status) {
      case "running": return "#fbbf24"
      case "idle": return "#4ade80"
      case "pending": return "#888"
      default: return "#888"
    }
  }
  
  return (
    <Show when={actors().length > 0}>
      <box flexDirection="column" gap={0}>
        <text style={{ bold: true }}>Subagents</text>
        <For each={actors()}>
          {(actor) => (
            <box flexDirection="row" gap={1}>
              <text style={{ color: "#888" }}>{actor.agent}</text>
              <text style={{ color: statusColor(actor.status) }}>{actor.status}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
