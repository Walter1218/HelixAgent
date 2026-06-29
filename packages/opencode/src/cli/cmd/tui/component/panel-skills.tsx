import { createMemo, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"

export function SkillPanel() {
  const { theme } = useTheme()
  const sync = useSync()
  
  const skills = createMemo(() => {
    return sync.data.skills ?? []
  })
  
  return (
    <Show when={skills().length > 0}>
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Skills</text>
        <For each={skills()}>
          {(skill: any) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>→</text>
              <text fg={theme.text}>{skill.name}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
