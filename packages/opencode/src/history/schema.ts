export type HistoryKind = "user_text" | "assistant_text" | "tool_input" | "tool_error" | "reasoning" | "tool_output"

export interface SearchHit {
  part_id: string
  session_id: string
  message_id: string
  project_id: string
  kind: HistoryKind
  tool_name: string | null
  snippet: string
  score: number
  time_created: number
}

export interface MessagePart {
  part_id: string
  type: string
  role: "user" | "assistant"
  tool_name: string | null
  text: string
}

export interface MessageContext {
  message_id: string
  matched: boolean
  time_created: number
  parts: MessagePart[]
}

export interface HistorySearchInput {
  query: string
  scope?: "project" | "global"
  session_id?: string
  kind?: HistoryKind | HistoryKind[]
  tool_name?: string
  time_after?: number
  time_before?: number
  limit?: number
}

export interface HistoryAroundInput {
  message_id: string
  before?: number
  after?: number
}

export * as History from "./schema"
