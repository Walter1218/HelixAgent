export interface Task {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  status: "pending" | "running" | "completed" | "failed"
  estimatedTokens: number
  actualTokens?: number
  createdAt: number
  updatedAt: number
}

export interface ScheduleConfig {
  dailyBudget: number
  maxRetries: number
  strategy: "priority_first" | "round_robin" | "shortest_job_first"
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  dailyBudget: 1000000,
  maxRetries: 3,
  strategy: "priority_first",
}

export interface ScheduleResult {
  selected: Task[]
  deferred: Task[]
  totalTokens: number
}

export function selectTasks(tasks: Task[], config: ScheduleConfig): ScheduleResult {
  const pending = tasks.filter(t => t.status === "pending")
  const sorted = sortByStrategy(pending, config.strategy)
  
  const selected: Task[] = []
  const deferred: Task[] = []
  let totalTokens = 0
  
  for (const task of sorted) {
    if (totalTokens + task.estimatedTokens <= config.dailyBudget) {
      selected.push(task)
      totalTokens += task.estimatedTokens
    } else {
      deferred.push(task)
    }
  }
  
  return { selected, deferred, totalTokens }
}

function sortByStrategy(tasks: Task[], strategy: ScheduleConfig["strategy"]): Task[] {
  switch (strategy) {
    case "priority_first":
      return [...tasks].sort((a, b) => {
        const priority = { high: 3, medium: 2, low: 1 }
        return priority[b.priority] - priority[a.priority]
      })
    case "shortest_job_first":
      return [...tasks].sort((a, b) => a.estimatedTokens - b.estimatedTokens)
    case "round_robin":
      return tasks
    default:
      return tasks
  }
}

export function formatBudget(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export interface Interface {
  readonly selectTasks: (tasks: Task[], config: ScheduleConfig) => Effect.Effect<ScheduleResult>
  readonly formatBudget: (tokens: number) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Scheduler") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    return Service.of({
      selectTasks: (tasks, config) => Effect.succeed(selectTasks(tasks, config)),
      formatBudget: (tokens) => Effect.succeed(formatBudget(tokens)),
    })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as Scheduler from "./scheduler"
