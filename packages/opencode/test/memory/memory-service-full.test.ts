import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { Memory } from "@opencode-ai/core/memory/service"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Effect, Layer, Context } from "effect"
import * as fs from "fs/promises"
import path from "path"
import os from "os"

const EMBEDDING_ENABLED = process.env.TEST_EMBEDDING === "1"

describe("Memory.Service full integration", () => {
  let tmpDir: string
  let dbPath: string
  let memoryDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-test-"))
    dbPath = path.join(tmpDir, "test.db")
    
    // Memory 文件必须在 memory/global/ 目录下
    memoryDir = path.join(tmpDir, "data", "memory", "global")
    await fs.mkdir(memoryDir, { recursive: true })

    await fs.writeFile(
      path.join(memoryDir, "api-design.md"),
      "# API Design\n\nUse REST conventions for API endpoints. Follow HTTP methods properly."
    )
    await fs.writeFile(
      path.join(memoryDir, "testing.md"),
      "# Testing\n\nWrite unit tests with bun:test. Use describe/it/expect for assertions."
    )
    await fs.writeFile(
      path.join(memoryDir, "cooking.md"),
      "# Cooking\n\nHow to make pasta carbonara with eggs and guanciale."
    )

    // 验证文件创建成功
    const files = await fs.readdir(memoryDir)
    console.log("📁 Created test files in:", memoryDir)
    console.log("   Files:", files)
  })

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  // 创建测试用的 Global layer，指向临时目录
  function makeTestGlobalLayer() {
    return Layer.succeed(Global.Service, Global.Service.of({
      home: tmpDir,
      data: path.join(tmpDir, "data"),
      cache: path.join(tmpDir, "cache"),
      config: path.join(tmpDir, "config"),
      state: path.join(tmpDir, "state"),
      tmp: path.join(tmpDir, "tmp"),
      bin: path.join(tmpDir, "bin"),
      log: path.join(tmpDir, "log"),
      repos: path.join(tmpDir, "repos"),
    }))
  }

  it("should reconcile and search with FTS", async () => {
    // 先直接测试 walkMemoryDir
    const { walkMemoryDir, reconcileMemory } = await import("@opencode-ai/core/memory/reconcile")
    const testMemoryDir = path.join(tmpDir, "data", "memory")
    
    console.log("🔍 Testing walkMemoryDir on:", testMemoryDir)
    const walked = await walkMemoryDir(testMemoryDir)
    console.log("🚶 walkMemoryDir found:", walked)
    
    const reconciled = await reconcileMemory({ mimo: testMemoryDir })
    console.log("🔄 reconcileMemory:", reconciled)

    // 创建自定义 Database layer 使用测试 Global
    const testGlobal = makeTestGlobalLayer()
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

    // 手动创建 memory_vec 表（向量检索默认启用）
    const initProgram = Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db.run(`
        CREATE TABLE IF NOT EXISTS memory_vec (
          memory_path TEXT PRIMARY KEY,
          embedding   BLOB NOT NULL,
          hash        TEXT NOT NULL,
          dimension   INTEGER NOT NULL DEFAULT 768,
          updated_at  INTEGER NOT NULL
        )
      `).pipe(Effect.orDie)
    })
    await Effect.runPromise(initProgram.pipe(Effect.provide(testDatabase), Effect.orDie))
    
    const testLayer = Memory.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    const program = Effect.gen(function* () {
      const memory = yield* Memory.Service

      const result = yield* memory.reconcile()
      console.log("✓ Reconcile:", result)

      const results = yield* memory.search({ query: "API endpoint", limit: 5 })
      console.log("✓ FTS search results:")
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${path.basename(r.path)}: ${r.snippet} (score: ${r.score})`)
      })

      return { reconcile: result, results }
    })

    const { reconcile, results } = await Effect.runPromise(
      program.pipe(
        Effect.provide(testLayer),
        Effect.orDie
      )
    )

    expect(reconcile.indexed).toBeGreaterThan(0)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].path).toContain("api-design")
  })

  it.skipIf(!EMBEDDING_ENABLED)("should reconcile and search with hybrid (FTS + Vec)", async () => {
    // 使用新的数据库，确保向量索引被建立
    const hybridDbPath = path.join(tmpDir, "test-hybrid.db")
    const origEnabled = process.env.MEMORY_EMBEDDING_ENABLED
    process.env.MEMORY_EMBEDDING_ENABLED = "1"

    try {
      // 创建自定义 Database layer 使用测试 Global
      const testGlobal = makeTestGlobalLayer()
      const testDatabase = Database.layerFromPath(hybridDbPath).pipe(
        Layer.provide(testGlobal),
      )
      
      // 手动创建 memory_vec 表
      const initProgram = Effect.gen(function* () {
        const { db } = yield* Database.Service
        yield* db.run(`
          CREATE TABLE IF NOT EXISTS memory_vec (
            memory_path TEXT PRIMARY KEY,
            embedding   BLOB NOT NULL,
            hash        TEXT NOT NULL,
            dimension   INTEGER NOT NULL DEFAULT 768,
            updated_at  INTEGER NOT NULL
          )
        `).pipe(Effect.orDie)
        yield* db.run(`CREATE INDEX IF NOT EXISTS idx_memory_vec_hash ON memory_vec(hash)`).pipe(Effect.orDie)
        console.log("✓ memory_vec table created")
      })
      await Effect.runPromise(initProgram.pipe(Effect.provide(testDatabase), Effect.orDie))

      const testLayer = Memory.layer.pipe(
        Layer.provide(testDatabase),
        Layer.provide(testGlobal),
      )

      const program = Effect.gen(function* () {
        const memory = yield* Memory.Service

        // reconcile 会建立 FTS + 向量索引
        const result = yield* memory.reconcile()
        console.log("✓ Hybrid reconcile:", result)

        const results = yield* memory.search({ query: "HTTP endpoint naming", limit: 5 })
        console.log("✓ Hybrid search results:")
        results.forEach((r, i) => {
          console.log(`  ${i + 1}. ${path.basename(r.path)}: score=${r.score.toFixed(4)}`)
        })

        return { reconcile: result, results }
      })

      const { reconcile, results } = await Effect.runPromise(
        program.pipe(
          Effect.provide(testLayer),
          Effect.orDie
        )
      )

      expect(reconcile.indexed).toBeGreaterThan(0)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].path).toContain("api-design")
      expect(results[0].score).toBeGreaterThan(0)
    } finally {
      if (origEnabled !== undefined) {
        process.env.MEMORY_EMBEDDING_ENABLED = origEnabled
      } else {
        delete process.env.MEMORY_EMBEDDING_ENABLED
      }
    }
  })
})
