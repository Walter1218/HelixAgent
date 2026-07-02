/**
 * Memory LLM 端到端测试
 * 
 * 模拟真实场景：用户查询 → memory tool 调用 → 返回结果
 * 
 * 运行：cd packages/opencode && bun test test/memory/e2e-llm.test.ts --timeout 60000
 */

import { describe, it, expect, beforeAll } from "bun:test"
import { Memory } from "@opencode-ai/core/memory/service"
import { Database } from "@opencode-ai/core/database/database"
import { Global } from "@opencode-ai/core/global"
import { Effect, Layer } from "effect"
import * as fs from "fs/promises"
import path from "path"
import os from "os"

describe("Memory LLM 端到端测试", () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "e2e-llm-"))
    
    // 创建模拟的 memory 文件
    const memoryDir = path.join(tmpDir, "data", "memory", "global")
    await fs.mkdir(memoryDir, { recursive: true })
    
    await fs.writeFile(
      path.join(memoryDir, "api-conventions.md"),
      `# API Conventions

## RESTful Design
- Use plural nouns for resources: /users, /orders
- Use HTTP methods: GET (read), POST (create), PUT (update), DELETE (delete)
- Use proper status codes: 200 OK, 201 Created, 404 Not Found

## Error Handling
- Return consistent error format: { error: { code, message } }
- Use appropriate HTTP status codes
- Include request ID for debugging

## Authentication
- Use Bearer tokens in Authorization header
- Implement token refresh mechanism
- Rate limit API endpoints
`
    )
    
    await fs.writeFile(
      path.join(memoryDir, "testing-strategies.md"),
      `# Testing Strategies

## Unit Testing
- Use bun:test for unit tests
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies

## Integration Testing
- Test database operations with real database
- Use test fixtures for consistent data
- Clean up after tests

## E2E Testing
- Test complete user workflows
- Use headless browser for UI tests
- Verify API responses
`
    )
    
    await fs.writeFile(
      path.join(memoryDir, "typescript-tips.md"),
      `# TypeScript Tips

## Type Safety
- Use strict mode in tsconfig
- Avoid 'any' type, use 'unknown' instead
- Use discriminated unions for complex types

## Generics
- Use constraints to limit generic types
- Provide default types when appropriate
- Use conditional types for complex logic

## Error Handling
- Use Result type for expected errors
- Use try-catch for unexpected errors
- Always handle Promise rejections
`
    )
  })

  it("场景 1: 用户询问 API 设计规范", async () => {
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

    const dbPath = path.join(tmpDir, "test1.db")
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

    const testLayer = Memory.layer.pipe(
      Layer.provide(testDatabase),
      Layer.provide(testGlobal),
    )

    const program = Effect.gen(function* () {
      const memory = yield* Memory.Service
      
      // 索引 memory 文件
      yield* memory.reconcile()
      
      // 模拟用户查询
      const results = yield* memory.search({ 
        query: "How should I design REST API endpoints?", 
        limit: 3 
      })
      
      return results
    })

    const results = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    console.log("\n🔍 查询: 'How should I design REST API endpoints?'")
    console.log("📋 返回结果:")
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${path.basename(r.path)} (score: ${r.score.toFixed(4)})`)
      console.log(`     ${r.snippet.substring(0, 100)}...`)
    })

    // 验证：api-conventions.md 应该排在第一位
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].path).toContain("api-conventions")
  })

  it("场景 2: 用户询问测试策略", async () => {
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
      yield* memory.reconcile()
      
      const results = yield* memory.search({ 
        query: "What's the best way to write unit tests?", 
        limit: 3 
      })
      
      return results
    })

    const results = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    console.log("\n🔍 查询: 'What's the best way to write unit tests?'")
    console.log("📋 返回结果:")
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${path.basename(r.path)} (score: ${r.score.toFixed(4)})`)
      console.log(`     ${r.snippet.substring(0, 100)}...`)
    })

    // 验证：testing-strategies.md 应该排在第一位
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].path).toContain("testing-strategies")
  })

  it("场景 3: 用户询问 TypeScript 类型安全", async () => {
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

    const dbPath = path.join(tmpDir, "test3.db")
    const testDatabase = Database.layerFromPath(dbPath).pipe(
      Layer.provide(testGlobal),
    )

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
      yield* memory.reconcile()
      
      const results = yield* memory.search({ 
        query: "How to avoid using 'any' type in TypeScript?", 
        limit: 3 
      })
      
      return results
    })

    const results = await Effect.runPromise(
      program.pipe(Effect.provide(testLayer), Effect.orDie)
    )

    console.log("\n🔍 查询: 'How to avoid using any type in TypeScript?'")
    console.log("📋 返回结果:")
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${path.basename(r.path)} (score: ${r.score.toFixed(4)})`)
      console.log(`     ${r.snippet.substring(0, 100)}...`)
    })

    // 验证：typescript-tips.md 应该排在第一位
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].path).toContain("typescript-tips")
  })
})
