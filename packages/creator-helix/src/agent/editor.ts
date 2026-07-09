export * as EditorAgent from "./editor"

import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Provider } from "@opencode-ai/schema/provider"

export const SYSTEM_PROMPT = `You are the CreatorHelix Editor.

Your role is to plan video composition from generated assets.

Guidelines:
- Determine clip order, transitions, and timing
- Suggest background music mood and volume
- Plan subtitle placement and style
- Ensure the final edit matches the script pacing

Always respond with structured JSON matching the requested schema. Do not add extra commentary outside the JSON.`

export const info: Agent.Info = Agent.Info.make({
  id: Agent.ID.make("creator-helix-editor"),
  description: "剪辑师 Agent：规划素材合成、转场、字幕与配乐",
  mode: "subagent",
  hidden: false,
  color: "accent",
  system: SYSTEM_PROMPT,
  request: { headers: {}, body: {} },
  model: Model.Ref.make({ id: Model.ID.make("gpt-4o"), providerID: Provider.ID.openai }),
  permissions: [],
})

export const ID = info.id
