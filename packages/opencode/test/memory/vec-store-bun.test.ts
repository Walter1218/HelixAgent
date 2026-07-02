import { describe, it, expect, beforeAll } from "bun:test"
import { Embedder } from "@opencode-ai/core/memory/embedder"
import { hashContent } from "@opencode-ai/core/memory/semantic-hash"
import { Database } from "bun:sqlite"

const EMBEDDING_ENABLED = process.env.TEST_EMBEDDING === "1"

describe.skipIf(!EMBEDDING_ENABLED)("VecStore with Bun SQLite", () => {
  let db: Database
  let embedder: Embedder

  beforeAll(() => {
    db = new Database(":memory:")
    db.run(`
      CREATE TABLE memory_vec (
        memory_path TEXT PRIMARY KEY,
        embedding   BLOB NOT NULL,
        hash        TEXT NOT NULL,
        dimension   INTEGER NOT NULL DEFAULT 768,
        updated_at  INTEGER NOT NULL
      )
    `)

    embedder = new Embedder({
      enabled: true,
      baseUrl: "http://localhost:1234/v1/embeddings",
      model: "text-embedding-bge-m3",
    })
  })

  it("should store and retrieve embeddings", async () => {
    const body = "Use REST conventions for API endpoints"
    const hash = hashContent(body)
    const embedding = await embedder.embed(body)
    const blob = Buffer.from(new Float32Array(embedding).buffer)

    db.run(
      `INSERT INTO memory_vec (memory_path, embedding, hash, dimension, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      ["/docs/api.md", blob, hash, embedding.length, Date.now()]
    )

    const rows = db.query(`SELECT memory_path, hash FROM memory_vec`).all() as any[]
    expect(rows.length).toBe(1)
    expect(rows[0].memory_path).toBe("/docs/api.md")
    console.log("✓ Stored embedding, hash:", rows[0].hash)
  })

  it("should compute cosine similarity for search", async () => {
    // 索引多个文档
    const docs = [
      { path: "/docs/api.md", body: "Use REST conventions for API endpoints" },
      { path: "/docs/test.md", body: "Write unit tests with bun:test" },
      { path: "/docs/cook.md", body: "How to make pasta carbonara" },
    ]

    for (const doc of docs) {
      const hash = hashContent(doc.body)
      const existing = db.query(`SELECT hash FROM memory_vec WHERE memory_path = ?`).get(doc.path) as any
      if (existing?.hash === hash) continue

      const embedding = await embedder.embed(doc.body)
      const blob = Buffer.from(new Float32Array(embedding).buffer)
      db.run(
        `INSERT OR REPLACE INTO memory_vec (memory_path, embedding, hash, dimension, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [doc.path, blob, hash, embedding.length, Date.now()]
      )
    }

    // 搜索
    const queryText = "HTTP endpoint naming"
    const queryVec = await embedder.embed(queryText)

    const rows = db.query(`SELECT memory_path, embedding FROM memory_vec`).all() as any[]
    const scores = rows.map(row => {
      const vec = new Float32Array(row.embedding.buffer)
      const score = Embedder.cosine(queryVec, Array.from(vec))
      return { path: row.memory_path, score }
    })

    scores.sort((a, b) => b.score - a.score)

    console.log("✓ Search results for 'HTTP endpoint naming':")
    scores.forEach(s => console.log(`  ${s.path.split("/").pop()}: ${s.score.toFixed(4)}`))

    expect(scores[0].path).toContain("api")
    expect(scores[0].score).toBeGreaterThan(scores[scores.length - 1].score)
  })

  it("should skip unchanged content", async () => {
    const body = "incremental test content"
    const hash1 = hashContent(body)
    const hash2 = hashContent(body)
    expect(hash1).toBe(hash2)
    console.log("✓ Hash is deterministic:", hash1)
  })
})
