import z from "zod"

export const JudgeCheck = z.enum([
  "assertion_reduction",
  "structural_change",
  "trivialization",
  "security",
  "regression_risk",
  "consistency",
  "spec_alignment",
  "claim_gating",
])
export type JudgeCheck = z.infer<typeof JudgeCheck>

export const JudgeVerdict = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
})
export type JudgeVerdict = z.infer<typeof JudgeVerdict>

export interface JudgeConfig {
  enabled: boolean
  checks: JudgeCheck[]
  maxAssertionReduction: number
}

export const DEFAULT_JUDGE_CONFIG: JudgeConfig = {
  enabled: true,
  checks: [
    "assertion_reduction",
    "structural_change",
    "trivialization",
    "security",
    "regression_risk",
    "consistency",
    "spec_alignment",
    "claim_gating",
  ],
  maxAssertionReduction: 0.3,
}

export function checkAssertionReduction(before: string, after: string): string | null {
  const beforeCount = (before.match(/expect\(|assert\./g) || []).length
  const afterCount = (after.match(/expect\(|assert\./g) || []).length
  
  if (beforeCount === 0) return null
  
  const reduction = (beforeCount - afterCount) / beforeCount
  if (reduction > DEFAULT_JUDGE_CONFIG.maxAssertionReduction) {
    return `Assertion reduction detected: ${Math.round(reduction * 100)}% (max: ${Math.round(DEFAULT_JUDGE_CONFIG.maxAssertionReduction * 100)}%)`
  }
  
  return null
}

export function checkSecurityIssues(diff: string): string[] {
  const issues: string[] = []
  
  if (diff.includes("eval(") || diff.includes("exec(")) {
    issues.push("Security risk: eval/exec detected")
  }
  
  const secretPatterns = [
    /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']+["']/i,
    /(?:AKIA|ASIA)[A-Z0-9]{16}/,
    /sk-[a-zA-Z0-9]{48}/,
    /ghp_[a-zA-Z0-9]{36}/,
  ]
  
  for (const pattern of secretPatterns) {
    if (pattern.test(diff)) {
      issues.push("Security risk: potential secret/key leak detected")
      break
    }
  }
  
  return issues
}

export function checkRegressionRisk(diff: string): string[] {
  const issues: string[] = []
  
  if (diff.includes("DROP TABLE") || diff.includes("TRUNCATE")) {
    issues.push("Regression risk: destructive SQL operation detected")
  }
  
  if (diff.includes("export") && diff.includes("-export")) {
    issues.push("Regression risk: export removal detected")
  }
  
  return issues
}

export * as Judge from "./judge"
