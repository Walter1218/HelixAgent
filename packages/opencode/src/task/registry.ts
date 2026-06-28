import { Context, Effect, Layer, Ref } from "effect"
import { Bus } from "@/bus"
import { Log } from "@/util"
import { Task, TaskStatus, TaskEvent } from "./schema"
import { TaskCreated, TaskStatusChanged, TaskCompleted } from "./events"
import type { SessionID } from "@/session/schema"

const log = Log.create({ service: "task.registry" })

export interface Interface {
  readonly create: (input: { sessionID: SessionID; title: string; parentID?: string; description?: string }) => Effect.Effect<Task>
  readonly start: (taskID: string) => Effect.Effect<void>
  readonly done: (taskID: string, summary?: string) => Effect.Effect<void>
  readonly block: (taskID: string, reason?: string) => Effect.Effect<void>
  readonly abandon: (taskID: string, reason?: string) => Effect.Effect<void>
  readonly get: (taskID: string) => Effect.Effect<Task | undefined>
  readonly listBySession: (sessionID: SessionID) => Effect.Effect<Task[]>
  readonly listActive: (sessionID: SessionID) => Effect.Effect<Task[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/TaskRegistry") {}

function nextId(existing: Task[], parentID?: string): string {
  if (!parentID) {
    const topCount = existing.filter((t) => !t.parentID).length
    return `T${topCount + 1}`
  }
  const siblings = existing.filter((t) => t.parentID === parentID)
  return `${parentID}.${siblings.length + 1}`
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const tasks = yield* Ref.make(new Map<string, Task>())
    const events = yield* Ref.make<TaskEvent[]>([])

    const create = Effect.fn("TaskRegistry.create")(function* (input: {
      sessionID: SessionID
      title: string
      parentID?: string
      description?: string
    }) {
      const existing = yield* Ref.get(tasks)
      const id = nextId(Array.from(existing.values()), input.parentID)
      const now = Date.now()

      const task: Task = {
        id,
        sessionID: input.sessionID,
        parentID: input.parentID,
        title: input.title,
        description: input.description,
        status: "open",
        createdAt: now,
        updatedAt: now,
      }

      yield* Ref.update(tasks, (map) => {
        map.set(id, task)
        return map
      })

      const event: TaskEvent = { id: `${id}-created`, taskID: id, at: now, kind: "created", summary: input.title }
      yield* Ref.update(events, (list) => [...list, event])

      log.info("task.created", { taskID: id, title: input.title })
      yield* bus.publish(TaskCreated, {
        sessionID: input.sessionID,
        taskID: id,
        title: input.title,
        parentID: input.parentID,
      }).pipe(Effect.catch(() => Effect.void))

      return task
    })

    const start = Effect.fn("TaskRegistry.start")(function* (taskID: string) {
      const now = Date.now()
      yield* Ref.update(tasks, (map) => {
        const task = map.get(taskID)
        if (task) map.set(taskID, { ...task, status: "in_progress", updatedAt: now })
        return map
      })
      const event: TaskEvent = { id: `${taskID}-started`, taskID, at: now, kind: "started" }
      yield* Ref.update(events, (list) => [...list, event])
      log.info("task.started", { taskID })
    })

    const done = Effect.fn("TaskRegistry.done")(function* (taskID: string, summary?: string) {
      const now = Date.now()
      yield* Ref.update(tasks, (map) => {
        const task = map.get(taskID)
        if (task) map.set(taskID, { ...task, status: "done", updatedAt: now, completedAt: now })
        return map
      })
      const event: TaskEvent = { id: `${taskID}-done`, taskID, at: now, kind: "done", summary }
      yield* Ref.update(events, (list) => [...list, event])
      log.info("task.done", { taskID })
    })

    const block = Effect.fn("TaskRegistry.block")(function* (taskID: string, reason?: string) {
      const now = Date.now()
      yield* Ref.update(tasks, (map) => {
        const task = map.get(taskID)
        if (task) map.set(taskID, { ...task, status: "blocked", updatedAt: now })
        return map
      })
      const event: TaskEvent = { id: `${taskID}-blocked`, taskID, at: now, kind: "blocked", summary: reason }
      yield* Ref.update(events, (list) => [...list, event])
      log.info("task.blocked", { taskID })
    })

    const abandon = Effect.fn("TaskRegistry.abandon")(function* (taskID: string, reason?: string) {
      const now = Date.now()
      yield* Ref.update(tasks, (map) => {
        const task = map.get(taskID)
        if (task) map.set(taskID, { ...task, status: "abandoned", updatedAt: now, completedAt: now })
        return map
      })
      const event: TaskEvent = { id: `${taskID}-abandoned`, taskID, at: now, kind: "abandoned", summary: reason }
      yield* Ref.update(events, (list) => [...list, event])
      log.info("task.abandoned", { taskID })
    })

    const get = Effect.fn("TaskRegistry.get")(function* (taskID: string) {
      const map = yield* Ref.get(tasks)
      return map.get(taskID)
    })

    const listBySession = Effect.fn("TaskRegistry.listBySession")(function* (sessionID: SessionID) {
      const map = yield* Ref.get(tasks)
      return Array.from(map.values()).filter((t) => t.sessionID === sessionID)
    })

    const listActive = Effect.fn("TaskRegistry.listActive")(function* (sessionID: SessionID) {
      const map = yield* Ref.get(tasks)
      return Array.from(map.values()).filter(
        (t) => t.sessionID === sessionID && (t.status === "open" || t.status === "in_progress")
      )
    })

    return Service.of({ create, start, done, block, abandon, get, listBySession, listActive })
  })
)

export const defaultLayer = layer.pipe(Layer.provide(Bus.defaultLayer))
