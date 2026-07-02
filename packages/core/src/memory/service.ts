export * as Memory from "./service"

import { Context, Effect, Layer } from "effect"
import { Database } from "../database/database"
import { Global } from "../global"
import { makeGlobalNode } from "../effect/app-node"
import { hashContent } from "./semantic-hash"
import { buildFtsQuery } from "./fts-query"
import { parsePath, parseCcPath, type MemoryLocator } from "./paths"
import { reconcileMemory, walkMemoryDir, walkCcRoot } from "./reconcile"
import { Embedder } from "./embedder"
import { VecStore, type VecSearchRow } from "./vec-store"
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

// 混合排序权重配置
const FTS_WEIGHT = 0.6
const VEC_WEIGHT = 0.4
const CO_OCCURRENCE_BOOST = 1.3

// 混合排序函数
function mergeScores(
  ftsResults: Array<{ path: string; snippet: string; scope: string; scope_id: string; type: string }>,
  vecResults: VecSearchRow[],
  limit: number
): Array<{ path: string; snippet: string; score: number; scope: string; scope_id: string; type: string }> {
  // 排名归一化（FTS5 rank 是负数，越小越好）
  const ftsRankMap = new Map(
    ftsResults.map((r, i) => [r.path, 1 - i / Math.max(ftsResults.length, 1)])
  )

  // Vec 分数归一化（cosine 范围 [-1, 1] -> [0, 1]）
  const vecNormMap = new Map(
    vecResults.map(r => [r.memory_path, (r.score + 1) / 2])  // cosine -> [0, 1]
  )

  // 合并所有 path
  const allPaths = new Set([...ftsRankMap.keys(), ...vecNormMap.keys()])

  // 构建 snippet 映射
  const snippetMap = new Map(ftsResults.map(r => [r.path, r.snippet]))
  const metaMap = new Map(ftsResults.map(r => [r.path, r]))

  // 计算融合分数
  const merged = [...allPaths].map(path => {
    const fts = ftsRankMap.get(path) ?? 0
    const vec = vecNormMap.get(path) ?? 0
    const base = fts * FTS_WEIGHT + vec * VEC_WEIGHT
    const boost = (fts > 0 && vec > 0) ? CO_OCCURRENCE_BOOST : 1.0
    const meta = metaMap.get(path)
    return {
      path,
      snippet: snippetMap.get(path) ?? "",
      score: base * boost,
      scope: meta?.scope ?? "",
      scope_id: meta?.scope_id ?? "",
      type: meta?.type ?? "",
    }
  })

  return merged.sort((a, b) => b.score - a.score).slice(0, limit)
}

function readEmbeddingConfig() {
  const enabled = process.env.MEMORY_EMBEDDING_ENABLED !== "0" && process.env.MEMORY_EMBEDDING_ENABLED !== "false"
  const baseUrl = process.env.MEMORY_EMBEDDING_BASE_URL ?? "http://localhost:1234/v1/embeddings"
  const model = process.env.MEMORY_EMBEDDING_MODEL ?? "text-embedding-bge-m3"
  return { enabled, baseUrl, model }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const globalPaths = yield* Global.Service
    const mimoRoot = path.join(globalPaths.data, "memory")
    const ccRoot = path.join(globalPaths.home, ".claude")

    // 读取 embedding 配置（通过环境变量）
    const embCfg = readEmbeddingConfig()
    const embedder = new Embedder({
      enabled: embCfg.enabled,
      baseUrl: embCfg.baseUrl,
      model: embCfg.model,
    })
    const vecStore = new VecStore(embedder, db)

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

          yield* db.run(sql`DELETE FROM memory_fts WHERE path = ${absPath}`).pipe(Effect.orDie)

          yield* db
            .run(
              sql`
                INSERT INTO memory_fts (path, scope, scope_id, type, body, fingerprint)
                VALUES (${absPath}, ${locator.scope}, ${locator.scope_id}, ${locator.type}, ${body}, ${fingerprint})
              `,
            )
            .pipe(Effect.orDie)

          // 向量索引
          if (vecStore.isEmbeddingEnabled) {
            yield* vecStore.indexOne(absPath, body).pipe(Effect.ignore)
          }

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
          // 清理向量索引
          if (vecStore.isEmbeddingEnabled) {
            yield* db.run(sql`DELETE FROM memory_vec WHERE memory_path = ${p}`).pipe(Effect.ignore)
          }
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
      const topK = limit * 2  // 候选池放大

      // FTS 搜索
      const ftsRows = yield* db
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
          LIMIT ${topK}
        `)
        .pipe(Effect.orDie)

      // Vector 搜索（如果启用）
      let vecResults: VecSearchRow[] = []
      if (vecStore.isEmbeddingEnabled) {
        vecResults = yield* vecStore.search(input.query, topK)
      }

      // 混合排序
      if (vecResults.length === 0) {
        return ftsRows.map((row) => ({
          ...row,
          score: 0,
        }))
      }

      return mergeScores(ftsRows, vecResults, limit)
    })

    return Service.of({ reconcile, search })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Database.defaultLayer),
  Layer.provide(Global.defaultLayer),
)

export const node = makeGlobalNode({
  service: Service,
  layer,
  deps: [Database.node, Global.node]
})

import { sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
