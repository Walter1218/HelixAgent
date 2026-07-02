import type { LanguageModelV3 } from "@ai-sdk/provider"
import { runAgentWithRetry } from "./llm-call"
import { AcceptAgentOutput, type ReqAgentOutput, type ArchAgentOutput } from "./schema"

export interface AcceptAgentInput {
  reqOutput: ReqAgentOutput
  archOutput: ArchAgentOutput
}

function buildPrompt(input: AcceptAgentInput): string {
  return `You are a QA engineer. For each requirement, design an executable verification method.

Core goal: ${input.reqOutput.coreGoal}

Requirements:
${input.reqOutput.requirementDrafts.map((r) => `- [${r.id}] [${r.priority}] [${r.type}] ${r.title}: ${r.description}`).join("\n")}

Architecture context:
- Files to modify: ${input.archOutput.filesToModify.map((f) => f.path).join(", ") || "(none)"}
- Files to create: ${input.archOutput.filesToCreate.map((f) => f.path).join(", ") || "(none)"}
- Tech stack: ${input.archOutput.techStack.join(", ") || "(unknown)"}

Rules:
- Prefer automated verification in this order: test > script > ast > grep > manual.
- Each verification target must be runnable in this project.
- If not automatically verifiable, mark manual and explain why.
- Rate confidence: high / medium / low.
- If a requirement cannot be verified, list it in unverifiableRequirements.

You MUST respond with valid JSON matching this EXACT schema (use camelCase field names):
{
  "criteria": [
    {
      "requirementId": "string",
      "description": "string",
      "verification": {"type": "test | script | ast | grep | manual", "target": "string"},
      "confidence": "high | medium | low",
      "explanation": "string"
    }
  ],
  "unverifiableRequirements": [
    {
      "requirementId": "string",
      "reason": "string",
      "suggestedAction": "manual | clarify | decompose"
    }
  ]
}

Return raw JSON only.`
}

export function runAcceptAgent(model: LanguageModelV3, input: AcceptAgentInput) {
  return runAgentWithRetry("accept-agent", buildPrompt, AcceptAgentOutput, model, input)
}
