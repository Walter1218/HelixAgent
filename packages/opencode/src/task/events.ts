import z from "zod"

export const TaskCreated = {
  type: "task.created",
  properties: z.object({
    sessionID: z.string(),
    taskID: z.string(),
    title: z.string(),
    parentID: z.string().optional(),
  }),
}

export const TaskStatusChanged = {
  type: "task.status",
  properties: z.object({
    sessionID: z.string(),
    taskID: z.string(),
    status: z.enum(["open", "in_progress", "done", "blocked", "abandoned"]),
    summary: z.string().optional(),
  }),
}

export const TaskCompleted = {
  type: "task.completed",
  properties: z.object({
    sessionID: z.string(),
    taskID: z.string(),
    status: z.enum(["done", "abandoned"]),
    summary: z.string().optional(),
  }),
}
