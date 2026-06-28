import { describe, it, expect } from "bun:test"
import { buildFtsQuery } from "@opencode-ai/core/memory/fts-query"

describe("buildFtsQuery", () => {
  it("should return null for empty query", () => {
    expect(buildFtsQuery("")).toBeNull()
    expect(buildFtsQuery("   ")).toBeNull()
  })

  it("should return null for query with no valid tokens", () => {
    expect(buildFtsQuery("!@#$%^&*()")).toBeNull()
  })

  it("should build OR-joined query for single token", () => {
    expect(buildFtsQuery("hello")).toBe('"hello"')
  })

  it("should build OR-joined query for multiple tokens", () => {
    expect(buildFtsQuery("hello world")).toBe('"hello" OR "world"')
  })

  it("should handle special FTS5 characters", () => {
    expect(buildFtsQuery("hello:world")).toBe('"hello" OR "world"')
    expect(buildFtsQuery("hello*world")).toBe('"hello" OR "world"')
    expect(buildFtsQuery("hello(world)")).toBe('"hello" OR "world"')
  })

  it("should handle quotes in tokens", () => {
    // Quotes are stripped, then token is split into two
    expect(buildFtsQuery('hello"world')).toBe('"hello" OR "world"')
  })

  it("should handle CJK characters", () => {
    expect(buildFtsQuery("你好世界")).toBe('"你好世界"')
    expect(buildFtsQuery("hello 世界")).toBe('"hello" OR "世界"')
  })

  it("should handle underscores", () => {
    expect(buildFtsQuery("my_function")).toBe('"my_function"')
  })

  it("should handle numbers", () => {
    expect(buildFtsQuery("test123")).toBe('"test123"')
    expect(buildFtsQuery("123 456")).toBe('"123" OR "456"')
  })
})
