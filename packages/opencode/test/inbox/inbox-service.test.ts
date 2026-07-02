/**
 * Inbox Service 测试
 * 
 * 运行：cd packages/opencode && bun test test/inbox/inbox-service.test.ts --timeout 60000
 */

import { describe, it, expect, beforeAll } from "bun:test"
import { Inbox } from "@/inbox/inbox"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Effect, Layer } from "effect"
import * as fs from "fs/promises"
import path from "path"
import os from "os"

describe("Inbox Service", () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inbox-test-"))
  })

  it("should send and receive messages", async () => {
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

    const testLayer = Inbox.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    const program = Effect.gen(function* () {
      const inbox = yield* Inbox.Service

      // 发送消息
      const msg1 = yield* inbox.send({
        receiver_session: "session-1",
        receiver_actor: "user",
        sender_actor: "alignment-guard",
        content: "Rabbit hole detected",
        type: "alignment_alert",
      })

      const msg2 = yield* inbox.send({
        receiver_session: "session-1",
        receiver_actor: "user",
        sender_actor: "cardinal",
        content: "High risk operation",
        type: "cardinal_alert",
      })

      const msg3 = yield* inbox.send({
        receiver_session: "session-2",
        receiver_actor: "user",
        sender_actor: "alignment-guard",
        content: "File drift detected",
        type: "alignment_alert",
      })

      console.log("✓ Sent 3 messages")

      // 列出 session-1 的消息
      const session1Messages = yield* inbox.list({ session_id: "session-1" })
      console.log("✓ Session 1 messages:", session1Messages.length)
      session1Messages.forEach((m, i) => {
        console.log(`  ${i + 1}. [${m.sender_actor}] ${m.content}`)
      })

      // 列出未读消息
      const unreadMessages = yield* inbox.list({ session_id: "session-1", unread_only: true })
      console.log("✓ Unread messages:", unreadMessages.length)

      // 标记已读
      yield* inbox.markRead(msg1.id)
      console.log("✓ Marked message as read")

      // 再次列出未读消息
      const unreadAfter = yield* inbox.list({ session_id: "session-1", unread_only: true })
      console.log("✓ Unread after markRead:", unreadAfter.length)

      // 标记全部已读
      yield* inbox.markAllRead("session-1")
      console.log("✓ Marked all as read")

      const unreadFinal = yield* inbox.list({ session_id: "session-1", unread_only: true })
      console.log("✓ Unread final:", unreadFinal.length)

      return { session1Messages, unreadMessages, unreadAfter, unreadFinal }
    })

    const { session1Messages, unreadMessages, unreadAfter, unreadFinal } = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    expect(session1Messages.length).toBe(2)
    expect(unreadMessages.length).toBe(2)
    expect(unreadAfter.length).toBe(1)
    expect(unreadFinal.length).toBe(0)
  })
})
