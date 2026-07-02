/**
 * Harness 层真实工作验证测试
 * 
 * 验证每个 harness 层的真实输入输出
 * 
 * 运行：cd packages/opencode && bun test test/e2e/harness-trace.test.ts --timeout 120000
 */

import { describe, it, expect, beforeAll } from "bun:test"
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

describe("Harness 层真实工作验证", () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "harness-trace-"))
  })

  it("1. History Service - 记录和搜索历史消息", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("1. History Service 真实工作记录")
    console.log("=".repeat(60))

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

      // 模拟真实的会话消息
      const messages = [
        { id: "msg-1", session: "session-1", part: "part-1", kind: "user_text" as const, content: "如何实现用户认证？" },
        { id: "msg-2", session: "session-1", part: "part-2", kind: "assistant_text" as const, content: "可以使用 JWT token 实现认证。首先需要安装 jsonwebtoken 包。" },
        { id: "msg-3", session: "session-1", part: "part-3", kind: "tool_output" as const, tool: "bash", content: "$ npm install jsonwebtoken\nadded 1 package" },
        { id: "msg-4", session: "session-1", part: "part-4", kind: "user_text" as const, content: "如何处理 token 过期？" },
        { id: "msg-5", session: "session-1", part: "part-5", kind: "assistant_text" as const, content: "可以使用 refresh token 机制。当 access token 过期时，使用 refresh token 获取新的 access token。" },
      ]

      console.log("\n📥 写入历史消息:")
      for (const msg of messages) {
        yield* history.ingest({
          message_id: msg.id,
          session_id: msg.session,
          part_id: msg.part,
          kind: msg.kind,
          tool_name: msg.tool,
          content: msg.content,
          time_created: Date.now(),
        })
        console.log(`  ✓ [${msg.kind}] ${msg.content.substring(0, 40)}...`)
      }

      console.log("\n🔍 搜索历史消息:")
      
      // 搜索 1: JWT 相关
      const jwtResults = yield* history.search({ query: "JWT token", limit: 3 })
      console.log(`  搜索 "JWT token" → ${jwtResults.length} 条结果:`)
      jwtResults.forEach((r, i) => {
        console.log(`    ${i + 1}. [${r.kind}] ${r.snippet.substring(0, 50)}...`)
      })

      // 搜索 2: refresh token
      const refreshResults = yield* history.search({ query: "refresh token", limit: 3 })
      console.log(`  搜索 "refresh token" → ${refreshResults.length} 条结果:`)
      refreshResults.forEach((r, i) => {
        console.log(`    ${i + 1}. [${r.kind}] ${r.snippet.substring(0, 50)}...`)
      })

      // 搜索 3: npm install
      const npmResults = yield* history.search({ query: "npm install", limit: 3 })
      console.log(`  搜索 "npm install" → ${npmResults.length} 条结果:`)
      npmResults.forEach((r, i) => {
        console.log(`    ${i + 1}. [${r.kind}] ${r.snippet.substring(0, 50)}...`)
      })

      return { jwtResults, refreshResults, npmResults }
    })

    const { jwtResults, refreshResults, npmResults } = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    expect(jwtResults.length).toBeGreaterThan(0)
    expect(refreshResults.length).toBeGreaterThan(0)
    expect(npmResults.length).toBeGreaterThan(0)
  })

  it("2. AlignmentGuard - 检测偏离并发送警报", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("2. AlignmentGuard 真实工作记录")
    console.log("=".repeat(60))

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

    const dbPath = path.join(tmpDir, "alignment.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

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

      console.log("\n🔍 检测 Rabbit Hole:")
      const rabbitHoleCommands = [
        ["npm install", "npm install", "npm install", "npm install", "npm install"],
        ["bun install", "bun install", "bun install", "bun install", "bun install"],
        ["git clone", "git clone", "git clone", "git clone", "git clone"],
      ]

      for (const commands of rabbitHoleCommands) {
        const isRabbitHole = yield* alignment.detectRabbitHole(commands)
        console.log(`  ${commands[0]} x${commands.length} → ${isRabbitHole ? "❌ 检测到" : "✅ 正常"}`)
      }

      console.log("\n🔍 检测 Distraction:")
      const distractionCommands = [
        "curl https://example.com",
        "wget https://example.com/file.zip",
        "open https://google.com",
        "say hello",
        "ls -la",  // 正常命令
        "cat file.txt",  // 正常命令
      ]

      for (const command of distractionCommands) {
        const isDistraction = yield* alignment.detectDistraction(command)
        console.log(`  "${command}" → ${isDistraction ? "❌ 检测到偏离" : "✅ 正常"}`)
      }

      console.log("\n📤 发送警报到 Inbox:")
      yield* alignment.sendAlert({
        sessionID: "session-test",
        level: "critical",
        reason: "Rabbit hole detected: 5 consecutive npm install commands",
        suggestion: "Try a different approach or ask for help",
        timestamp: Date.now(),
      })
      console.log("  ✓ 发送警报: Rabbit hole detected")

      yield* alignment.sendAlert({
        sessionID: "session-test",
        level: "warn",
        reason: "Distraction detected: curl command",
        suggestion: "Focus on the main task",
        timestamp: Date.now(),
      })
      console.log("  ✓ 发送警报: Distraction detected")

      console.log("\n📥 查询 Inbox 消息:")
      const messages = yield* inbox.list({ session_id: "session-test" })
      console.log(`  共 ${messages.length} 条消息:`)
      messages.forEach((m, i) => {
        console.log(`    ${i + 1}. [${m.sender_actor}] ${m.content.substring(0, 60)}...`)
      })

      return messages
    })

    const messages = await Effect.runPromise(
      program.pipe(Effect.provide(inboxLayer), Effect.provide(alignmentLayer), Effect.orDie)
    )

    expect(messages.length).toBe(2)
  })

  it("3. Judge Agent - 评估代码质量", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("3. Judge Agent 真实工作记录")
    console.log("=".repeat(60))

    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service

      const testCases = [
        {
          name: "好代码",
          diff: `
+ function authenticate(user: User): boolean {
+   if (!user.email) return false
+   if (!user.password) return false
+   return verifyPassword(user.password, user.hashedPassword)
+ }
+ expect(authenticate(validUser)).toBe(true)
+ expect(authenticate(invalidUser)).toBe(false)
`,
          files: ["auth.ts"],
        },
        {
          name: "断言减少",
          diff: `
- expect(user.isValid).toBe(true)
- expect(user.isActive).toBe(true)
- expect(user.email).toContain("@")
- expect(user.name).toBeDefined()
+ expect(user).toBeTruthy()
`,
          files: ["test.ts"],
        },
        {
          name: "安全问题",
          diff: `
+ const password = "hardcoded"
+ process.env.SECRET_KEY = password
`,
          files: ["security.ts"],
        },
        {
          name: "混合命名",
          diff: `
+ const userName = "test"
+ const user_name = "test"
+ const getUser = () => {}
+ const get_user = () => {}
+ const camelCase = true
+ const snake_case = true
+ const anotherCamel = true
+ const another_snake = true
+ const moreCamelCase = true
+ const more_snake_case = true
`,
          files: ["naming.ts"],
        },
      ]

      console.log("\n🔍 评估代码质量:")
      for (const testCase of testCases) {
        const result = yield* judge.evaluate({
          diff: testCase.diff,
          changedFiles: testCase.files,
        })

        console.log(`\n  📋 ${testCase.name}:`)
        console.log(`    决策: ${result.decision === "approve" ? "✅ 通过" : result.decision === "warn" ? "⚠️ 警告" : "❌ 拒绝"}`)
        console.log(`    原因: ${result.reason}`)
        console.log(`    检查详情:`)
        result.checks.forEach(check => {
          const icon = check.passed ? "✅" : "❌"
          console.log(`      ${icon} ${check.name}: ${check.reason}`)
        })
      }
    })

    await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )
  })

  it("4. Max Mode - 并行候选生成", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("4. Max Mode 真实工作记录")
    console.log("=".repeat(60))

    const program = Effect.gen(function* () {
      const maxMode = yield* MaxMode.Service

      console.log("\n🚀 生成候选:")
      console.log("  输入: 实现用户登录接口")
      console.log("  候选数量: 3")

      const result = yield* maxMode.runMaxStep({
        sessionID: "session-max" as any,
        messages: [{ role: "user", content: "实现用户登录接口" }],
        model: { id: "test-model" } as any,
        candidates: 3,
      })

      console.log(`\n📊 候选评估结果:`)
      console.log(`  候选数量: ${result.candidates.length}`)
      console.log(`  获胜者: ${result.winner.id}`)
      console.log(`  获胜者分数: ${result.winner.score.toFixed(4)}`)
      
      console.log(`\n  详细评分:`)
      result.candidates.forEach((c, i) => {
        console.log(`    ${i + 1}. ${c.id}:`)
        console.log(`       分数: ${c.score.toFixed(4)}`)
        console.log(`       Judge: ${c.judgeResult?.approved ? "✅ 通过" : "❌ 拒绝"}`)
        console.log(`       原因: ${c.judgeResult?.reason}`)
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
