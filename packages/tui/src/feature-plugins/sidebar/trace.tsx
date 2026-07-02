import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, Show, For } from "solid-js"

const id = "internal:sidebar-trace"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const goal = createMemo(() => props.api.state.session.goal(props.session_id))
  const verdict = createMemo(() => goal()?.verdict)

  return (
    <Show when={verdict()}>
      {(v) => (
        <box>
          <text fg={theme().text}>
            <b>Judge Trace</b>
          </text>
          <box flexDirection="row" gap={1}>
            <text fg={v().ok ? theme().success : theme().error}>
              {v().ok ? "✓" : "✗"}
            </text>
            <text fg={theme().textMuted} wrapMode="word">
              {v().reason}
            </text>
          </box>
          <Show when={v().impossible}>
            <text fg={theme().error}>Goal appears impossible</text>
          </Show>
        </box>
      )}
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
