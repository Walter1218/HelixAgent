import { Schema } from "effect"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { runAgentWithRetry } from "./llm-call"
import type { ReviewIssue } from "./schema"

export interface FixAgentInput {
  specMarkdown: string
  issues: readonly ReviewIssue[]
}

const FixAgentOutput = Schema.Struct({
  fixedSpecMarkdown: Schema.String,
})

function buildPrompt(input: FixAgentInput): string {
  const severityOrder: Record<string, number> = { blocker: 0, warning: 1, suggestion: 2 }
  const sortedIssues = [...input.issues].sort((a, b) => (severityOrder[String(a.severity)] ?? 3) - (severityOrder[String(b.severity)] ?? 3))

  return `You are a spec fixer. Fix the issues in this OpenSpec specification.

Original spec:
${input.specMarkdown}

Issues to fix (ordered by severity):
${sortedIssues.map((i, idx) => `${idx + 1}. [${i.severity}] [${i.category}] ${i.description}\n   Fix: ${i.fixSuggestion}${i.requirementId ? `\n   Requirement: ${i.requirementId}` : ""}`).join("\n")}

Rules:
- Fix all blocker and warning issues
- Apply suggestion issues where practical
- Preserve the overall structure and format
- Do not remove requirements unless explicitly told to
- Output the complete fixed spec markdown

Output strictly as JSON with a "fixedSpecMarkdown" field containing the fixed markdown.`
}

export function runFixAgent(model: LanguageModelV3, input: FixAgentInput) {
  return runAgentWithRetry("fix-agent", buildPrompt, FixAgentOutput, model, input)
}
