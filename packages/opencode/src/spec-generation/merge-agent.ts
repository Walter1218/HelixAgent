import type { LanguageModelV3 } from "@ai-sdk/provider"
import { runAgentWithRetry } from "./llm-call"
import { Schema } from "effect"
import type { ReqAgentOutput, ArchAgentOutput, AcceptanceCriterion } from "./schema"

export interface MergeAgentInput {
  reqOutput: ReqAgentOutput
  archOutput: ArchAgentOutput
  criteria: readonly AcceptanceCriterion[]
}

const MergeAgentOutput = Schema.Struct({
  specMarkdown: Schema.String,
})

function buildPrompt(input: MergeAgentInput): string {
  return `You are a technical writer. Combine requirements, architecture context, and acceptance criteria into a single OpenSpec markdown document.

Core goal: ${input.reqOutput.coreGoal}

Requirements:
${input.reqOutput.requirementDrafts.map((r) => `- [${r.id}] [${r.priority}] [${r.type}] ${r.title}: ${r.description}`).join("\n")}

Architecture:
- Files to modify: ${input.archOutput.filesToModify.map((f) => `${f.path} (${f.action}: ${f.description})`).join(", ") || "(none)"}
- Files to create: ${input.archOutput.filesToCreate.map((f) => `${f.path} (${f.description})`).join(", ") || "(none)"}
- Risks: ${input.archOutput.risks.map((r) => r.description).join(", ") || "(none)"}

Acceptance Criteria:
${input.criteria.map((c) => `- [${c.requirementId}] ${c.description} (verification: ${JSON.stringify(c.verification)}, confidence: ${c.confidence})`).join("\n")}

Format requirements:
- # Title (based on core goal)
- ## Overview (brief summary)
- ## Requirements
  - ### Requirement N: <title>
    - Description
    - **Status**: pending
    - **Verification**: <type> <target>
    - Acceptance criteria

You MUST respond with valid JSON with EXACTLY this field name (camelCase):
{"specMarkdown": "the full markdown spec document"}

Return raw JSON only.`
}

export function runMergeAgent(model: LanguageModelV3, input: MergeAgentInput) {
  return runAgentWithRetry("merge-agent", buildPrompt, MergeAgentOutput, model, input)
}
