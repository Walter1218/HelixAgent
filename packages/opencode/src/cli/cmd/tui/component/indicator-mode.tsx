import { createMemo, Show } from "solid-js"

export function ModeIndicator(props: { mode?: string }) {
  const mode = createMemo(() => props.mode ?? "build")
  
  const modeConfig: Record<string, string> = {
    ask: "Ask",
    build: "Build",
    plan: "Plan",
    compose: "Compose",
    max: "Max",
    loop: "Loop",
  }
  
  const label = createMemo(() => modeConfig[mode()] ?? "Build")
  
  return (
    <text>{label()}</text>
  )
}
