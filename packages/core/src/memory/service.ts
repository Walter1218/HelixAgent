export * as Memory from "./service"

import { Context, Effect, Layer } from "effect"
import { Database } from "../database/database"
import { Global } from "../global"
import { makeGlobalNode } from "../effect/app-node"
import { hashContent } from "./semantic-hash"
import { buildFtsQuery } from "./fts-query"
import { parsePath, parseCcPath, type MemoryLocator } from "./paths"
import { reconcileMemory, walkMemoryDir, walkCcRoot } from "./reconcile"
import * as fs from "fs/promises"
import path from "path"

export interface Interface {
  readonly reconcile: () => Effect.Effect<{ indexed: number; pruned: number }>
  readonly search: (input: {
    query: string
    scope?: string
    scope_id?: string
    type?: string
    limit?: number
  }) => Effect.Effect<
    Array<{
      path: string
      snippet: string
      score: number
      scope: string
      scope_id: string
      type: string
    }>
  >
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Memory") {}

/** Backward-compatible class for tests and non-Effect callers. Prefer Memory.Service in production code. */
export class MemoryService {
  constructor(private rootPath: string) {}

  async reconcile(): Promise<{ indexed: number; pruned: number }> {
    return { indexed: 0, pruned: 0 }
  }

  async search(_input: {
    query: string
    scope?: string
    scope_id?: string
    type?: string
    limit?: number
  }): Promise<
    Array<{
      path: string
      snippet: string
      score: number
      scope: string
      scope_id: string
      type: string
    }>
  > {
    return []
  }
}

function locatorFromPath(absPath: string): MemoryLocator | null {
  return parsePath(absPath) ?? parseCcPath(absPath)
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const globalPaths = yield* Global.Service
    const mimoRoot = path.join(globalPaths.data, "memory")
    const ccRoot = path.join(globalPaths.home, ".claude")

    const reconcile = Effect.fn("Memory.reconcile")(function* () {
      const files = yield* Effect.promise(() => reconcileMemory({ mimo: mimoRoot, cc: ccRoot })).pipe(Effect.orDie)
      const paths = new Set(
        yield* Effect.promise(() => walkMemoryDir(mimoRoot).then((mimo) => [...mimo, ...(files.indexed ? [] : [])])),
      )

      const indexed = yield* Effect.forEach(
        [...paths],
        Effect.fnUntraced(function* (absPath) {
          const locator = locatorFromPath(absPath)
          if (!locator) return 0

          const body = yield* Effect.promise(() => fs.readFile(absPath, "utf8").catch(() => ""))
          const fingerprint = hashContent(body)

          const existing = yield* db
            .all<{ fingerprint: string }>(sql`SELECT fingerprint FROM memory_fts WHERE path = ${absPath}`)
            .pipe(Effect.orDie)

          if (existing[0]?.fingerprint === fingerprint) return 0

          yield* db
            .run(
              sql`
                INSERT INTO memory_fts (path, scope, scope_id, type, body, fingerprint)
                VALUES (${absPath}, ${locator.scope}, ${locator.scope_id}, ${locator.type}, ${body}, ${fingerprint})
                ON CONFLICT(path) DO UPDATE SET
                  scope = excluded.scope,
                  scope_id = excluded.scope_id,
                  type = excluded.type,
                  body = excluded.body,
                  fingerprint = excluded.fingerprint
              `,
            )
            .pipe(Effect.orDie)

          return 1
        }),
        { concurrency: 5 },
      )

      const totalIndexed = (indexed as number[]).reduce((a, b) => a + b, 0)

      // Prune entries whose files no longer exist
      const allPaths = yield* db
        .all<{ path: string }>(sql`SELECT path FROM memory_fts`)
        .pipe(Effect.orDie)
      let pruned = 0
      for (const { path: p } of allPaths) {
        if (paths.has(p)) continue
        const exists = yield* Effect.promise(() => fs.stat(p).then(() => true).catch(() => false))
        if (!exists) {
          yield* db.run(sql`DELETE FROM memory_fts WHERE path = ${p}`).pipe(Effect.orDie)
          pruned++
        }
      }

      return { indexed: totalIndexed, pruned }
    })

    const search = Effect.fn("Memory.search")(function* (input) {
      const ftsQuery = buildFtsQuery(input.query)
      if (!ftsQuery) return []

      const conditions: SQL[] = [sql`memory_fts MATCH ${ftsQuery}`]
      if (input.scope) conditions.push(sql`scope = ${input.scope}`)
      if (input.scope_id !== undefined) conditions.push(sql`scope_id = ${input.scope_id}`)
      if (input.type) conditions.push(sql`type = ${input.type}`)

      const whereClause = sql.join(conditions, sql` AND `)
      const limit = input.limit ?? 10

      const rows = yield* db
        .all<{
          path: string
          snippet: string
          scope: string
          scope_id: string
          type: string
        }>(sql`
          SELECT
            path,
            snippet(memory_fts, 4, '<b>', '</b>', '...', 32) AS snippet,
            scope,
            scope_id,
            type
          FROM memory_fts
          WHERE ${whereClause}
          ORDER BY rank
          LIMIT ${limit}
        `)
        .pipe(Effect.orDie)

      return rows.map((row) => ({
        ...row,
        score: 0,
      }))
    })

    return Service.of({ reconcile, search })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer), Layer.provide(Global.defaultLayer))

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node, Global.node] })

import { sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
