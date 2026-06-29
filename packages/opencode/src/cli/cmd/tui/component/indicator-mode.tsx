import { createMemo, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useLocal } from "../context/local"

export function ModeIndicator() {
  const { theme } = useTheme()
  const local = useLocal()
  
  const mode = createMemo(() => local.agent.current()?.name ?? "build")
  
  const modeConfig: Record<string, { color: string; label: string }> = {
    ask: { color: "#4a9eff", label: "Ask" },
    build: { color: "#fb8147", label: "Build" },
    plan: { color: "#c7e2a8", label: "Plan" },
    compose: { color: "#a7a3d8", label: "Compose" },
    max: { color: "#e85d75", label: "Max" },
    loop: { color: "#007acc", label: "Loop" },
  }
  
  const config = createMemo(() => modeConfig[mode()] ?? modeConfig.build)
  
  return (
    <text fg={config().color}>
      {config().label}
    </text>
  )
}
