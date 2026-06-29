import { createMemo } from "solid-js"

interface ModeOption {
  value: string
  title: string
  description: string
}

export function DialogMode(props: { 
  current?: string
}) {
  const modes: ModeOption[] = [
    { value: "ask", title: "Ask", description: "Read-only, questions only" },
    { value: "build", title: "Build", description: "Default mode, execute tools" },
    { value: "plan", title: "Plan", description: "Planning only, no edits" },
    { value: "compose", title: "Compose", description: "Orchestrate workflows" },
    { value: "max", title: "Max", description: "Parallel candidates" },
    { value: "loop", title: "Loop", description: "Auto feedback loop" },
  ]
  
  return (
    <box flexDirection="column" gap={1} padding={2}>
      <text>Select Mode</text>
      {modes.map(mode => (
        <box 
          flexDirection="row" 
          gap={1}
        >
          <text>{mode.value === props.current ? "●" : "○"}</text>
          <text>{mode.title}</text>
          <text>{mode.description}</text>
        </box>
      ))}
    </box>
  )
}
