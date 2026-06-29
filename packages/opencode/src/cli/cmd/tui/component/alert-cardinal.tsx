import { createMemo, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"

interface CardinalAlertProps {
  level: "block" | "pause" | "stop" | "warn"
  reason: string
  suggestion?: string
  onStop: () => void
  onIgnore: () => void
}

export function CardinalAlert(props: CardinalAlertProps) {
  const { theme } = useTheme()
  
  const levelColors = {
    block: theme.error,
    pause: theme.warning,
    stop: theme.warning,
    warn: theme.textMuted,
  }
  
  const levelLabels = {
    block: "BLOCK",
    pause: "PAUSE",
    stop: "STOP",
    warn: "WARN",
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1}>
      <text fg={levelColors[props.level]} attributes={TextAttributes.BOLD}>
        ⚠️ Cardinal Alert: {props.reason}
      </text>
      <text fg={theme.text}>Level: {levelLabels[props.level]}</text>
      <Show when={props.suggestion}>
        <text fg={theme.textMuted}>Suggestion: {props.suggestion}</text>
      </Show>
      <box flexDirection="row" gap={2}>
        <text fg={theme.error} onClick={props.onStop}>[Stop]</text>
        <text fg={theme.textMuted} onClick={props.onIgnore}>[Ignore]</text>
      </box>
    </box>
  )
}
