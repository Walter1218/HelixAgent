import { createMemo, Show } from "solid-js"

export function GoalIndicator(props: { goal?: string; verdict?: { ok: boolean } }) {
  const statusColor = createMemo(() => {
    if (!props.verdict) return "#888"
    return props.verdict.ok ? "#4ade80" : "#fbbf24"
  })
  
  return (
    <Show when={props.goal}>
      <text style={{ color: statusColor() }}>
        Goal: {props.goal!.length > 30 ? props.goal!.slice(0, 30) + "..." : props.goal}
      </text>
    </Show>
  )
}
