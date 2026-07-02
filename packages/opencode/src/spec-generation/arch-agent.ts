import type { LanguageModelV3 } from "@ai-sdk/provider"
import { runAgentWithRetry } from "./llm-call"
import { ArchAgentOutput, type ReqAgentOutput } from "./schema"

export interface ArchAgentInput {
  reqOutput: ReqAgentOutput
  projectContext: {
    rootPath: string
    relevantFiles: string[]
    packageJson?: Record<string, unknown>
    memory?: string
  }
}

function buildPrompt(input: ArchAgentInput): string {
  return `You are a software architect. Analyze the project context and determine how to implement the requirements.

Core goal: ${input.reqOutput.coreGoal}

Requirements:
${input.reqOutput.requirementDrafts.map((r) => `- [${r.priority}] ${r.title}: ${r.description}`).join("\n")}

Project root: ${input.projectContext.rootPath}
Relevant files: ${input.projectContext.relevantFiles.join(", ") || "(none found)"}
${input.projectContext.packageJson ? `package.json: ${JSON.stringify(input.projectContext.packageJson, null, 2)}` : ""}
${input.projectContext.memory ? `Project memory:\n${input.projectContext.memory}` : ""}

Rules:
- Only propose changes to files that exist (from the relevant files list).
- Reuse existing modules and conventions.
- Define clear interface contracts.
- Identify risks and mitigations.
- List conventions the code follows.

You MUST respond with valid JSON matching this EXACT schema (use camelCase field names):
{
  "projectType": "string",
  "techStack": ["string"],
  "filesToModify": [{"path": "string", "action": "create | modify | delete", "description": "string"}],
  "filesToCreate": [{"path": "string", "action": "create", "description": "string"}],
  "modulesToReuse": [{"name": "string", "file": "string", "description": "string"}],
  "interfaces": [{"name": "string", "file": "string", "description": "string"}],
  "dataFlow": ["string"],
  "risks": [{"description": "string", "severity": "high | medium | low", "mitigation": "string"}],
  "conventions": ["string"]
}

Return raw JSON only.`
}

export function runArchAgent(model: LanguageModelV3, input: ArchAgentInput) {
  return runAgentWithRetry("arch-agent", buildPrompt, ArchAgentOutput, model, input)
}
