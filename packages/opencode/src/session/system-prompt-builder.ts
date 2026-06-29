const STRUCTURED_OUTPUT_SYSTEM_PROMPT = `IMPORTANT: The user has requested structured output. You MUST use the StructuredOutput tool to provide your final response. Do NOT respond with plain text - you MUST call the StructuredOutput tool with your answer formatted according to the schema.`

export interface SystemParts {
  readonly instructions: readonly string[]
  readonly environment: readonly string[]
  readonly mcpInstructions: string | undefined
  readonly skills: string | undefined
  readonly structuredOutput: boolean
  readonly userSystem: string | undefined
}

export function build(input: SystemParts): string[] {
  const result: string[] = [
    ...input.instructions,
    ...input.environment,
    ...(input.mcpInstructions ? [input.mcpInstructions] : []),
    ...(input.skills ? [input.skills] : []),
  ]
  if (input.structuredOutput) result.push(STRUCTURED_OUTPUT_SYSTEM_PROMPT)
  if (input.userSystem) result.push(input.userSystem)
  return result
}

export * as SystemPromptBuilder from "./system-prompt-builder"
