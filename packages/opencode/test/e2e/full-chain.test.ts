/**
 * 全功能端到端测试（带 LLM）
 * 
 * 验证：
 * 1. Memory Vector Store - 搜索记忆
 * 2. History Service - 搜索历史消息
 * 3. Inbox System - AlignmentGuard 发送警报
 * 4. Judge System - 评估代码质量
 * 5. Max Mode - 并行候选生成
 * 
 * 运行：cd packages/opencode && bun test test/e2e/full-chain.test.ts --timeout 120000
 */

import { describe, it, expect, beforeAll } from "bun:test"
import { Memory } from "@opencode-ai/core/memory/service"
import { History } from "@/history/service"
import { Inbox } from "@/inbox/inbox"
import { JudgeAgent } from "@/agent/judge-agent"
import { MaxMode } from "@/session/max-mode"
import { AlignmentGuard } from "@/observability/alignment-guard"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Effect, Layer } from "effect"
import * as fs from "fs/promises"
import path from "path"
import os from "os"

describe("全功能端到端测试", () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "full-chain-"))
  })

  it("场景 1: Memory Vector Store 搜索记忆", async () => {
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

    const dbPath = path.join(tmpDir, "memory.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

    // 创建 memory_vec 表
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

    // 创建 memory 文件
    const memoryDir = path.join(tmpDir, "data", "memory", "global")
    await fs.mkdir(memoryDir, { recursive: true })
    await fs.writeFile(
      path.join(memoryDir, "api-conventions.md"),
      "# API Conventions\n\nUse REST conventions for API endpoints. Use plural nouns for resources."
    )

    const testLayer = Memory.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    const program = Effect.gen(function* () {
      const memory = yield* Memory.Service

      // 索引 memory
      const reconcileResult = yield* memory.reconcile()
      console.log("✓ Memory reconcile:", reconcileResult)

      // 搜索
      const results = yield* memory.search({ query: "How to design API?", limit: 3 })
      console.log("✓ Memory search results:", results.length)
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${path.basename(r.path)}: score=${r.score.toFixed(4)}`)
      })

      return { reconcileResult, results }
    })

    const { reconcileResult, results } = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    expect(reconcileResult.indexed).toBeGreaterThan(0)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].path).toContain("api-conventions")
  })

  it("场景 2: History Service 搜索历史消息", async () => {
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

    const dbPath = path.join(tmpDir, "history.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

    // 创建 history_fts 表
    const initProgram = Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
          message_id, session_id, part_id, kind, tool_name, content, time_created,
          tokenize='porter unicode61'
        )
      `).pipe(Effect.orDie)

      yield* db.run(`
        CREATE TABLE IF NOT EXISTS history_meta (
          message_id TEXT NOT NULL, session_id TEXT NOT NULL, part_id TEXT NOT NULL,
          kind TEXT NOT NULL, tool_name TEXT, time_created INTEGER NOT NULL,
          fingerprint TEXT NOT NULL, PRIMARY KEY (message_id, part_id)
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

      // 写入历史消息
      yield* history.ingest({
        message_id: "msg-1",
        session_id: "session-1",
        part_id: "part-1",
        kind: "user_text",
        content: "How to implement OAuth2 authentication?",
        time_created: Date.now(),
      })

      yield* history.ingest({
        message_id: "msg-2",
        session_id: "session-1",
        part_id: "part-2",
        kind: "assistant_text",
        content: "Use passport.js with OAuth2 strategy for authentication.",
        time_created: Date.now(),
      })

      // 搜索
      const results = yield* history.search({ query: "OAuth2 authentication", limit: 3 })
      console.log("✓ History search results:", results.length)
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.kind}] ${r.snippet.substring(0, 50)}...`)
      })

      return results
    })

    const results = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].snippet).toContain("OAuth2")
  })

  it("场景 3: Inbox System + AlignmentGuard 警报", async () => {
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

    const dbPath = path.join(tmpDir, "inbox.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

    // 创建 inbox 表
    const initProgram = Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db.run(`
        CREATE TABLE IF NOT EXISTS inbox (
          id TEXT PRIMARY KEY, receiver_session TEXT NOT NULL, receiver_actor TEXT NOT NULL,
          sender_actor TEXT NOT NULL, content TEXT NOT NULL, type TEXT NOT NULL,
          read INTEGER NOT NULL DEFAULT 0, time_created INTEGER NOT NULL
        )
      `).pipe(Effect.orDie)
      yield* db.run(`CREATE INDEX IF NOT EXISTS idx_inbox_receiver ON inbox(receiver_session, receiver_actor)`).pipe(Effect.orDie)
    })
    await Effect.runPromise(initProgram.pipe(Effect.provide(testDatabase), Effect.orDie))

    const inboxLayer = Inbox.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    const alignmentLayer = AlignmentGuard.layer.pipe(
      Layer.provide(inboxLayer),
    )

    const program = Effect.gen(function* () {
      const alignment = yield* AlignmentGuard.Service
      const inbox = yield* Inbox.Service

      // 检测 rabbit hole
      const commands = ["npm install", "npm install", "npm install", "npm install", "npm install"]
      const isRabbitHole = yield* alignment.detectRabbitHole(commands)
      console.log("✓ detectRabbitHole:", isRabbitHole)

      if (isRabbitHole) {
        yield* alignment.sendAlert({
          sessionID: "session-1",
          level: "critical",
          reason: "Rabbit hole detected: 5 consecutive install commands",
          suggestion: "Try a different approach",
          timestamp: Date.now(),
        })
        console.log("✓ Sent alert to inbox")
      }

      const messages = yield* inbox.list({ session_id: "session-1" })
      console.log("✓ Inbox messages:", messages.length)
      messages.forEach((m, i) => {
        console.log(`  ${i + 1}. [${m.sender_actor}] ${m.content.substring(0, 50)}...`)
      })

      return { isRabbitHole, messages }
    })

    const { isRabbitHole, messages } = await Effect.runPromise(
      program.pipe(Effect.provide(inboxLayer), Effect.provide(alignmentLayer), Effect.orDie)
    )

    expect(isRabbitHole).toBe(true)
    expect(messages.length).toBe(1)
    expect(messages[0].sender_actor).toBe("alignment-guard")
  })

  it("场景 4: Judge System 评估代码质量", async () => {
    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service

      // 测试 1: 好的代码
      const goodDiff = `
+ function authenticate(user: User): boolean {
+   return user.isValid && user.isActive
+ }
+ expect(authenticate(validUser)).toBe(true)
`
      const goodResult = yield* judge.evaluate({ diff: goodDiff, changedFiles: ["auth.ts"] })
      console.log("✓ Good code:", goodResult.decision)

      // 测试 2: 有问题的代码（断言减少）
      const badDiff = `
- expect(user.isValid).toBe(true)
- expect(user.isActive).toBe(true)
- expect(user.email).toContain("@")
- expect(user.name).toBeDefined()
+ expect(user).toBeTruthy()
`
      const badResult = yield* judge.evaluate({ diff: badDiff, changedFiles: ["test.ts"] })
      console.log("✓ Bad code (assertion reduction):", badResult.decision)

      // 测试 3: 安全问题
      const securityDiff = `
+ const password = "hardcoded"
+ process.env.SECRET_KEY = password
`
      const securityResult = yield* judge.evaluate({ diff: securityDiff, changedFiles: ["security.ts"] })
      console.log("✓ Security issue:", securityResult.decision)

      return { goodResult, badResult, securityResult }
    })

    const { goodResult, badResult, securityResult } = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    expect(goodResult.decision).toBe("approve")
    expect(badResult.decision).toBe("reject")
    expect(securityResult.decision).toBe("reject")
  })

  it("场景 5: Max Mode 并行候选生成", async () => {
    const program = Effect.gen(function* () {
      const maxMode = yield* MaxMode.Service

      const result = yield* maxMode.runMaxStep({
        sessionID: "session-1" as any,
        messages: [{ role: "user", content: "Implement user authentication" }],
        model: { id: "test-model" } as any,
        candidates: 3,
      })

      console.log("✓ Max Mode result:")
      console.log("  Candidates:", result.candidates.length)
      console.log("  Winner:", result.winner.id)
      console.log("  Winner score:", result.winner.score.toFixed(4))
      result.candidates.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.id}: score=${c.score.toFixed(4)}, judge=${c.judgeResult?.approved}`)
      })

      return result
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(MaxMode.defaultLayer))
    )

    expect(result.candidates.length).toBe(3)
    expect(result.winner.score).toBeGreaterThan(0)
  })
})
