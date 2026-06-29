import { createMemo, Show } from "solid-js"

export function GoalIndicator(props: { goal?: string }) {
  return (
    <Show when={props.goal}>
      <text>
        Goal: {props.goal!.length > 30 ? props.goal!.slice(0, 30) + "..." : props.goal}
      </text>
    </Show>
  )
}
