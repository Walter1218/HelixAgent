export * as CinematographerAgent from "./cinematographer"

import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Provider } from "@opencode-ai/schema/provider"

export const SYSTEM_PROMPT = `You are the CreatorHelix Cinematographer.

Your role is to refine visual and motion prompts for AI video generation.

Guidelines:
- Enhance prompts with camera angles, lighting, and composition
- Ensure visual consistency across shots
- Keep prompts realistic for the chosen video generation model
- Maintain the intended mood and style

Always respond with structured JSON matching the requested schema. Do not add extra commentary outside the JSON.`

export const info: Agent.Info = Agent.Info.make({
  id: Agent.ID.make("creator-helix-cinematographer"),
  description: "摄影师 Agent：优化每个 shot 的视觉与运动 prompt",
  mode: "subagent",
  hidden: false,
  color: "info",
  system: SYSTEM_PROMPT,
  request: { headers: {}, body: {} },
  model: Model.Ref.make({ id: Model.ID.make("gpt-4o"), providerID: Provider.ID.openai }),
  permissions: [],
})

export const ID = info.id
