export const WorkflowTool = {
  id: "workflow",
  description: "Run and manage workflows.",
  parameters: {
    operation: {
      type: "string",
      enum: ["run", "status", "wait", "cancel", "resume"],
      description: "Workflow operation to perform",
    },
    name: { type: "string", description: "Built-in workflow name (e.g. 'deep-research')" },
    script: { type: "string", description: "Inline JS workflow script" },
    args: { type: "object", description: "Arguments to pass to the workflow" },
    run_id: { type: "string", description: "Run ID for status/wait/cancel/resume operations" },
    timeout_ms: { type: "number", description: "Timeout in milliseconds" },
  },
}
