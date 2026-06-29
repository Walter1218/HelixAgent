import { createMemo, Show } from "solid-js"

interface CardinalAlertProps {
  level: "block" | "pause" | "stop" | "warn"
  reason: string
  suggestion?: string
}

export function CardinalAlert(props: CardinalAlertProps) {
  const levelLabels = {
    block: "BLOCK",
    pause: "PAUSE",
    stop: "STOP",
    warn: "WARN",
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1}>
      <text>⚠️ Cardinal Alert: {props.reason}</text>
      <text>Level: {levelLabels[props.level]}</text>
      <Show when={props.suggestion}>
        <text>Suggestion: {props.suggestion}</text>
      </Show>
    </box>
  )
}
