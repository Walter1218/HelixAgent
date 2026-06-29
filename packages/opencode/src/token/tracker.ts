export interface TokenUsage {
  session_id: string
  task_id?: string
  agent_type?: string
  model_id: string
  provider_id: string
  input_tokens: number
  output_tokens: number
  timestamp?: number
  purpose?: "planning" | "execution" | "review" | "testing" | "compaction"
}

export interface DailyBudget {
  date: string
  total_budget: number
  used: number
  remaining: number
  planning_used: number
  execution_used: number
  review_used: number
  testing_used: number
  compaction_used: number
  allocated: Record<string, number>
}

export interface UsageStats {
  period_days: number
  total_tokens: number
  avg_daily: number
  by_purpose: Record<string, number>
  by_model: Record<string, number>
  by_day: Array<{ date: string; tokens: number }>
}

export interface TokenTrackerConfig {
  daily_limit: number
  enabled: boolean
}

export const DEFAULT_TOKEN_CONFIG: TokenTrackerConfig = {
  daily_limit: 1000000,
  enabled: true,
}

export function calculateCost(tokens: number, model: string): number {
  // 简化的成本计算
  const rates: Record<string, number> = {
    "mimo-v2.5-pro": 0.00001,
    "mimo-v2.5": 0.000005,
    "default": 0.00001,
  }
  return tokens * (rates[model] || rates.default)
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

import { Effect, Ref, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export interface Interface {
  readonly recordUsage: (usage: TokenUsage) => Effect.Effect<void>
  readonly getDailyBudget: () => Effect.Effect<DailyBudget>
  readonly canAfford: (tokens: number) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/TokenTracker") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const usage = yield* Ref.make<TokenUsage[]>([])

    const recordUsage = Effect.fn("TokenTracker.recordUsage")(function* (u: TokenUsage) {
      yield* Ref.update(usage, (arr) => [...arr.slice(-9999), { ...u, timestamp: Date.now() }])
    })

    const getDailyBudget = Effect.fn("TokenTracker.getDailyBudget")(function* () {
      const all = yield* Ref.get(usage)
      const today = new Date().toISOString().slice(0, 10)
      const todayUsage = all.filter((u) => u.timestamp && new Date(u.timestamp).toISOString().slice(0, 10) === today)
      const used = todayUsage.reduce((sum, u) => sum + u.input_tokens + u.output_tokens, 0)
      return {
        date: today,
        total_budget: DEFAULT_TOKEN_CONFIG.daily_limit,
        used,
        remaining: DEFAULT_TOKEN_CONFIG.daily_limit - used,
        planning_used: 0,
        execution_used: 0,
        review_used: 0,
        testing_used: 0,
        compaction_used: 0,
        allocated: {},
      }
    })

    const canAfford = Effect.fn("TokenTracker.canAfford")(function* (tokens: number) {
      const budget = yield* getDailyBudget()
      return budget.remaining >= tokens
    })

    return Service.of({ recordUsage, getDailyBudget, canAfford })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as TokenTracker from "./tracker"
