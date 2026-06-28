export const ActorTool = {
  id: "actor",
  description: "Spawn and manage subagents for parallel task execution.",
  parameters: {
    operation: {
      type: "string",
      enum: ["run", "spawn", "status", "wait", "cancel", "send"],
      description: "Actor operation to perform",
    },
    subagent_type: { type: "string", description: "Type of subagent to spawn" },
    description: { type: "string", description: "Human-readable description" },
    prompt: { type: "string", description: "Task prompt for the subagent" },
    model: { type: "string", description: "Model to use (optional)" },
    timeout_ms: { type: "number", description: "Timeout in milliseconds (optional)" },
    actor_id: { type: "string", description: "Actor ID for status/wait/cancel/send operations" },
    to_actor_id: { type: "string", description: "Target actor ID for send operation" },
    content: { type: "string", description: "Message content for send operation" },
  },
}
