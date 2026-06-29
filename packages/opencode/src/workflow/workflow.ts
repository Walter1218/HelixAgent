export interface WorkflowConfig {
  maxConcurrentAgents: number
  scriptDeadlineMs: number
  maxLifecycleAgents: number
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxConcurrentAgents: 16,
  scriptDeadlineMs: 12 * 60 * 60 * 1000, // 12 hours
  maxLifecycleAgents: 1000,
}

export type WorkflowStatus = "running" | "completed" | "failed" | "cancelled"

export interface WorkflowRun {
  runID: string
  sessionID: string
  status: WorkflowStatus
  name?: string
  startedAt: number
  completedAt?: number
  error?: string
}

export interface WorkflowResult {
  status: WorkflowStatus
  result?: unknown
  error?: string
  duration: number
}

export function createRunId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function isTerminalStatus(status: WorkflowStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled"
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`
}

import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export interface Interface {
  readonly createRunId: () => Effect.Effect<string>
  readonly isTerminalStatus: (status: WorkflowStatus) => Effect.Effect<boolean>
  readonly formatDuration: (ms: number) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Workflow") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    return Service.of({
      createRunId: () => Effect.succeed(createRunId()),
      isTerminalStatus: (status) => Effect.succeed(isTerminalStatus(status)),
      formatDuration: (ms) => Effect.succeed(formatDuration(ms)),
    })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as Workflow from "./workflow"
