export type AlertLevel = "warn" | "critical"

export interface AlignmentAlert {
  sessionID: string
  level: AlertLevel
  reason: string
  files?: string[]
  suggestion: string
  timestamp: number
}

export interface AlertConfig {
  failedCmdThreshold: number
  fileDriftThreshold: number
}

const DEFAULT_CONFIG: AlertConfig = {
  failedCmdThreshold: 5,
  fileDriftThreshold: 5,
}

const RABBIT_HOLE_PATTERNS = [
  /npm\s+install/,
  /bun\s+install/,
  /git\s+clone/,
  /pip\s+install/,
  /cargo\s+install/,
]

const DISTRACTION_PATTERNS = [
  /^curl\s/,
  /^wget\s/,
  /^open\s/,
  /^say\s/,
]

export function detectRabbitHole(commands: string[]): boolean {
  let count = 0
  for (const cmd of commands) {
    for (const pattern of RABBIT_HOLE_PATTERNS) {
      if (pattern.test(cmd)) {
        count++
        if (count >= DEFAULT_CONFIG.failedCmdThreshold) return true
      }
    }
  }
  return false
}

export function detectDistraction(command: string): boolean {
  for (const pattern of DISTRACTION_PATTERNS) {
    if (pattern.test(command)) return true
  }
  return false
}

export function detectFileDrift(goal: string, files: Set<string>): string[] {
  if (!goal) return []
  const drifts: string[] = []
  const keywords = goal.toLowerCase().split(/[\s,;]+/).filter(Boolean)
  if (keywords.length === 0) return []

  for (const f of files) {
    const lower = f.toLowerCase()
    const matched = keywords.some((kw) => lower.includes(kw))
    if (!matched) drifts.push(f)
  }
  return drifts
}

import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export interface Interface {
  readonly detectRabbitHole: (commands: string[]) => Effect.Effect<boolean>
  readonly detectDistraction: (command: string) => Effect.Effect<boolean>
  readonly detectFileDrift: (goal: string, files: Set<string>) => Effect.Effect<string[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AlignmentGuard") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    return Service.of({
      detectRabbitHole: (cmds) => Effect.succeed(detectRabbitHole(cmds)),
      detectDistraction: (cmd) => Effect.succeed(detectDistraction(cmd)),
      detectFileDrift: (goal, files) => Effect.succeed(detectFileDrift(goal, files)),
    })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as AlignmentGuard from "./alignment-guard"
