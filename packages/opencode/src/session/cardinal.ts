export type CardinalLevel = "block" | "pause" | "stop" | "warn"

export interface CardinalDecision {
  readonly level: CardinalLevel
  readonly reason: string
  readonly suggestion?: string
  readonly sessionID?: string
  readonly timestamp?: number
}

export interface ExecutionContext {
  readonly taskId: string
  readonly taskTitle: string
  readonly diff?: string
  readonly changedFiles?: string[]
  readonly consecutiveFailures?: number
  readonly alignmentAlerts?: number
  readonly tokensUsed?: number
  readonly totalBudget?: number
  readonly estimatedFiles?: number
}

export interface CardinalRule {
  readonly id: string
  readonly name: string
  readonly evaluate: (context: ExecutionContext) => CardinalDecision | null
}

function createSecurityRule(): CardinalRule {
  return {
    id: "security",
    name: "安全风险",
    evaluate: (ctx: ExecutionContext) => {
      if (!ctx.diff) return null

      const hasEval = ctx.diff.includes("eval(") || ctx.diff.includes("exec(")
      if (hasEval) {
        return {
          level: "block",
          reason: "检测到eval/exec调用",
          suggestion: "请移除eval/exec调用，使用更安全的替代方案",
        }
      }

      const secretPatterns = [
        /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']+["']/i,
        /(?:AKIA|ASIA)[A-Z0-9]{16}/,
        /sk-[a-zA-Z0-9]{48}/,
        /ghp_[a-zA-Z0-9]{36}/,
      ]

      for (const pattern of secretPatterns) {
        if (pattern.test(ctx.diff)) {
          return {
            level: "block",
            reason: "检测到可能的密钥泄露",
            suggestion: "请移除敏感信息，使用环境变量",
          }
        }
      }

      return null
    },
  }
}

function createExcessiveChangesRule(): CardinalRule {
  return {
    id: "excessive_changes",
    name: "过量改动",
    evaluate: (ctx: ExecutionContext) => {
      if (!ctx.changedFiles || !ctx.estimatedFiles) return null

      const maxFiles = ctx.estimatedFiles * 2
      if (ctx.changedFiles.length > maxFiles) {
        return {
          level: "pause",
          reason: `改动文件数 (${ctx.changedFiles.length}) 超出预期 (${maxFiles})`,
          suggestion: "请确认是否需要这么多改动",
        }
      }

      return null
    },
  }
}

function createConsecutiveFailuresRule(): CardinalRule {
  return {
    id: "consecutive_failures",
    name: "连续失败",
    evaluate: (ctx: ExecutionContext) => {
      if (!ctx.consecutiveFailures) return null

      if (ctx.consecutiveFailures >= 3) {
        return {
          level: "pause",
          reason: `同一任务连续失败 ${ctx.consecutiveFailures} 次`,
          suggestion: "请分析失败原因或调整任务",
        }
      }

      return null
    },
  }
}

function createAlignmentRule(): CardinalRule {
  return {
    id: "alignment",
    name: "偏离目标",
    evaluate: (ctx: ExecutionContext) => {
      if (!ctx.alignmentAlerts) return null

      if (ctx.alignmentAlerts >= 3) {
        return {
          level: "stop",
          reason: `AlignmentGuard连续 ${ctx.alignmentAlerts} 次告警`,
          suggestion: "请检查是否偏离任务目标",
        }
      }

      return null
    },
  }
}

function createTokenLimitRule(): CardinalRule {
  return {
    id: "token_limit",
    name: "Token超限",
    evaluate: (ctx: ExecutionContext) => {
      if (!ctx.tokensUsed || !ctx.totalBudget) return null

      const threshold = ctx.totalBudget * 0.2
      if (ctx.tokensUsed > threshold) {
        return {
          level: "warn",
          reason: `单任务token消耗 (${ctx.tokensUsed.toLocaleString()}) 超出预算20%`,
          suggestion: "请关注token使用效率",
        }
      }

      return null
    },
  }
}

export const DEFAULT_RULES: CardinalRule[] = [
  createSecurityRule(),
  createExcessiveChangesRule(),
  createConsecutiveFailuresRule(),
  createAlignmentRule(),
  createTokenLimitRule(),
]

export function evaluateCardinal(context: ExecutionContext, rules: CardinalRule[] = DEFAULT_RULES): CardinalDecision | null {
  const priority: Record<CardinalLevel, number> = {
    block: 4,
    pause: 3,
    stop: 2,
    warn: 1,
  }

  let highestDecision: CardinalDecision | null = null

  for (const rule of rules) {
    const decision = rule.evaluate(context)
    if (decision) {
      if (!highestDecision || priority[decision.level] > priority[highestDecision.level]) {
        highestDecision = decision
      }
    }
  }

  return highestDecision
}

import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export interface Interface {
  readonly evaluate: (context: ExecutionContext) => Effect.Effect<CardinalDecision | null>
  readonly getRules: () => Effect.Effect<CardinalRule[]>
  readonly registerRules: (rules: CardinalRule[]) => Effect.Effect<void>
  readonly clearDynamicRules: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Cardinal") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const dynamicRules = yield* Effect.sync(() => new Map<string, CardinalRule>())

    const evaluate = Effect.fn("Cardinal.evaluate")(function* (context: ExecutionContext) {
      const allRules = [...DEFAULT_RULES, ...dynamicRules.values()]
      const decision = evaluateCardinal(context, allRules)
      if (!decision) return null
      return {
        ...decision,
        sessionID: context.taskId,
        timestamp: Date.now(),
      }
    })

    const getRules = Effect.fn("Cardinal.getRules")(function* () {
      return [...DEFAULT_RULES, ...dynamicRules.values()]
    })

    const registerRules = Effect.fn("Cardinal.registerRules")(function* (rules: CardinalRule[]) {
      for (const rule of rules) {
        dynamicRules.set(rule.id, rule)
      }
    })

    const clearDynamicRules = Effect.fn("Cardinal.clearDynamicRules")(function* () {
      dynamicRules.clear()
    })

    return Service.of({ evaluate, getRules, registerRules, clearDynamicRules })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as Cardinal from "./cardinal"
