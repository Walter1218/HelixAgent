/**
 * Inbox LLM 端到端测试
 * 
 * 验证：AlignmentGuard 检测到偏离时，Inbox 中会创建消息
 * 
 * 运行：cd packages/opencode && bun test test/inbox/e2e-llm.test.ts --timeout 60000
 */

import { describe, it, expect, beforeAll } from "bun:test"
import { Inbox } from "@/inbox/inbox"
import { AlignmentGuard } from "@/observability/alignment-guard"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Effect, Layer } from "effect"
import * as fs from "fs/promises"
import path from "path"
import os from "os"

describe("Inbox LLM 端到端测试", () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inbox-e2e-"))
  })

  it("场景 1: AlignmentGuard 检测偏离时发送 Inbox 消息", async () => {
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

    // 手动创建 inbox 表
    const initProgram = Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db.run(`
        CREATE TABLE IF NOT EXISTS inbox (
          id               TEXT PRIMARY KEY,
          receiver_session TEXT NOT NULL,
          receiver_actor   TEXT NOT NULL,
          sender_actor     TEXT NOT NULL,
          content          TEXT NOT NULL,
          type             TEXT NOT NULL,
          read             INTEGER NOT NULL DEFAULT 0,
          time_created     INTEGER NOT NULL
        )
      `).pipe(Effect.orDie)

      yield* db.run(`
        CREATE INDEX IF NOT EXISTS idx_inbox_receiver ON inbox(receiver_session, receiver_actor)
      `).pipe(Effect.orDie)

      yield* db.run(`
        CREATE INDEX IF NOT EXISTS idx_inbox_unread ON inbox(receiver_session, read)
      `).pipe(Effect.orDie)
    })
    await Effect.runPromise(initProgram.pipe(Effect.provide(testDatabase), Effect.orDie))

    // 创建 Inbox layer
    const inboxLayer = Inbox.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    // 创建 AlignmentGuard layer（依赖 Inbox）
    const alignmentLayer = AlignmentGuard.layer.pipe(
      Layer.provide(inboxLayer),
    )

    const program = Effect.gen(function* () {
      const alignment = yield* AlignmentGuard.Service
      const inbox = yield* Inbox.Service

      // 模拟检测到 rabbit hole
      const commands = ["npm install", "npm install", "npm install", "npm install", "npm install"]
      const isRabbitHole = yield* alignment.detectRabbitHole(commands)
      console.log("✓ detectRabbitHole:", isRabbitHole)

      if (isRabbitHole) {
        // 发送警报
        yield* alignment.sendAlert({
          sessionID: "session-1",
          level: "critical",
          reason: "Rabbit hole detected: 5 consecutive install commands",
          suggestion: "Try a different approach or ask for help",
          timestamp: Date.now(),
        })
        console.log("✓ Sent alert to inbox")
      }

      // 检查 inbox
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
    expect(messages[0].type).toBe("alignment_alert")
  })

  it("场景 2: 检测 distraction 时发送 Inbox 消息", async () => {
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

    const dbPath = path.join(tmpDir, "test2.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

    const initProgram = Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db.run(`
        CREATE TABLE IF NOT EXISTS inbox (
          id               TEXT PRIMARY KEY,
          receiver_session TEXT NOT NULL,
          receiver_actor   TEXT NOT NULL,
          sender_actor     TEXT NOT NULL,
          content          TEXT NOT NULL,
          type             TEXT NOT NULL,
          read             INTEGER NOT NULL DEFAULT 0,
          time_created     INTEGER NOT NULL
        )
      `).pipe(Effect.orDie)

      yield* db.run(`
        CREATE INDEX IF NOT EXISTS idx_inbox_receiver ON inbox(receiver_session, receiver_actor)
      `).pipe(Effect.orDie)

      yield* db.run(`
        CREATE INDEX IF NOT EXISTS idx_inbox_unread ON inbox(receiver_session, read)
      `).pipe(Effect.orDie)
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

      // 模拟检测到 distraction
      const command = "curl https://example.com"
      const isDistraction = yield* alignment.detectDistraction(command)
      console.log("✓ detectDistraction:", isDistraction)

      if (isDistraction) {
        yield* alignment.sendAlert({
          sessionID: "session-2",
          level: "warn",
          reason: "Distraction detected: curl command",
          suggestion: "Focus on the main task",
          timestamp: Date.now(),
        })
        console.log("✓ Sent distraction alert to inbox")
      }

      const messages = yield* inbox.list({ session_id: "session-2" })
      console.log("✓ Inbox messages:", messages.length)

      return { isDistraction, messages }
    })

    const { isDistraction, messages } = await Effect.runPromise(
      program.pipe(Effect.provide(inboxLayer), Effect.provide(alignmentLayer), Effect.orDie)
    )

    expect(isDistraction).toBe(true)
    expect(messages.length).toBe(1)
    expect(messages[0].sender_actor).toBe("alignment-guard")
  })
})
