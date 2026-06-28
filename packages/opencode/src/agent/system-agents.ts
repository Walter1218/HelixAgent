export const SYSTEM_SPAWNED_AGENT_TYPES = new Set([
  "checkpoint-writer",
  "dream",
  "distill",
  "judge",
  "title",
  "summary",
  "compaction",
])

export function isSystemAgent(agentType: string): boolean {
  return SYSTEM_SPAWNED_AGENT_TYPES.has(agentType)
}
