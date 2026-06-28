export const MemoryTool = {
  id: "memory",
  description: "Search persistent memory across sessions, projects, and global knowledge.",
  parameters: {
    operation: { type: "string", enum: ["search"], default: "search" },
    query: { type: "string", description: "Search query" },
    scope: { type: "string", enum: ["global", "projects", "sessions"], optional: true },
    scope_id: { type: "string", optional: true },
    type: { type: "string", optional: true },
    limit: { type: "number", optional: true },
  },
}
