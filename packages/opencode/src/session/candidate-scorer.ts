export * as CandidateScorer from "./candidate-scorer"

import type { MaxCandidate } from "./max-mode"
import type { JudgeResult } from "@/agent/judge-agent"

export interface ScoringWeights {
  judge: number
  fileCount: number
  testPass: number
  style: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  judge: 0.4,
  fileCount: 0.2,
  testPass: 0.3,
  style: 0.1,
}

export interface ScoringInput {
  candidate: MaxCandidate
  judgeResult: JudgeResult
  testResults?: { passed: number; failed: number }
  styleScore?: number
}

export function scoreCandidate(
  input: ScoringInput,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const { candidate, judgeResult, testResults, styleScore } = input

  // Judge 批准分数
  const judgeScore = judgeResult.decision === "approve" ? 1.0 : 
                     judgeResult.decision === "warn" ? 0.5 : 0.0

  // 文件数分数（越少越好）
  const fileCount = candidate.toolCalls.filter(t => 
    t.name === "write" || t.name === "edit" || t.name === "multiedit"
  ).length
  const fileScore = Math.max(0, 1 - fileCount / 10)

  // 测试通过率分数
  let testScore = 0.8 // 默认假设通过
  if (testResults) {
    const total = testResults.passed + testResults.failed
    testScore = total > 0 ? testResults.passed / total : 0
  }

  // 风格一致性分数
  const style = styleScore ?? 0.9

  return (
    judgeScore * weights.judge +
    fileScore * weights.fileCount +
    testScore * weights.testPass +
    style * weights.style
  )
}

export function rankCandidates(
  candidates: MaxCandidate[],
  judgeResults: Map<string, JudgeResult>,
  testResults?: { passed: number; failed: number }
): MaxCandidate[] {
  return candidates
    .map(candidate => {
      const judgeResult = judgeResults.get(candidate.id)
      if (!judgeResult) return { ...candidate, score: 0 }

      const score = scoreCandidate({
        candidate,
        judgeResult,
        testResults,
      })

      return { ...candidate, score }
    })
    .sort((a, b) => b.score - a.score)
}
