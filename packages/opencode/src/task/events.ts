import { BusEvent } from "@/bus/bus-event"
import { SessionID } from "@/session/schema"
import { TaskStatus } from "./schema"
import z from "zod"

export const TaskCreated = BusEvent.define(
  "task.created",
  z.object({
    sessionID: SessionID.zod,
    taskID: z.string(),
    title: z.string(),
    parentID: z.string().optional(),
  }),
)

export const TaskStatusChanged = BusEvent.define(
  "task.status",
  z.object({
    sessionID: SessionID.zod,
    taskID: z.string(),
    status: TaskStatus,
    summary: z.string().optional(),
  }),
)

export const TaskCompleted = BusEvent.define(
  "task.completed",
  z.object({
    sessionID: SessionID.zod,
    taskID: z.string(),
    status: z.enum(["done", "abandoned"]),
    summary: z.string().optional(),
  }),
)
