export interface ModelCallMetric {
  sessionID: string
  finish_reason: string
  ttft_ms?: number
  latency_ms: number
  cached_read_tokens: number
  model_id: string
  provider: string
  total_tokens_in: number
  total_tokens_out: number
}

export interface ToolCallMetric {
  sessionID: string
  tool_name: string
  input_bytes: number
  output_bytes: number
  tool_call_id: string
  tool_call_status: "success" | "error"
}

export interface AgentRequestMetric {
  sessionID: string
  phase: string
  task_type: string
  surface: string
  total_tokens_in: number
  total_tokens_out: number
  files_changed: number
  validation_status: string
}

export interface MetricsConfig {
  enabled: boolean
  sampling_rate: number
}

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  sampling_rate: 1.0,
}

export function calculateTTFT(startTime: number, firstTokenTime: number): number {
  return firstTokenTime - startTime
}

export function calculateLatency(startTime: number, endTime: number): number {
  return endTime - startTime
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

import { Effect, Ref, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export interface Interface {
  readonly recordModelCall: (metric: ModelCallMetric) => Effect.Effect<void>
  readonly recordToolCall: (metric: ToolCallMetric) => Effect.Effect<void>
  readonly recordAgentRequest: (metric: AgentRequestMetric) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Metrics") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const modelCalls = yield* Ref.make<ModelCallMetric[]>([])
    const toolCalls = yield* Ref.make<ToolCallMetric[]>([])

    const recordModelCall = Effect.fn("Metrics.recordModelCall")(function* (metric: ModelCallMetric) {
      yield* Ref.update(modelCalls, (arr) => [...arr.slice(-9999), metric])
    })

    const recordToolCall = Effect.fn("Metrics.recordToolCall")(function* (metric: ToolCallMetric) {
      yield* Ref.update(toolCalls, (arr) => [...arr.slice(-9999), metric])
    })

    const recordAgentRequest = Effect.fn("Metrics.recordAgentRequest")(function* (_metric: AgentRequestMetric) {
      // 暂存，后续可持久化
    })

    return Service.of({ recordModelCall, recordToolCall, recordAgentRequest })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as Metrics from "./metrics"
