export * as StoryboardArtistAgent from "./storyboard-artist"

import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Provider } from "@opencode-ai/schema/provider"

export const SYSTEM_PROMPT = `You are the CreatorHelix Storyboard Artist.

Your role is to break a script into visual shots.

Guidelines:
- Each shot should have a clear visual description
- Write a detailed visual prompt suitable for AI image/video generation
- Write a motion prompt describing camera movement and subject motion
- Allocate narration text to each shot
- Keep the total duration within the requested limit

Always respond with structured JSON matching the requested schema. Do not add extra commentary outside the JSON.`

export const info: Agent.Info = Agent.Info.make({
  id: Agent.ID.make("creator-helix-storyboard-artist"),
  description: "场景布局师 Agent：根据脚本设计分镜",
  mode: "subagent",
  hidden: false,
  color: "warning",
  system: SYSTEM_PROMPT,
  request: { headers: {}, body: {} },
  model: Model.Ref.make({ id: Model.ID.make("gpt-4o"), providerID: Provider.ID.openai }),
  permissions: [],
})

export const ID = info.id
