import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"

export function DialogMode() {
  const local = useLocal()
  const dialog = useDialog()
  
  const modes = [
    { value: "ask", title: "Ask", description: "Read-only, questions only", color: "#4a9eff" },
    { value: "build", title: "Build", description: "Default mode, execute tools", color: "#fb8147" },
    { value: "plan", title: "Plan", description: "Planning only, no edits", color: "#c7e2a8" },
    { value: "compose", title: "Compose", description: "Orchestrate workflows", color: "#a7a3d8" },
    { value: "max", title: "Max", description: "Parallel candidates", color: "#e85d75" },
    { value: "loop", title: "Loop", description: "Auto feedback loop", color: "#007acc" },
  ]
  
  return (
    <DialogSelect
      title="Select mode"
      current={local.agent.current()?.name}
      options={modes}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
