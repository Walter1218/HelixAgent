export interface SkillsConfig {
  paths: string[]
  urls: string[]
}

export const DEFAULT_SKILLS_CONFIG: SkillsConfig = {
  paths: [],
  urls: [],
}

export interface HistoryConfig {
  kinds: string[]
  enabled: boolean
}

export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  kinds: ["user_text", "assistant_text", "tool_input", "tool_error"],
  enabled: true,
}

export function formatSkillsConfig(config: SkillsConfig): string {
  return `Skills: ${config.paths.length} paths, ${config.urls.length} urls`
}

export function formatHistoryConfig(config: HistoryConfig): string {
  return `History: ${config.enabled ? "enabled" : "disabled"}, kinds: ${config.kinds.join(", ")}`
}

export * as Config from "./config"
