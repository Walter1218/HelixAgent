import { createMemo, For, Show } from "solid-js"

interface Actor {
  agent: string
  status: "pending" | "running" | "idle"
}

export function ActorPanel(props: { actors?: Actor[] }) {
  const actors = createMemo(() => props.actors ?? [])
  
  return (
    <Show when={actors().length > 0}>
      <box flexDirection="column" gap={0}>
        <text>Subagents</text>
        <For each={actors()}>
          {(actor) => (
            <box flexDirection="row" gap={1}>
              <text>{actor.agent}</text>
              <text>{actor.status}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
