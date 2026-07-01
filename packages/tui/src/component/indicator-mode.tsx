import { createMemo, Show } from "solid-js"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useRoute } from "../context/route"

const MODE_LABELS: Record<string, string> = {
  ask: "Ask",
  build: "Build",
  plan: "Plan",
  compose: "Compose",
  max: "Max",
  loop: "Loop",
}

const MODE_COLORS: Record<string, string> = {
  ask: "#6b7280",
  build: "#3b82f6",
  plan: "#8b5cf6",
  compose: "#f59e0b",
  max: "#ef4444",
  loop: "#10b981",
}

export function ModeIndicator() {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()

  const session = createMemo(() => {
    if (route.data.type !== "session") return undefined
    return sync.session.get(route.data.sessionID)
  })

  const currentMode = createMemo(() => {
    const agent = session()?.agent
    if (!agent) return "build"
    const normalized = agent.toLowerCase()
    if (normalized === "plan") return "plan"
    if (normalized === "max") return "max"
    if (normalized === "compose") return "compose"
    if (normalized === "ask") return "ask"
    return "build"
  })

  const modeLabel = createMemo(() => MODE_LABELS[currentMode()] ?? "Build")
  const modeColor = createMemo(() => MODE_COLORS[currentMode()] ?? "#3b82f6")

  return (
    <text fg={modeColor()}>
      [{modeLabel()}]
    </text>
  )
}
