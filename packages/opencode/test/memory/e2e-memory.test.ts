/**
 * Memory.Vector 端到端测试脚本
 * 
 * 使用方法:
 *   cd packages/opencode
 *   TEST_EMBEDDING=1 bun test test/memory/e2e-memory.test.ts --timeout 60000
 * 
 * 前置条件:
 *   1. LM Studio 运行中，加载 text-embedding-bge-m3 模型
 *   2. 或者配置 opencode.jsonc:
 *      {
 *        "memory": {
 *          "embedding": {
 *            "enabled": true,
 *            "baseUrl": "http://localhost:1234/v1/embeddings",
 *            "model": "text-embedding-bge-m3"
 *          }
 *        }
 *      }
 */

import { describe, it, expect } from "bun:test"
import { Embedder } from "@opencode-ai/core/memory/embedder"
import { hashContent } from "@opencode-ai/core/memory/semantic-hash"
import { Database } from "bun:sqlite"

const EMBEDDING_ENABLED = process.env.TEST_EMBEDDING === "1"

describe.skipIf(!EMBEDDING_ENABLED)("Memory E2E: FTS + Vector hybrid", () => {
  const embedder = new Embedder({
    enabled: true,
    baseUrl: "http://localhost:1234/v1/embeddings",
    model: "text-embedding-bge-m3",
  })

  it("full workflow: index -> search -> hybrid ranking", async () => {
    // 1. 创建测试数据库
    const db = new Database(":memory:")
    
    // 创建 FTS 表
    db.run(`
      CREATE VIRTUAL TABLE memory_fts USING fts5(
        path, scope, scope_id, type, body, fingerprint,
        tokenize='porter unicode61'
      )
    `)
    
    // 创建 Vec 表
    db.run(`
      CREATE TABLE memory_vec (
        memory_path TEXT PRIMARY KEY,
        embedding   BLOB NOT NULL,
        hash        TEXT NOT NULL,
        dimension   INTEGER NOT NULL DEFAULT 768,
        updated_at  INTEGER NOT NULL
      )
    `)

    // 2. 准备测试数据
    const docs = [
      { path: "/memory/api-design.md", body: "Use REST conventions for API endpoints. Follow HTTP methods properly." },
      { path: "/memory/testing.md", body: "Write unit tests with bun:test. Use describe/it/expect." },
      { path: "/memory/cooking.md", body: "How to make pasta carbonara with eggs and guanciale." },
      { path: "/memory/typescript.md", body: "TypeScript adds static types to JavaScript. Use interfaces and generics." },
    ]

    // 3. 索引到 FTS
    console.log("\n📝 Indexing documents...")
    for (const doc of docs) {
      const hash = hashContent(doc.body)
      db.run(
        `INSERT INTO memory_fts (path, scope, scope_id, type, body, fingerprint)
         VALUES (?, 'global', '', 'memory', ?, ?)`,
        [doc.path, doc.body, hash]
      )
      console.log(`  ✓ FTS: ${doc.path.split("/").pop()}`)
    }

    // 4. 索引到 Vec
    console.log("\n🔢 Generating embeddings...")
    for (const doc of docs) {
      const hash = hashContent(doc.body)
      const embedding = await embedder.embed(doc.body)
      const blob = Buffer.from(new Float32Array(embedding).buffer)
      db.run(
        `INSERT OR REPLACE INTO memory_vec (memory_path, embedding, hash, dimension, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [doc.path, blob, hash, embedding.length, Date.now()]
      )
      console.log(`  ✓ Vec: ${doc.path.split("/").pop()} (${embedding.length}d)`)
    }

    // 5. 测试 FTS 搜索
    console.log("\n🔍 FTS Search: 'API endpoint'")
    const ftsResults = db.query(`
      SELECT path, snippet(memory_fts, 4, '<b>', '</b>', '...', 32) AS snippet, scope, scope_id, type
      FROM memory_fts
      WHERE memory_fts MATCH 'API OR endpoint'
      ORDER BY rank
      LIMIT 5
    `).all() as any[]
    
    ftsResults.forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. ${r.path.split("/").pop()}: ${r.snippet}`)
    })
    expect(ftsResults.length).toBeGreaterThan(0)

    // 6. 测试 Vec 搜索
    console.log("\n🔢 Vec Search: 'HTTP endpoint naming'")
    const queryVec = await embedder.embed("HTTP endpoint naming")
    
    const vecRows = db.query(`SELECT memory_path, embedding FROM memory_vec`).all() as any[]
    const vecScores = vecRows.map(row => {
      const vec = new Float32Array(row.embedding.buffer)
      const score = Embedder.cosine(queryVec, Array.from(vec))
      return { path: row.memory_path, score }
    }).sort((a, b) => b.score - a.score)

    vecScores.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.path.split("/").pop()}: ${s.score.toFixed(4)}`)
    })
    expect(vecScores[0].path).toContain("api-design")

    // 7. 测试混合排序
    console.log("\n🔀 Hybrid Search: 'API endpoint naming'")
    const FTS_WEIGHT = 0.6
    const VEC_WEIGHT = 0.4
    const CO_OCCURRENCE_BOOST = 1.3

    const ftsRankMap = new Map(
      ftsResults.map((r: any, i: number) => [r.path, 1 - i / Math.max(ftsResults.length, 1)])
    )
    const vecNormMap = new Map(
      vecScores.map(r => [r.path, (r.score + 1) / 2])
    )

    const allPaths = new Set([...ftsRankMap.keys(), ...vecNormMap.keys()])
    const snippetMap = new Map(ftsResults.map((r: any) => [r.path, r.snippet]))

    const hybridResults = [...allPaths].map(path => {
      const fts = ftsRankMap.get(path) ?? 0
      const vec = vecNormMap.get(path) ?? 0
      const base = fts * FTS_WEIGHT + vec * VEC_WEIGHT
      const boost = (fts > 0 && vec > 0) ? CO_OCCURRENCE_BOOST : 1.0
      return {
        path,
        snippet: snippetMap.get(path) ?? "",
        score: base * boost,
        inFTS: fts > 0,
        inVec: vec > 0,
      }
    }).sort((a, b) => b.score - a.score)

    hybridResults.forEach((r, i) => {
      const tags = []
      if (r.inFTS) tags.push("FTS")
      if (r.inVec) tags.push("Vec")
      console.log(`  ${i + 1}. ${r.path.split("/").pop()}: ${r.score.toFixed(4)} [${tags.join("+")}]`)
    })

    // 验证：同时出现在 FTS 和 Vec 的文档应该排名更高
    const topResult = hybridResults[0]
    expect(topResult.inFTS && topResult.inVec).toBe(true)
    console.log("\n✅ Hybrid ranking works: co-occurring docs ranked higher!")

    // 8. 测试增量更新
    console.log("\n🔄 Incremental update test...")
    const updatePath = "/memory/api-design.md"
    const newBody = "Use REST conventions for API endpoints. Follow HTTP methods. Use proper status codes."
    const newHash = hashContent(newBody)
    
    const existing = db.query(`SELECT hash FROM memory_vec WHERE memory_path = ?`).get(updatePath) as any
    expect(existing).toBeTruthy()
    
    const oldHash = hashContent("Use REST conventions for API endpoints. Follow HTTP methods properly.")
    expect(existing.hash).toBe(hashContent("Use REST conventions for API endpoints. Follow HTTP methods properly."))
    console.log("  ✓ Hash check works (content unchanged)")
    
    console.log("\n🎉 All E2E tests passed!")
  })
})
