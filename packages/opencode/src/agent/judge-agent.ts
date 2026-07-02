export * as JudgeAgent from "./judge-agent"

import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export type JudgeDecision = "approve" | "reject" | "warn"

export interface JudgeResult {
  decision: JudgeDecision
  reason: string
  checks: JudgeCheckResult[]
}

export interface JudgeCheckResult {
  name: string
  passed: boolean
  decision: JudgeDecision
  reason: string
}

export interface JudgeCheck {
  name: string
  evaluate: (input: JudgeInput) => JudgeCheckResult
}

export interface JudgeInput {
  diff: string
  changedFiles: string[]
  testResults?: { passed: number; failed: number }
  specRequirements?: string[]
}

// 8 项启发式检查
const CHECKS: JudgeCheck[] = [
  {
    name: "assertion-reduction",
    evaluate: (input) => {
      const lines = input.diff.split("\n")
      const removedAssertions = lines.filter(l => l.startsWith("-") && (l.includes("expect(") || l.includes("assert("))).length
      const addedAssertions = lines.filter(l => l.startsWith("+") && (l.includes("expect(") || l.includes("assert("))).length
      
      if (removedAssertions > 3 && addedAssertions < removedAssertions * 0.7) {
        return {
          name: "assertion-reduction",
          passed: false,
          decision: "reject",
          reason: `Assertions reduced by ${removedAssertions - addedAssertions} (${Math.round((1 - addedAssertions / removedAssertions) * 100)}%)`,
        }
      }
      return { name: "assertion-reduction", passed: true, decision: "approve", reason: "Assertion count maintained" }
    },
  },
  {
    name: "structural-change",
    evaluate: (input) => {
      const lines = input.diff.split("\n")
      const removedBlocks = lines.filter(l => 
        l.startsWith("-") && (l.includes("describe(") || l.includes("it(") || l.includes("test("))
      ).length
      
      if (removedBlocks > 2) {
        return {
          name: "structural-change",
          passed: false,
          decision: "reject",
          reason: `${removedBlocks} test blocks removed`,
        }
      }
      return { name: "structural-change", passed: true, decision: "approve", reason: "Test structure maintained" }
    },
  },
  {
    name: "trivialization",
    evaluate: (input) => {
      const lines = input.diff.split("\n")
      const trivialPatterns = [".toBeTruthy()", ".toBeFalsy()", ".toBeDefined()", ".toBeUndefined()"]
      const specificPatterns = [".toBe(", ".toEqual(", ".toMatch(", ".toContain("]
      
      const removedSpecific = lines.filter(l => 
        l.startsWith("-") && specificPatterns.some(p => l.includes(p))
      ).length
      const addedTrivial = lines.filter(l => 
        l.startsWith("+") && trivialPatterns.some(p => l.includes(p))
      ).length
      
      if (removedSpecific > 2 && addedTrivial > removedSpecific * 0.5) {
        return {
          name: "trivialization",
          passed: false,
          decision: "reject",
          reason: "Specific assertions replaced with trivial checks",
        }
      }
      return { name: "trivialization", passed: true, decision: "approve", reason: "Assertions remain specific" }
    },
  },
  {
    name: "security",
    evaluate: (input) => {
      const lines = input.diff.split("\n")
      const dangerousPatterns = [
        /eval\s*\(/,
        /exec\s*\(/,
        /API_KEY\s*=/,
        /SECRET\s*=/,
        /PASSWORD\s*=/,
        /process\.env\.[A-Z_]*KEY/,
      ]
      
      for (const line of lines) {
        if (!line.startsWith("+")) continue
        for (const pattern of dangerousPatterns) {
          if (pattern.test(line)) {
            return {
              name: "security",
              passed: false,
              decision: "reject",
              reason: `Dangerous pattern detected: ${pattern.source}`,
            }
          }
        }
      }
      return { name: "security", passed: true, decision: "approve", reason: "No security issues detected" }
    },
  },
  {
    name: "regression-risk",
    evaluate: (input) => {
      const lines = input.diff.split("\n")
      const riskyPatterns = [
        /DROP\s+TABLE/i,
        /TRUNCATE/i,
        /rm\s+-rf/,
        /export\s+default/,
        /module\.exports/,
      ]
      
      for (const line of lines) {
        if (!line.startsWith("-")) continue
        for (const pattern of riskyPatterns) {
          if (pattern.test(line)) {
            return {
              name: "regression-risk",
              passed: false,
              decision: "reject",
              reason: `High-risk removal detected: ${pattern.source}`,
            }
          }
        }
      }
      return { name: "regression-risk", passed: true, decision: "approve", reason: "No regression risks detected" }
    },
  },
  {
    name: "consistency",
    evaluate: (input) => {
      const lines = input.diff.split("\n")
      const addedLines = lines.filter(l => l.startsWith("+") && !l.startsWith("+++"))
      
      let camelCase = 0
      let snakeCase = 0
      
      for (const line of addedLines) {
        const camelMatches = line.match(/[a-z][A-Z]/g)
        const snakeMatches = line.match(/[a-z]_[a-z]/g)
        if (camelMatches) camelCase += camelMatches.length
        if (snakeMatches) snakeCase += snakeMatches.length
      }
      
      if (camelCase > 5 && snakeCase > 5) {
        return {
          name: "consistency",
          passed: false,
          decision: "warn",
          reason: "Mixed camelCase and snake_case naming",
        }
      }
      return { name: "consistency", passed: true, decision: "approve", reason: "Naming convention consistent" }
    },
  },
  {
    name: "spec-alignment",
    evaluate: (input) => {
      if (!input.specRequirements || input.specRequirements.length === 0) {
        return { name: "spec-alignment", passed: true, decision: "approve", reason: "No spec requirements to check" }
      }
      
      const diff = input.diff.toLowerCase()
      const missingRequirements = input.specRequirements.filter(req => 
        !diff.includes(req.toLowerCase())
      )
      
      if (missingRequirements.length > 0) {
        return {
          name: "spec-alignment",
          passed: false,
          decision: "warn",
          reason: `Missing spec requirements: ${missingRequirements.join(", ")}`,
        }
      }
      return { name: "spec-alignment", passed: true, decision: "approve", reason: "All spec requirements addressed" }
    },
  },
  {
    name: "verification-gate",
    evaluate: (input) => {
      const hasVerification = input.testResults && input.testResults.passed > 0
      
      if (!hasVerification && input.diff.includes("fix") || input.diff.includes("implement")) {
        return {
          name: "verification-gate",
          passed: false,
          decision: "reject",
          reason: "No test verification for implementation change",
        }
      }
      return { name: "verification-gate", passed: true, decision: "approve", reason: "Verification present" }
    },
  },
]

export interface Interface {
  readonly evaluate: (input: JudgeInput) => Effect.Effect<JudgeResult>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/JudgeAgent") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const evaluate = Effect.fn("JudgeAgent.evaluate")(function* (input: JudgeInput) {
      const results: JudgeCheckResult[] = []
      
      for (const check of CHECKS) {
        results.push(check.evaluate(input))
      }
      
      const rejections = results.filter(r => r.decision === "reject")
      const warnings = results.filter(r => r.decision === "warn")
      
      let decision: JudgeDecision = "approve"
      let reason = "All checks passed"
      
      if (rejections.length > 0) {
        decision = "reject"
        reason = `${rejections.length} checks failed: ${rejections.map(r => r.name).join(", ")}`
      } else if (warnings.length > 0) {
        decision = "warn"
        reason = `${warnings.length} warnings: ${warnings.map(r => r.name).join(", ")}`
      }
      
      return { decision, reason, checks: results }
    })
    
    return Service.of({ evaluate })
  }),
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })
