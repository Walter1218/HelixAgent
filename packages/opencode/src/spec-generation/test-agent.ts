import { Effect } from "effect"
import { FSUtil } from "@opencode-ai/core/fs-util"
import path from "path"
import type { AcceptanceCriterion, TestResultItem } from "./schema"

export interface TestAgentInput {
  criteria: readonly AcceptanceCriterion[]
  projectRoot: string
}

function checkVerificationRunnable(
  criterion: AcceptanceCriterion,
  projectRoot: string,
): Effect.Effect<TestResultItem, never, FSUtil.Service> {
  return Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const v = criterion.verification as { type: string; target: string }

    switch (v.type) {
      case "test": {
        const testFile = v.target.replace(/^bun\s+test\s+/, "")
        const exists = yield* fs.existsSafe(path.resolve(projectRoot, testFile))
        return {
          requirementId: criterion.requirementId,
          verification: criterion.verification,
          runnable: exists,
          suggestion: exists ? undefined : `Test file not found: ${testFile}`,
        }
      }

      case "ast": {
        const [filePath] = v.target.split(":")
        const exists = yield* fs.existsSafe(path.resolve(projectRoot, filePath))
        return {
          requirementId: criterion.requirementId,
          verification: criterion.verification,
          runnable: exists,
          suggestion: exists ? undefined : `File not found: ${filePath}`,
        }
      }

      case "grep":
        return {
          requirementId: criterion.requirementId,
          verification: criterion.verification,
          runnable: true,
        }

      case "script": {
        const scriptPath = v.target.replace(/^bun\s+run\s+/, "")
        const exists = yield* fs.existsSafe(path.resolve(projectRoot, scriptPath))
        return {
          requirementId: criterion.requirementId,
          verification: criterion.verification,
          runnable: exists,
          suggestion: exists ? undefined : `Script not found: ${scriptPath}`,
        }
      }

      case "manual":
        return {
          requirementId: criterion.requirementId,
          verification: criterion.verification,
          runnable: true,
          suggestion: "Requires human verification",
        }

      default:
        return {
          requirementId: criterion.requirementId,
          verification: criterion.verification,
          runnable: false,
          suggestion: `Unknown verification type: ${v.type}`,
        }
    }
  })
}

export function runTestAgent(input: TestAgentInput): Effect.Effect<{ results: TestResultItem[] }, never, FSUtil.Service> {
  return Effect.gen(function* () {
    const results: TestResultItem[] = []
    for (const criterion of input.criteria) {
      const result = yield* checkVerificationRunnable(criterion, input.projectRoot)
      results.push(result)
    }
    return { results }
  })
}
