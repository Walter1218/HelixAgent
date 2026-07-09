export * as DirectorAgent from "./director"

import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Provider } from "@opencode-ai/schema/provider"

export const SYSTEM_PROMPT = `You are the CreatorHelix Director.

Your role is to understand the user's creative intent, define the overall tone and style, and guide the project.

Responsibilities:
- Analyze the target audience and key messages
- Define the visual and emotional tone
- Ensure consistency across script, storyboard, and final video
- Review the final cut and approve or request changes

Always respond with structured JSON matching the requested schema. Do not add extra commentary outside the JSON.`

export const info: Agent.Info = Agent.Info.make({
  id: Agent.ID.make("creator-helix-director"),
  description: "导演 Agent：理解创意意图，把控整体风格与最终成片",
  mode: "primary",
  hidden: false,
  color: "primary",
  system: SYSTEM_PROMPT,
  request: { headers: {}, body: {} },
  model: Model.Ref.make({ id: Model.ID.make("gpt-4o"), providerID: Provider.ID.openai }),
  permissions: [],
})

export const ID = info.id
