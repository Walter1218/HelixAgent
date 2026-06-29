import { createMemo, For, Show } from "solid-js"

interface Skill {
  name: string
}

export function SkillPanel(props: { skills?: Skill[] }) {
  const skills = createMemo(() => props.skills ?? [])
  
  return (
    <Show when={skills().length > 0}>
      <box flexDirection="column" gap={0}>
        <text>Skills</text>
        <For each={skills()}>
          {(skill) => (
            <box flexDirection="row" gap={1}>
              <text>→</text>
              <text>{skill.name}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
