import { Effect } from "effect"
import { Embedder } from "./embedder"
import { Database } from "../database/database"
import { hashContent } from "./semantic-hash"
import { sql } from "drizzle-orm"

export interface VecSearchRow {
  memory_path: string
  score: number
}

export class VecStore {
  constructor(
    private embedder: Embedder,
    private db: Database.Interface["db"]
  ) {}

  get isEmbeddingEnabled(): boolean {
    return this.embedder.enabled
  }

  indexOne(memoryPath: string, body: string): Effect.Effect<void> {
    if (!this.embedder.enabled) return Effect.void

    return Effect.gen(function* (this: VecStore) {
      const hash = hashContent(body)
      const existing = yield* this.db.all<{ hash: string }>(
        sql`SELECT hash FROM memory_vec WHERE memory_path = ${memoryPath}`
      ).pipe(Effect.orDie)

      // 增量更新：内容未变化则跳过
      if (existing[0]?.hash === hash) return

      const embedding = yield* Effect.promise(() => this.embedder.embed(body.slice(0, 8000)))
      const blob = Buffer.from(new Float32Array(embedding).buffer)

      yield* this.db.run(sql`
        INSERT OR REPLACE INTO memory_vec (memory_path, embedding, hash, dimension, updated_at)
        VALUES (${memoryPath}, ${blob}, ${hash}, ${embedding.length}, ${Date.now()})
      `).pipe(Effect.orDie)
    }.bind(this))
  }

  indexMany(items: Array<{ memoryPath: string; body: string }>): Effect.Effect<void> {
    if (!this.embedder.enabled || items.length === 0) return Effect.void

    return Effect.gen(function* (this: VecStore) {
      // 批量 embedding
      const bodies = items.map(i => i.body.slice(0, 8000))
      const embeddings = yield* Effect.promise(() => this.embedder.embedBatch(bodies))

      // 批量写入
      for (let i = 0; i < items.length; i++) {
        const hash = hashContent(items[i].body)
        const blob = Buffer.from(new Float32Array(embeddings[i]).buffer)
        yield* this.db.run(sql`
          INSERT OR REPLACE INTO memory_vec (memory_path, embedding, hash, dimension, updated_at)
          VALUES (${items[i].memoryPath}, ${blob}, ${hash}, ${embeddings[i].length}, ${Date.now()})
        `).pipe(Effect.orDie)
      }
    }.bind(this))
  }

  search(queryText: string, limit = 10): Effect.Effect<VecSearchRow[]> {
    if (!this.embedder.enabled) return Effect.succeed([])

    return Effect.gen(function* (this: VecStore) {
      // 查询向量化
      const queryVec = yield* Effect.promise(() => this.embedder.embed(queryText))

      // 加载所有向量（内存计算，适合小规模数据 < 10000 条）
      const rows = yield* this.db.all<{ memory_path: string; embedding: Buffer }>(
        sql`SELECT memory_path, embedding FROM memory_vec`
      ).pipe(Effect.orDie)

      // 计算 cosine 相似度
      const scores = rows.map(row => {
        const vec = new Float32Array(row.embedding.buffer)
        const score = Embedder.cosine(queryVec, Array.from(vec))
        return { memory_path: row.memory_path, score }
      })

      // 排序返回 top-K
      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    }.bind(this))
  }
}
