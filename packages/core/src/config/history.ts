export interface HistoryConfig {
  kinds: string[]
  enabled: boolean
}

export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  kinds: ["user_text", "assistant_text", "tool_input", "tool_error"],
  enabled: true,
}

export function formatHistoryConfig(config: HistoryConfig): string {
  return `History: ${config.enabled ? "enabled" : "disabled"}, kinds: ${config.kinds.join(", ")}`
}

export * as ConfigHistory from "./history"
