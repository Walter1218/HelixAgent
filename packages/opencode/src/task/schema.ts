import z from "zod"

export const TaskStatus = z.enum(["open", "in_progress", "done", "blocked", "abandoned"])
export type TaskStatus = z.infer<typeof TaskStatus>

export const TaskPriority = z.enum(["low", "medium", "high"])
export type TaskPriority = z.infer<typeof TaskPriority>

export const TaskComplexity = z.enum(["simple", "moderate", "complex"])
export type TaskComplexity = z.infer<typeof TaskComplexity>

export const Task = z.object({
  id: z.string(),
  sessionID: z.string(),
  parentID: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatus,
  priority: TaskPriority.default("medium"),
  complexity: TaskComplexity.default("moderate"),
  estimatedTokens: z.number().optional(),
  actualTokens: z.number().optional(),
  goalAlignment: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
  cleanupAfter: z.number().optional(),
})
export type Task = z.infer<typeof Task>

export const TaskEvent = z.object({
  id: z.string(),
  taskID: z.string(),
  at: z.number(),
  kind: z.enum(["created", "started", "done", "blocked", "unblocked", "abandoned", "renamed"]),
  summary: z.string().optional(),
})
export type TaskEvent = z.infer<typeof TaskEvent>
