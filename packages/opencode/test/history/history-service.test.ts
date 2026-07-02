/**
 * History Service 测试
 * 
 * 运行：cd packages/opencode && bun test test/history/history-service.test.ts --timeout 60000
 */

import { describe, it, expect, beforeAll } from "bun:test"
import { History } from "@/history/service"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Effect, Layer } from "effect"
import * as fs from "fs/promises"
import path from "path"
import os from "os"

describe("History Service", () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "history-test-"))
  })

  it("should ingest and search messages", async () => {
    const testGlobal = Layer.succeed(Global.Service, Global.Service.of({
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

    const dbPath = path.join(tmpDir, "test.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

    // 手动创建 history_fts 和 history_meta 表
    const initProgram = Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
          message_id,
          session_id,
          part_id,
          kind,
          tool_name,
          content,
          time_created,
          tokenize='porter unicode61'
        )
      `).pipe(Effect.orDie)

      yield* db.run(`
        CREATE TABLE IF NOT EXISTS history_meta (
          message_id   TEXT NOT NULL,
          session_id   TEXT NOT NULL,
          part_id      TEXT NOT NULL,
          kind         TEXT NOT NULL,
          tool_name    TEXT,
          time_created INTEGER NOT NULL,
          fingerprint  TEXT NOT NULL,
          PRIMARY KEY (message_id, part_id)
        )
      `).pipe(Effect.orDie)
    })
    await Effect.runPromise(initProgram.pipe(Effect.provide(testDatabase), Effect.orDie))

    const testLayer = History.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    const program = Effect.gen(function* () {
      const history = yield* History.Service

      // 写入测试数据
      yield* history.ingest({
        message_id: "msg-1",
        session_id: "session-1",
        part_id: "part-1",
        kind: "user_text",
        content: "How to design REST API endpoints?",
        time_created: Date.now(),
      })

      yield* history.ingest({
        message_id: "msg-2",
        session_id: "session-1",
        part_id: "part-2",
        kind: "assistant_text",
        content: "Use plural nouns for resources like /users and /orders",
        time_created: Date.now(),
      })

      yield* history.ingest({
        message_id: "msg-3",
        session_id: "session-2",
        part_id: "part-3",
        kind: "tool_output",
        tool_name: "read",
        content: "File content of api-design.md",
        time_created: Date.now(),
      })

      // 搜索
      const results = yield* history.search({ query: "REST API", limit: 5 })
      console.log("✓ Search results:", results.length)
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.kind}] snippet:`, r.snippet)
        console.log(`     message_id: ${r.message_id}, session_id: ${r.session_id}`)
      })

      return results
    })

    const results = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    expect(results.length).toBeGreaterThan(0)
    // 检查搜索结果
    expect(results[0].message_id).toBeDefined()
  })
})
