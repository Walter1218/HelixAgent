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

export * as TokenTracker from "./tracker"
