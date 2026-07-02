import type { LanguageModelV3 } from "@ai-sdk/provider"
import { runAgentWithRetry } from "./llm-call"
import { ReviewReport, type SpecReviewConfig } from "./schema"

export interface ReviewAgentInput {
  specMarkdown: string
  config: SpecReviewConfig
}

function buildPrompt(input: ReviewAgentInput): string {
  return `You are a spec reviewer. Evaluate the quality of this OpenSpec specification.

Spec:
${input.specMarkdown}

Review dimensions:
1. Completeness - Are all aspects covered?
2. Verifiability - Does every requirement have a verification method?
3. Clarity - Are requirements unambiguous?
4. Security - Are security considerations addressed?
5. Performance - Are performance requirements specified?
6. Architecture - Does it align with the project?
7. Consistency - Is there no contradiction?
8. Maintainability - Is it easy to update?

Scoring:
- Start at 100
- Blocker issue: -25
- Warning issue: -10
- Suggestion issue: -3
- Minimum score: 0

Rules:
- Score must be >= ${input.config.minScore ?? 70} for approve
- If there are any blockers, verdict must be "reject"
- List specific strengths
- For each issue, provide a concrete fix suggestion

You MUST respond with valid JSON matching this EXACT schema (use camelCase field names):
{
  "score": number,
  "verdict": "approve | revise | reject",
  "issues": [
    {
      "category": "completeness | verifiability | clarity | security | performance | architecture | consistency | maintainability",
      "severity": "blocker | warning | suggestion",
      "requirementId": "string or null",
      "description": "string",
      "fixSuggestion": "string"
    }
  ],
  "strengths": ["string"],
  "summary": "string"
}

Return raw JSON only.`
}

export function runReviewAgent(model: LanguageModelV3, input: ReviewAgentInput) {
  return runAgentWithRetry("review-agent", buildPrompt, ReviewReport, model, input)
}
