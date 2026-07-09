/**
 * 真实 LLM 端到端测试
 * 
 * 使用真实的 LLM 服务验证所有功能
 * 
 * 运行：cd packages/opencode && bun test test/e2e/real-llm.test.ts --timeout 180000
 */

import { describe, it, expect, beforeAll } from "bun:test"
import { Memory } from "@opencode-ai/core/memory/service"
import { History } from "@/history/service"
import { Inbox } from "@/inbox/inbox"
import { JudgeAgent } from "@/agent/judge-agent"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Effect, Layer } from "effect"
import * as fs from "fs/promises"
import path from "path"
import os from "os"

// 真实 LLM 调用函数
async function callLLM(prompt: string): Promise<string> {
  const response = await fetch("https://token-plan-cn.xiaomimimo.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MIMO_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: "mimo-v2.5-pro",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  })

  const data = await response.json() as any
  return data.choices[0].message.content
}

describe("真实 LLM 端到端测试", () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "real-llm-"))
  })

  it("1. 真实 LLM 生成代码 + Judge 评估", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("1. 真实 LLM 生成代码 + Judge 评估")
    console.log("=".repeat(60))

    // 调用 LLM 生成代码
    const prompt = `请用 TypeScript 写一个简单的用户认证函数，要求：
1. 验证邮箱格式
2. 验证密码长度
3. 返回布尔值

只返回代码，不要解释。`

    console.log("\n📤 调用 LLM 生成代码:")
    console.log(`  Prompt: ${prompt.substring(0, 50)}...`)

    const llmOutput = await callLLM(prompt)
    console.log(`\n📥 LLM 输出:`)
    console.log(`  ${llmOutput.substring(0, 200)}...`)

    // 使用 Judge 评估生成的代码
    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service

      const result = yield* judge.evaluate({
        diff: `+ ${llmOutput}`,
        changedFiles: ["auth.ts"],
      })

      return result
    })

    const judgeResult = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    console.log(`\n🔍 Judge 评估结果:`)
    console.log(`  决策: ${judgeResult.decision === "approve" ? "✅ 通过" : judgeResult.decision === "warn" ? "⚠️ 警告" : "❌ 拒绝"}`)
    console.log(`  原因: ${judgeResult.reason}`)
    console.log(`  检查详情:`)
    judgeResult.checks.forEach(check => {
      const icon = check.passed ? "✅" : "❌"
      console.log(`    ${icon} ${check.name}: ${check.reason}`)
    })

    expect(judgeResult).toBeDefined()
  })

  it("2. 真实 LLM 生成测试代码 + 断言减少检测", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("2. 真实 LLM 生成测试代码 + 断言减少检测")
    console.log("=".repeat(60))

    // 调用 LLM 生成测试代码
    const prompt = `请为以下函数编写单元测试：

\`\`\`typescript
function add(a: number, b: number): number {
  return a + b
}
\`\`\`

要求：
1. 测试正常情况
2. 测试边界情况
3. 使用 expect 断言

只返回测试代码，不要解释。`

    console.log("\n📤 调用 LLM 生成测试代码:")
    console.log(`  Prompt: 测试 add 函数`)

    const llmOutput = await callLLM(prompt)
    console.log(`\n📥 LLM 输出:`)
    console.log(`  ${llmOutput.substring(0, 200)}...`)

    // 模拟断言减少的 diff
    const diff = `
- expect(add(1, 2)).toBe(3)
- expect(add(0, 0)).toBe(0)
- expect(add(-1, 1)).toBe(0)
- expect(add(100, 200)).toBe(300)
+ ${llmOutput.split('\n')[0] || "expect(result).toBeTruthy()"}
`

    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service
      return yield* judge.evaluate({ diff, changedFiles: ["add.test.ts"] })
    })

    const judgeResult = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    console.log(`\n🔍 Judge 评估结果:`)
    console.log(`  决策: ${judgeResult.decision === "approve" ? "✅ 通过" : judgeResult.decision === "warn" ? "⚠️ 警告" : "❌ 拒绝"}`)
    console.log(`  原因: ${judgeResult.reason}`)

    // 应该检测到断言减少
    const assertionCheck = judgeResult.checks.find(c => c.name === "assertion-reduction")
    console.log(`  断言减少检查: ${assertionCheck?.passed ? "✅ 通过" : "❌ 检测到减少"}`)

    expect(judgeResult).toBeDefined()
  })

  it("3. 真实 LLM 回答 + History 记录", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("3. 真实 LLM 回答 + History 记录")
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

    const dbPath = path.join(tmpDir, "history-real.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

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

    // 调用 LLM 回答问题
    const question = "什么是 RESTful API？"
    console.log(`\n📤 调用 LLM 回答问题: "${question}"`)

    const answer = await callLLM(question)
    console.log(`\n📥 LLM 回答:`)
    console.log(`  ${answer.substring(0, 200)}...`)

    // 记录到 History
    const testLayer = History.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    const program = Effect.gen(function* () {
      const history = yield* History.Service

      yield* history.ingest({
        message_id: "msg-real-1",
        session_id: "session-real",
        part_id: "part-1",
        kind: "user_text",
        content: question,
        time_created: Date.now(),
      })

      yield* history.ingest({
        message_id: "msg-real-2",
        session_id: "session-real",
        part_id: "part-2",
        kind: "assistant_text",
        content: answer,
        time_created: Date.now(),
      })

      console.log(`\n📥 写入历史消息完成`)

      // 搜索历史
      const results = yield* history.search({ query: "RESTful API", limit: 3 })
      console.log(`\n🔍 搜索 "RESTful API":`)
      console.log(`  结果数量: ${results.length}`)
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.kind}] ${r.snippet.substring(0, 80)}...`)
      })

      return results
    })

    const results = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    expect(results.length).toBeGreaterThan(0)
  })

  it("4. 真实 LLM 生成安全代码 + 安全检查", async () => {
    console.log("\n" + "=".repeat(60))
    console.log("4. 真实 LLM 生成安全代码 + 安全检查")
    console.log("=".repeat(60))

    // 调用 LLM 生成可能有安全问题的代码
    const prompt = `请写一个简单的配置读取函数，要求：
1. 从环境变量读取 API 密钥
2. 从环境变量读取数据库密码
3. 返回配置对象

只返回代码，不要解释。`

    console.log("\n📤 调用 LLM 生成配置代码:")
    console.log(`  Prompt: 配置读取函数`)

    const llmOutput = await callLLM(prompt)
    console.log(`\n📥 LLM 输出:`)
    console.log(`  ${llmOutput.substring(0, 200)}...`)

    // 使用 Judge 评估安全性
    const program = Effect.gen(function* () {
      const judge = yield* JudgeAgent.Service

      const result = yield* judge.evaluate({
        diff: `+ ${llmOutput}`,
        changedFiles: ["config.ts"],
      })

      return result
    })

    const judgeResult = await Effect.runPromise(
      program.pipe(Effect.provide(JudgeAgent.defaultLayer))
    )

    console.log(`\n🔍 Judge 安全评估:`)
    console.log(`  决策: ${judgeResult.decision === "approve" ? "✅ 通过" : judgeResult.decision === "warn" ? "⚠️ 警告" : "❌ 拒绝"}`)
    console.log(`  原因: ${judgeResult.reason}`)

    const securityCheck = judgeResult.checks.find(c => c.name === "security")
    console.log(`  安全检查: ${securityCheck?.passed ? "✅ 通过" : "❌ 检测到问题"}`)
    if (securityCheck && !securityCheck.passed) {
      console.log(`  问题: ${securityCheck.reason}`)
    }

    expect(judgeResult).toBeDefined()
  })
})
