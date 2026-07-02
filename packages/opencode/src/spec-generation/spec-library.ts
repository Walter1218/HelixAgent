import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Database } from "@opencode-ai/core/database/database"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { eq, like, desc } from "drizzle-orm"

// ══════════════════════════════════════════
// Database table
// ══════════════════════════════════════════

export const SpecLibraryTable = sqliteTable("spec_library", {
  id: text().primaryKey(),
  title: text().notNull(),
  domain: text(),
  feature: text(),
  file_path: text().notNull(),
  content: text().notNull(),
  version: integer().notNull().default(1),
  status: text().notNull().default("active"),
  tags: text(),
  created_at: integer().notNull().$default(() => Date.now()),
  updated_at: integer().notNull().$default(() => Date.now()),
})

// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════

export interface SpecEntry {
  id: string
  title: string
  domain?: string
  feature?: string
  filePath: string
  content: string
  version: number
  status: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface SearchQuery {
  query?: string
  domain?: string
  feature?: string
  status?: string
  limit?: number
}

// ══════════════════════════════════════════
// Service
// ══════════════════════════════════════════

export interface Interface {
  readonly save: (spec: Omit<SpecEntry, "id" | "version" | "createdAt" | "updatedAt">) => Effect.Effect<SpecEntry>
  readonly get: (id: string) => Effect.Effect<SpecEntry | undefined>
  readonly search: (query: SearchQuery) => Effect.Effect<SpecEntry[]>
  readonly findSimilar: (title: string, limit?: number) => Effect.Effect<SpecEntry[]>
  readonly update: (id: string, updates: Partial<SpecEntry>) => Effect.Effect<SpecEntry | undefined>
  readonly remove: (id: string) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SpecLibrary") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const save = Effect.fn("SpecLibrary.save")(function* (spec) {
      const id = `spec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const now = Date.now()

      yield* db.insert(SpecLibraryTable).values({
        id,
        title: spec.title,
        domain: spec.domain ?? null,
        feature: spec.feature ?? null,
        file_path: spec.filePath,
        content: spec.content,
        version: 1,
        status: spec.status ?? "active",
        tags: spec.tags ? JSON.stringify(spec.tags) : null,
        created_at: now,
        updated_at: now,
      }).pipe(Effect.orDie)

      return { ...spec, id, version: 1, createdAt: now, updatedAt: now }
    })

    const get = Effect.fn("SpecLibrary.get")(function* (id: string) {
      const rows = yield* db.select().from(SpecLibraryTable).where(eq(SpecLibraryTable.id, id)).all().pipe(Effect.orDie)
      if (rows.length === 0) return undefined
      return rowToEntry(rows[0])
    })

    const search = Effect.fn("SpecLibrary.search")(function* (query: SearchQuery) {
      let q = db.select().from(SpecLibraryTable)

      if (query.domain) {
        q = q.where(eq(SpecLibraryTable.domain, query.domain)) as any
      }
      if (query.status) {
        q = q.where(eq(SpecLibraryTable.status, query.status)) as any
      }
      if (query.query) {
        q = q.where(like(SpecLibraryTable.title, `%${query.query}%`)) as any
      }

      const rows = yield* q.orderBy(desc(SpecLibraryTable.updated_at)).limit(query.limit ?? 20).all().pipe(Effect.orDie)
      return rows.map(rowToEntry)
    })

    const findSimilar = Effect.fn("SpecLibrary.findSimilar")(function* (title: string, limit = 5) {
      const keywords = title.toLowerCase().split(/\s+/).filter(Boolean)
      const allSpecs = yield* db.select().from(SpecLibraryTable).where(eq(SpecLibraryTable.status, "active")).all().pipe(Effect.orDie)

      const scored = allSpecs
        .map((spec) => {
          const specTitle = spec.title.toLowerCase()
          const score = keywords.filter((kw) => specTitle.includes(kw)).length
          return { spec, score }
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return scored.map((s) => rowToEntry(s.spec))
    })

    const update = Effect.fn("SpecLibrary.update")(function* (id: string, updates: Partial<SpecEntry>) {
      const existing = yield* get(id)
      if (!existing) return undefined

      yield* db.update(SpecLibraryTable)
        .set({
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.domain !== undefined && { domain: updates.domain }),
          ...(updates.feature !== undefined && { feature: updates.feature }),
          ...(updates.content !== undefined && { content: updates.content }),
          ...(updates.status !== undefined && { status: updates.status }),
          ...(updates.tags !== undefined && { tags: JSON.stringify(updates.tags) }),
          version: existing.version + 1,
          updated_at: Date.now(),
        })
        .where(eq(SpecLibraryTable.id, id))
        .pipe(Effect.orDie)

      return yield* get(id)
    })

    const remove = Effect.fn("SpecLibrary.remove")(function* (id: string) {
      yield* db.update(SpecLibraryTable).set({ status: "archived" }).where(eq(SpecLibraryTable.id, id)).pipe(Effect.orDie)
      return true
    })

    return Service.of({ save, get, search, findSimilar, update, remove })
  }),
)

function rowToEntry(row: typeof SpecLibraryTable.$inferSelect): SpecEntry {
  return {
    id: row.id,
    title: row.title,
    domain: row.domain ?? undefined,
    feature: row.feature ?? undefined,
    filePath: row.file_path,
    content: row.content,
    version: row.version,
    status: row.status,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [Database.node] })

export * as SpecLibrary from "./spec-library"
