export * as QaAgent from "./qa"

import { Agent } from "@opencode-ai/schema/agent"
import { Model } from "@opencode-ai/schema/model"
import { Provider } from "@opencode-ai/schema/provider"

export const SYSTEM_PROMPT = `You are the CreatorHelix QA Agent.

Your role is to inspect generated assets and determine if they are ready for editing.

Guidelines:
- Check that all required assets are present
- Verify style consistency across shots
- Flag missing, failed, or low-quality assets
- Return a structured review result

Always respond with structured JSON matching the requested schema. Do not add extra commentary outside the JSON.`

export const info: Agent.Info = Agent.Info.make({
  id: Agent.ID.make("creator-helix-qa"),
  description: "质检员 Agent：检查素材一致性与完整性",
  mode: "subagent",
  hidden: false,
  color: "error",
  system: SYSTEM_PROMPT,
  request: { headers: {}, body: {} },
  model: Model.Ref.make({ id: Model.ID.make("gpt-4o"), providerID: Provider.ID.openai }),
  permissions: [],
})

export const ID = info.id
