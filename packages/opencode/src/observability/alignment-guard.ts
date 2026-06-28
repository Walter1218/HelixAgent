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

export * as AlignmentGuard from "./alignment-guard"
