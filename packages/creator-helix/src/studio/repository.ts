export * as StudioRepository from "./repository"

import { eq } from "drizzle-orm"
import { Clock, Context, Effect, Layer, Option, Schema } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { StudioSchema } from "./schema/studio"
import type { Studio } from "./schema/studio"
import { StudioTable } from "../persistence/studio.sql"

export interface Interface {
  readonly get: (id: string) => Effect.Effect<Studio | undefined>
  readonly getByName: (name: string) => Effect.Effect<Studio | undefined>
  readonly save: (studio: Studio) => Effect.Effect<void>
  readonly delete: (id: string) => Effect.Effect<void>
  readonly list: () => Effect.Effect<Studio[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode-ai/creator-helix/StudioRepository") {}

const fromRow = (row: typeof StudioTable.$inferSelect): Studio => {
  const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data
  const decoded = Schema.decodeUnknownOption(StudioSchema)({ ...parsed, id: row.id, name: row.name })
  if (Option.isSome(decoded)) return decoded.value
  return {
    id: row.id,
    name: row.name,
    characters: [],
    locations: [],
    props: [],
    crowdPresets: [],
    stylePresets: [],
    worldRules: [],
    audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
  }
}

const toRow = (studio: Studio) => ({
  id: studio.id,
  name: studio.name,
  data: JSON.stringify({
    characters: studio.characters,
    locations: studio.locations,
    props: studio.props,
    crowdPresets: studio.crowdPresets,
    stylePresets: studio.stylePresets,
    worldRules: studio.worldRules,
    audioLibrary: studio.audioLibrary,
  }),
})

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    return Service.of({
      get: Effect.fn("StudioRepository.get")(function* (id) {
        const row = yield* db.select().from(StudioTable).where(eq(StudioTable.id, id)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      getByName: Effect.fn("StudioRepository.getByName")(function* (name) {
        const row = yield* db.select().from(StudioTable).where(eq(StudioTable.name, name)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      save: Effect.fn("StudioRepository.save")(function* (studio) {
        const now = yield* Clock.currentTimeMillis
        const row = toRow(studio)
        yield* db
          .insert(StudioTable)
          .values(row)
          .onConflictDoUpdate({
            target: StudioTable.id,
            set: { name: row.name, data: row.data, updated_at: now },
          })
          .pipe(Effect.orDie)
      }),

      delete: Effect.fn("StudioRepository.delete")(function* (id) {
        yield* db.delete(StudioTable).where(eq(StudioTable.id, id)).pipe(Effect.orDie)
      }),

      list: Effect.fn("StudioRepository.list")(function* () {
        const rows = yield* db.select().from(StudioTable).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
