export * as ProjectRepository from "./repository"

import { eq } from "drizzle-orm"
import { Clock, Context, Effect, Layer, Option, Schema } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import type { Project } from "./schema/project"
import { ProjectSchema } from "./schema/project"
import { KnowledgeProjectTable } from "../persistence/studio.sql"

export interface Interface {
  readonly get: (id: string) => Effect.Effect<Project | undefined>
  readonly getByStudio: (studioId: string) => Effect.Effect<Project[]>
  readonly save: (project: Project, studioId?: string) => Effect.Effect<void>
  readonly delete: (id: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode-ai/creator-helix/ProjectRepository") {}

interface ProjectRowData {
  scripts: Project["scripts"]
  worldRules: Project["worldRules"]
}

const fromRow = (row: typeof KnowledgeProjectTable.$inferSelect): Project => {
  const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data
  const decoded = Schema.decodeUnknownOption(ProjectSchema)({
    ...parsed,
    id: row.id,
    meta: { title: row.title, logline: row.logline, theme: row.theme, targetDuration: row.target_duration },
    stylePresetId: row.style_preset_id ?? "",
  })
  if (Option.isSome(decoded)) return decoded.value
  return {
    id: row.id,
    meta: { title: row.title, logline: row.logline, theme: row.theme, targetDuration: row.target_duration },
    stylePresetId: row.style_preset_id ?? "",
    worldRules: [],
    scripts: [],
  }
}

const toRow = (project: Project) => ({
  id: project.id,
  studio_id: "",
  title: project.meta.title,
  logline: project.meta.logline,
  theme: project.meta.theme,
  target_duration: project.meta.targetDuration,
  style_preset_id: project.stylePresetId || null,
  data: JSON.stringify({
    scripts: project.scripts,
    worldRules: project.worldRules,
  }),
})

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    return Service.of({
      get: Effect.fn("ProjectRepository.get")(function* (id) {
        const row = yield* db.select().from(KnowledgeProjectTable).where(eq(KnowledgeProjectTable.id, id)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      getByStudio: Effect.fn("ProjectRepository.getByStudio")(function* (studioId) {
        const rows = yield* db.select().from(KnowledgeProjectTable).where(eq(KnowledgeProjectTable.studio_id, studioId)).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),

      save: Effect.fn("ProjectRepository.save")(function* (project, studioId) {
        const now = yield* Clock.currentTimeMillis
        const row = { ...toRow(project), studio_id: studioId ?? "" }
        yield* db
          .insert(KnowledgeProjectTable)
          .values(row)
          .onConflictDoUpdate({
            target: KnowledgeProjectTable.id,
            set: {
              title: row.title,
              logline: row.logline,
              theme: row.theme,
              target_duration: row.target_duration,
              style_preset_id: row.style_preset_id,
              data: row.data,
              updated_at: now,
            },
          })
          .pipe(Effect.orDie)
      }),

      delete: Effect.fn("ProjectRepository.delete")(function* (id) {
        yield* db.delete(KnowledgeProjectTable).where(eq(KnowledgeProjectTable.id, id)).pipe(Effect.orDie)
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
