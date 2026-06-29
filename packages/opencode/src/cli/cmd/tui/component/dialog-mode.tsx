import { createMemo } from "solid-js"

interface ModeOption {
  value: string
  title: string
  description: string
  color: string
}

export function DialogMode(props: { 
  current?: string
  onSelect: (mode: string) => void 
}) {
  const modes: ModeOption[] = [
    { value: "ask", title: "Ask", description: "Read-only, questions only", color: "#4a9eff" },
    { value: "build", title: "Build", description: "Default mode, execute tools", color: "#fb8147" },
    { value: "plan", title: "Plan", description: "Planning only, no edits", color: "#c7e2a8" },
    { value: "compose", title: "Compose", description: "Orchestrate workflows", color: "#a7a3d8" },
    { value: "max", title: "Max", description: "Parallel candidates", color: "#e85d75" },
    { value: "loop", title: "Loop", description: "Auto feedback loop", color: "#007acc" },
  ]
  
  return (
    <box flexDirection="column" gap={1} padding={2}>
      <text style={{ bold: true }}>Select Mode</text>
      {modes.map(mode => (
        <box 
          key={mode.value} 
          flexDirection="row" 
          gap={1}
          onClick={() => props.onSelect(mode.value)}
        >
          <text style={{ color: mode.value === props.current ? "#4ade80" : "#888" }}>
            {mode.value === props.current ? "●" : "○"}
          </text>
          <text style={{ color: mode.color }}>{mode.title}</text>
          <text style={{ color: "#888" }}>{mode.description}</text>
        </box>
      ))}
    </box>
  )
}
