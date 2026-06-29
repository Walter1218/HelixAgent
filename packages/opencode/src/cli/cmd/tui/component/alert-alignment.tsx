import { createMemo, Show } from "solid-js"

interface AlignmentAlertProps {
  type: "file_drift" | "rabbit_hole" | "distraction"
  reason: string
  files?: string[]
  suggestion?: string
}

export function AlignmentAlert(props: AlignmentAlertProps) {
  const typeLabels = {
    file_drift: "File Drift",
    rabbit_hole: "Rabbit Hole",
    distraction: "Distraction",
  }
  
  const typeIcons = {
    file_drift: "📁",
    rabbit_hole: "🕳️",
    distraction: "🐿️",
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1}>
      <text>{typeIcons[props.type]} Alignment Alert: {typeLabels[props.type]}</text>
      <text>{props.reason}</text>
      <Show when={props.files && props.files.length > 0}>
        <text>Files: {props.files!.join(", ")}</text>
      </Show>
      <Show when={props.suggestion}>
        <text>Suggestion: {props.suggestion}</text>
      </Show>
    </box>
  )
}
