import { Effect, Option, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"
import { TaskRegistry } from "@/task/registry"
import { Scheduler } from "@/scheduler/scheduler"

export const Parameters = Schema.Struct({
  todos: Schema.mutable(Schema.Array(Todo.Info)).annotate({ description: "The updated todo list" }),
})

type Metadata = {
  todos: Todo.Info[]
}

export const TodoWriteTool = Tool.define<typeof Parameters, Metadata, Todo.Service | TaskRegistry.Service>(
  "todowrite",
  Effect.gen(function* () {
    const todo = yield* Todo.Service
    const taskRegistry = yield* TaskRegistry.Service
    const maybeScheduler = yield* Effect.serviceOption(Scheduler.Service)

    return {
      description: DESCRIPTION_WRITE,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "todowrite",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          yield* todo.update({
            sessionID: ctx.sessionID,
            todos: params.todos,
          })

          for (const todoItem of params.todos) {
            if (todoItem.status === "pending" || todoItem.status === "in_progress") {
              yield* taskRegistry.create({
                sessionID: ctx.sessionID,
                title: todoItem.content,
              })
            }
          }

          yield* Option.match(maybeScheduler, {
            onNone: () => Effect.void,
            onSome: (scheduler) =>
              Effect.gen(function* () {
                const now = Date.now()
                const normalizePriority = (priority: string): Scheduler.Task["priority"] => {
                  if (priority === "high" || priority === "low") return priority
                  return "medium"
                }
                const normalizeStatus = (status: string): Scheduler.Task["status"] =>
                  status === "in_progress" ? "running" : (status as Scheduler.Task["status"])
                const tasks = params.todos
                  .filter((t) => t.status === "pending" || t.status === "in_progress")
                  .map((t, index) => ({
                    id: `todo-${ctx.sessionID}-${index}`,
                    title: t.content,
                    description: t.content,
                    priority: normalizePriority(t.priority ?? "medium"),
                    status: normalizeStatus(t.status),
                    estimatedTokens: 100000,
                    createdAt: now,
                    updatedAt: now,
                  }))
                if (tasks.length === 0) return
                const result = yield* scheduler.selectTasks(tasks, Scheduler.DEFAULT_SCHEDULE_CONFIG)
                yield* Effect.logInfo("scheduler: todo prioritization", {
                  "session.id": ctx.sessionID,
                  selected: result.selected.map((t) => t.title),
                  deferred: result.deferred.map((t) => t.title),
                  totalTokens: result.totalTokens,
                })
              }).pipe(Effect.catch(() => Effect.void)),
          })

          return {
            title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
            output: JSON.stringify(params.todos, null, 2),
            metadata: {
              todos: params.todos,
            },
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
