export * as MaxMode from "./max-mode"

import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { JudgeAgent } from "@/agent/judge-agent"
import type { SessionID } from "./schema"
import type { Provider } from "@/provider/provider"

export interface MaxCandidate {
  id: string
  reasoning: string
  text: string
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>
  score: number
  judgeResult?: { approved: boolean; reason: string }
}

export interface MaxStepResult {
  candidates: MaxCandidate[]
  winner: MaxCandidate
  totalCost: number
}

export interface MaxStepInput {
  sessionID: SessionID
  messages: any[]
  model: Provider.Model
  candidates?: number
}

export interface Interface {
  readonly runMaxStep: (input: MaxStepInput) => Effect.Effect<MaxStepResult>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/MaxMode") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const judge = yield* JudgeAgent.Service

    const runMaxStep = Effect.fn("MaxMode.runMaxStep")(function* (input: MaxStepInput) {
      const numCandidates = input.candidates ?? 3
      const candidates: MaxCandidate[] = []

      // 并行生成 N 个候选（简化实现：串行）
      for (let i = 0; i < numCandidates; i++) {
        const candidate: MaxCandidate = {
          id: `candidate-${i}`,
          reasoning: "",
          text: "",
          toolCalls: [],
          score: 0,
        }

        // TODO: 实际调用 LLM 生成候选
        // 当前简化：使用占位符
        candidate.text = `Candidate ${i} output`

        candidates.push(candidate)
      }

      // 使用 Judge 评估所有候选
      for (const candidate of candidates) {
        const judgeResult = yield* judge.evaluate({
          diff: candidate.text,
          changedFiles: [],
        })

        candidate.judgeResult = {
          approved: judgeResult.decision === "approve",
          reason: judgeResult.reason,
        }

        // 计算分数
        candidate.score = calculateScore(candidate, judgeResult)
      }

      // 选择获胜者
      const winner = candidates.reduce((best, current) => 
        current.score > best.score ? current : best
      )

      return {
        candidates,
        winner,
        totalCost: 0,
      }
    })

    return Service.of({ runMaxStep })
  }),
)

function calculateScore(candidate: MaxCandidate, judgeResult: { decision: string }): number {
  const JUDGE_WEIGHT = 0.4
  const FILE_COUNT_WEIGHT = 0.2
  const TEST_PASS_WEIGHT = 0.3
  const STYLE_WEIGHT = 0.1

  const judgeScore = judgeResult.decision === "approve" ? 1.0 : 
                     judgeResult.decision === "warn" ? 0.5 : 0.0

  const fileCount = candidate.toolCalls.filter(t => 
    t.name === "write" || t.name === "edit"
  ).length
  const fileScore = Math.max(0, 1 - fileCount / 10)

  const testScore = 0.8
  const styleScore = 0.9

  return (
    judgeScore * JUDGE_WEIGHT +
    fileScore * FILE_COUNT_WEIGHT +
    testScore * TEST_PASS_WEIGHT +
    styleScore * STYLE_WEIGHT
  )
}

export const defaultLayer = layer.pipe(
  Layer.provide(JudgeAgent.defaultLayer),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [JudgeAgent.node],
})

