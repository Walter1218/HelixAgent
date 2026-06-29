import { createMemo, Show } from "solid-js"

export function ModeIndicator(props: { mode?: string }) {
  const mode = createMemo(() => props.mode ?? "build")
  
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
    <text style={{ color: config().color }}>
      {config().label}
    </text>
  )
}
