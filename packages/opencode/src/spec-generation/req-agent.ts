import { Schema } from "effect"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { runAgentWithRetry } from "./llm-call"
import { ReqAgentOutput } from "./schema"

export interface ReqAgentInput {
  userPrompt: string
  sessionHistory: string[]
  projectMemory?: string
}

function buildPrompt(input: ReqAgentInput): string {
  return `You are a requirements analyst. Decompose the user's request into clear, structured requirements.

User request: ${input.userPrompt}

${input.sessionHistory.length > 0 ? `Session history:\n${input.sessionHistory.join("\n")}\n` : ""}
${input.projectMemory ? `Project memory:\n${input.projectMemory}\n` : ""}

Rules:
- Identify the core goal in one sentence.
- Break down into atomic, independently verifiable requirements.
- Mark each requirement as functional/non-functional/security/performance/ux/compatibility.
- Assign priority: must / should / nice-to-have.
- List constraints, assumptions, and open questions.
- Identify the domain (e.g., auth, ui, api, database, etc.)

You MUST respond with valid JSON matching this EXACT schema (use camelCase field names):
{
  "coreGoal": "string - one sentence core goal",
  "requirementDrafts": [
    {
      "id": "string - unique ID like R1, R2",
      "title": "string - short title",
      "description": "string - detailed description",
      "type": "functional | non-functional | security | performance | ux | compatibility",
      "priority": "must | should | nice-to-have",
      "dependencies": ["string - IDs of dependent requirements"]
    }
  ],
  "constraints": ["string"],
  "assumptions": ["string"],
  "openQuestions": ["string"],
  "domain": "string - e.g. auth, ui, api, database"
}

Do NOT use snake_case. Do NOT wrap in markdown code blocks. Return raw JSON only.`
}

export function runReqAgent(model: LanguageModelV3, input: ReqAgentInput) {
  return runAgentWithRetry("req-agent", buildPrompt, ReqAgentOutput, model, input)
}
