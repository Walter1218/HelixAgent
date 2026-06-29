import { createMemo, Show } from "solid-js"

interface CardinalAlertProps {
  level: "block" | "pause" | "stop" | "warn"
  reason: string
  suggestion?: string
  onStop: () => void
  onIgnore: () => void
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
      <box flexDirection="row" gap={2}>
        <text onClick={props.onStop}>[Stop]</text>
        <text onClick={props.onIgnore}>[Ignore]</text>
      </box>
    </box>
  )
}
