export const HistoryTool = {
  id: "history",
  description: "Search historical sessions and conversations.",
  parameters: {
    operation: {
      type: "string",
      enum: ["search", "around"],
      description: "History operation to perform",
    },
    query: { type: "string", description: "FTS query (required for search)" },
    scope: { type: "string", enum: ["project", "global"], description: "Search scope" },
    session_id: { type: "string", description: "Filter by session ID" },
    kind: { type: "array", items: { type: "string" }, description: "Filter by message kind" },
    tool_name: { type: "string", description: "Filter by tool name" },
    time_after: { type: "number", description: "Unix ms timestamp filter" },
    time_before: { type: "number", description: "Unix ms timestamp filter" },
    limit: { type: "number", description: "Max results (default 10, max 50)" },
    message_id: { type: "string", description: "Anchor message ID (required for around)" },
    before: { type: "number", description: "Messages before anchor (default 5)" },
    after: { type: "number", description: "Messages after anchor (default 5)" },
  },
}
