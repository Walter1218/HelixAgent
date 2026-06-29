import { describe, expect, test } from "bun:test"

import { SystemPromptBuilder } from "../../src/session/system-prompt-builder"

describe("SystemPromptBuilder", () => {
  test("orders static instructions before environment metadata", () => {
    const system = SystemPromptBuilder.build({
      instructions: ["INSTRUCTION_1", "INSTRUCTION_2"],
      environment: ["ENV_1", "ENV_2"],
      mcpInstructions: undefined,
      skills: undefined,
      structuredOutput: false,
      userSystem: undefined,
    })

    expect(system).toEqual(["INSTRUCTION_1", "INSTRUCTION_2", "ENV_1", "ENV_2"])
  })

  test("places optional dynamic content after environment metadata", () => {
    const system = SystemPromptBuilder.build({
      instructions: ["INSTRUCTION"],
      environment: ["ENV"],
      mcpInstructions: "MCP",
      skills: "SKILLS",
      structuredOutput: true,
      userSystem: "USER_SYSTEM",
    })

    expect(system).toEqual([
      "INSTRUCTION",
      "ENV",
      "MCP",
      "SKILLS",
      "IMPORTANT: The user has requested structured output. You MUST use the StructuredOutput tool to provide your final response. Do NOT respond with plain text - you MUST call the StructuredOutput tool with your answer formatted according to the schema.",
      "USER_SYSTEM",
    ])
  })

  test("omits optional fields when not provided", () => {
    const system = SystemPromptBuilder.build({
      instructions: ["INSTRUCTION"],
      environment: ["ENV"],
      mcpInstructions: undefined,
      skills: undefined,
      structuredOutput: false,
      userSystem: undefined,
    })

    expect(system).toEqual(["INSTRUCTION", "ENV"])
  })
})
