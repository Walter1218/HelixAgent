import { createMemo, For, Show } from "solid-js"

interface Skill {
  name: string
  description?: string
}

export function SkillPanel(props: { skills?: Skill[] }) {
  const skills = createMemo(() => props.skills ?? [])
  
  return (
    <Show when={skills().length > 0}>
      <box flexDirection="column" gap={0}>
        <text style={{ bold: true }}>Skills</text>
        <For each={skills()}>
          {(skill) => (
            <box flexDirection="row" gap={1}>
              <text style={{ color: "#888" }}>→</text>
              <text>{skill.name}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
