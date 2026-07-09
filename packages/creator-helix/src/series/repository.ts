export * as SeriesRepository from "./repository"

import { eq, desc } from "drizzle-orm"
import { Clock, Context, Effect, Layer, Option, Schema } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { SeriesTable } from "../persistence/studio.sql"
import { SeriesSchema, type Series, type Episode, type ContinuityState } from "./schema"

// ─── Interface ───

export interface Interface {
  readonly get: (id: string) => Effect.Effect<Series | undefined>
  readonly getByStudio: (studioId: string) => Effect.Effect<Series[]>
  readonly save: (series: Series) => Effect.Effect<void>
  readonly delete: (id: string) => Effect.Effect<void>
  readonly list: () => Effect.Effect<Series[]>
  readonly addEpisode: (seriesId: string, episode: Episode) => Effect.Effect<void>
  readonly removeEpisode: (seriesId: string, projectId: string) => Effect.Effect<void>
  readonly updateContinuity: (seriesId: string, projectId: string, state: ContinuityState) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode-ai/creator-helix/SeriesRepository") {}

// ─── Row Mapping ───

const fromRow = (row: typeof SeriesTable.$inferSelect): Series => {
  const parsed = JSON.parse(String(row.data))
  return {
    id: row.id,
    title: row.title,
    logline: row.logline,
    theme: row.theme ?? undefined,
    studioId: row.studio_id,
    stylePresetId: row.style_preset_id ?? undefined,
    worldRules: JSON.parse(String(row.world_rules)) as string[],
    ordering: row.ordering as "sequential" | "parallel",
    episodes: parsed.episodes ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

const toRow = (series: Series) => ({
  id: series.id,
  title: series.title,
  logline: series.logline,
  theme: series.theme ?? null,
  studio_id: series.studioId,
  style_preset_id: series.stylePresetId ?? null,
  world_rules: JSON.stringify(series.worldRules ?? []),
  ordering: series.ordering,
  data: JSON.stringify({ episodes: series.episodes }),
})

// ─── Layer ───

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    return Service.of({
      get: Effect.fn("SeriesRepository.get")(function* (id) {
        const row = yield* db.select().from(SeriesTable).where(eq(SeriesTable.id, id)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      getByStudio: Effect.fn("SeriesRepository.getByStudio")(function* (studioId) {
        const rows = yield* db.select().from(SeriesTable).where(eq(SeriesTable.studio_id, studioId)).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),

      save: Effect.fn("SeriesRepository.save")(function* (series) {
        const now = yield* Clock.currentTimeMillis
        const row = toRow({ ...series, updated_at: now })
        yield* db.insert(SeriesTable).values(row)
          .onConflictDoUpdate({ target: SeriesTable.id, set: row })
          .pipe(Effect.orDie)
      }),

      delete: Effect.fn("SeriesRepository.delete")(function* (id) {
        yield* db.delete(SeriesTable).where(eq(SeriesTable.id, id)).pipe(Effect.orDie)
      }),

      list: Effect.fn("SeriesRepository.list")(function* () {
        const rows = yield* db.select().from(SeriesTable).orderBy(desc(SeriesTable.created_at)).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),

      addEpisode: Effect.fn("SeriesRepository.addEpisode")(function* (seriesId, episode) {
        const row = yield* db.select().from(SeriesTable).where(eq(SeriesTable.id, seriesId)).get().pipe(Effect.orDie)
        if (!row) return
        const series = fromRow(row)
        const episodes = [...series.episodes.filter(e => e.projectId !== episode.projectId), episode]
        yield* db.update(SeriesTable)
          .set({ data: JSON.stringify({ episodes }), updated_at: yield* Clock.currentTimeMillis })
          .where(eq(SeriesTable.id, seriesId))
          .pipe(Effect.orDie)
      }),

      removeEpisode: Effect.fn("SeriesRepository.removeEpisode")(function* (seriesId, projectId) {
        const row = yield* db.select().from(SeriesTable).where(eq(SeriesTable.id, seriesId)).get().pipe(Effect.orDie)
        if (!row) return
        const series = fromRow(row)
        const episodes = series.episodes.filter(e => e.projectId !== projectId)
        yield* db.update(SeriesTable)
          .set({ data: JSON.stringify({ episodes }), updated_at: yield* Clock.currentTimeMillis })
          .where(eq(SeriesTable.id, seriesId))
          .pipe(Effect.orDie)
      }),

      updateContinuity: Effect.fn("SeriesRepository.updateContinuity")(function* (seriesId, projectId, state) {
        const row = yield* db.select().from(SeriesTable).where(eq(SeriesTable.id, seriesId)).get().pipe(Effect.orDie)
        if (!row) return
        const series = fromRow(row)
        const episodes = series.episodes.map(e =>
          e.projectId === projectId
            ? { ...e, meta: { ...e.meta, continuityState: state } }
            : e
        )
        yield* db.update(SeriesTable)
          .set({ data: JSON.stringify({ episodes }), updated_at: yield* Clock.currentTimeMillis })
          .where(eq(SeriesTable.id, seriesId))
          .pipe(Effect.orDie)
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
