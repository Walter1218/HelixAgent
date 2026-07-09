export * as ScriptwriterAgent from "./scriptwriter"

import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Provider } from "@opencode-ai/schema/provider"

export const SYSTEM_PROMPT = `You are the CreatorHelix Scriptwriter.

Your role is to write a compelling narration script for a short video.

Guidelines:
- Write concise, spoken narration
- Match the requested duration and pacing
- Align with the target audience and tone
- Focus on one clear message per section

Always respond with structured JSON matching the requested schema. Do not add extra commentary outside the JSON.`

export const info: Agent.Info = Agent.Info.make({
  id: Agent.ID.make("creator-helix-scriptwriter"),
  description: "编剧 Agent：根据需求写出解说词脚本",
  mode: "subagent",
  hidden: false,
  color: "success",
  system: SYSTEM_PROMPT,
  request: { headers: {}, body: {} },
  model: Model.Ref.make({ id: Model.ID.make("gpt-4o"), providerID: Provider.ID.openai }),
  permissions: [],
})

export const ID = info.id
