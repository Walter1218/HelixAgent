export * as AssetTaskRepository from "./repository"

import { eq } from "drizzle-orm"
import { Clock, Context, Effect, Layer, Option, Schema } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import type { AssetTask } from "./asset-task"
import { AssetTaskSchema } from "./asset-task"
import { AssetTaskTable } from "../persistence/studio.sql"

export interface Interface {
  readonly get: (id: string) => Effect.Effect<AssetTask | undefined>
  readonly save: (task: AssetTask) => Effect.Effect<void>
  readonly delete: (id: string) => Effect.Effect<void>
  readonly listByProject: (projectId: string) => Effect.Effect<AssetTask[]>
  readonly listByStatus: (status: AssetTask["status"]) => Effect.Effect<AssetTask[]>
  readonly listByParent: (parentRef: string) => Effect.Effect<AssetTask[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode-ai/creator-helix/AssetTaskRepository") {}

const fromRow = (row: typeof AssetTaskTable.$inferSelect): AssetTask => {
  const decoded = Schema.decodeUnknownOption(AssetTaskSchema)({
    id: row.id,
    type: row.type,
    status: row.status,
    provider: row.provider,
    prompt: row.prompt,
    references: JSON.parse(String(row.ref_images)),
    outputs: JSON.parse(String(row.outputs)),
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    parentRef: row.parent_ref,
    error: row.error,
  })
  if (Option.isSome(decoded)) return decoded.value
  return {
    id: row.id, type: "video", status: "queued", provider: "seedDance",
    prompt: "", references: [], outputs: [], retryCount: 0, maxRetries: 3,
    parentRef: null, error: null,
  }
}

const toRow = (task: AssetTask) => ({
  id: task.id,
  project_id: null,
  studio_id: null,
  type: task.type,
  status: task.status,
  provider: task.provider,
  prompt: task.prompt,
  ref_images: JSON.stringify(task.references),
  outputs: JSON.stringify(task.outputs),
  retry_count: task.retryCount,
  max_retries: task.maxRetries,
  parent_ref: task.parentRef,
  error: task.error,
})

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    return Service.of({
      get: Effect.fn("AssetTaskRepository.get")(function* (id) {
        const row = yield* db.select().from(AssetTaskTable).where(eq(AssetTaskTable.id, id)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      save: Effect.fn("AssetTaskRepository.save")(function* (task) {
        const now = yield* Clock.currentTimeMillis
        const row = toRow(task)
        yield* db
          .insert(AssetTaskTable)
          .values(row)
          .onConflictDoUpdate({
            target: AssetTaskTable.id,
            set: {
              status: row.status,
              outputs: row.outputs,
              retry_count: row.retry_count,
              error: row.error,
              updated_at: now,
            },
          })
          .pipe(Effect.orDie)
      }),

      delete: Effect.fn("AssetTaskRepository.delete")(function* (id) {
        yield* db.delete(AssetTaskTable).where(eq(AssetTaskTable.id, id)).pipe(Effect.orDie)
      }),

      listByProject: Effect.fn("AssetTaskRepository.listByProject")(function* (projectId) {
        const rows = yield* db.select().from(AssetTaskTable).where(eq(AssetTaskTable.project_id, projectId)).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),

      listByStatus: Effect.fn("AssetTaskRepository.listByStatus")(function* (status) {
        const rows = yield* db.select().from(AssetTaskTable).where(eq(AssetTaskTable.status, status)).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),

      listByParent: Effect.fn("AssetTaskRepository.listByParent")(function* (parentRef) {
        const rows = yield* db.select().from(AssetTaskTable).where(eq(AssetTaskTable.parent_ref, parentRef)).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
