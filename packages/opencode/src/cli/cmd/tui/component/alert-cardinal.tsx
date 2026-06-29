import { createMemo, Show } from "solid-js"

interface CardinalAlertProps {
  level: "block" | "pause" | "stop" | "warn"
  reason: string
  suggestion?: string
  onStop: () => void
  onIgnore: () => void
}

export function CardinalAlert(props: CardinalAlertProps) {
  const levelColors = {
    block: "#ef4444",
    pause: "#fbbf24",
    stop: "#fbbf24",
    warn: "#888",
  }
  
  const levelLabels = {
    block: "BLOCK",
    pause: "PAUSE",
    stop: "STOP",
    warn: "WARN",
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1}>
      <text style={{ color: levelColors[props.level], bold: true }}>
        ⚠️ Cardinal Alert: {props.reason}
      </text>
      <text>Level: {levelLabels[props.level]}</text>
      <Show when={props.suggestion}>
        <text style={{ color: "#888" }}>Suggestion: {props.suggestion}</text>
      </Show>
      <box flexDirection="row" gap={2}>
        <text style={{ color: "#ef4444" }} onClick={props.onStop}>[Stop]</text>
        <text style={{ color: "#888" }} onClick={props.onIgnore}>[Ignore]</text>
      </box>
    </box>
  )
}
