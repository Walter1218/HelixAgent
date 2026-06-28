import { describe, it, expect } from "bun:test"
import { parsePath, parseCcPath, buildPath, resolveProjectId } from "@opencode-ai/core/memory/paths"

describe("parsePath", () => {
  it("should parse global memory path", () => {
    const result = parsePath("/home/user/.local/share/opencode/memory/global/MEMORY.md")
    expect(result).toEqual({
      scope: "global",
      scope_id: "",
      type: "memory",
      key: "MEMORY",
    })
  })

  it("should parse project memory path", () => {
    const result = parsePath("/home/user/.local/share/opencode/memory/projects/abc123/MEMORY.md")
    expect(result).toEqual({
      scope: "projects",
      scope_id: "abc123",
      type: "memory",
      key: "MEMORY",
    })
  })

  it("should parse session memory path", () => {
    const result = parsePath("/home/user/.local/share/opencode/memory/sessions/session123/checkpoint.md")
    expect(result).toEqual({
      scope: "sessions",
      scope_id: "session123",
      type: "checkpoint",
      key: "checkpoint",
    })
  })

  it("should parse checkpoint path", () => {
    const result = parsePath("/home/user/.local/share/opencode/memory/sessions/session123/checkpoint.md")
    expect(result?.type).toBe("checkpoint")
  })

  it("should parse progress path", () => {
    const result = parsePath("/home/user/.local/share/opencode/memory/sessions/session123/tasks/T1/progress.md")
    expect(result?.type).toBe("progress")
  })

  it("should parse notes path", () => {
    const result = parsePath("/home/user/.local/share/opencode/memory/sessions/session123/tasks/T1/notes.md")
    expect(result?.type).toBe("notes")
  })

  it("should return null for non-memory path", () => {
    const result = parsePath("/home/user/some/other/path.md")
    expect(result).toBeNull()
  })

  it("should return null for non-md file", () => {
    const result = parsePath("/home/user/.local/share/opencode/memory/global/test.txt")
    expect(result).toBeNull()
  })
})

describe("parseCcPath", () => {
  it("should parse Claude Code memory path", () => {
    const result = parseCcPath("/home/user/.claude/projects/my-project/memory/rules.md")
    expect(result).toEqual({
      scope: "cc",
      scope_id: "my-project",
      type: "free",
      key: "rules",
    })
  })

  it("should return null for non-CC path", () => {
    const result = parseCcPath("/home/user/some/other/path.md")
    expect(result).toBeNull()
  })
})

describe("buildPath", () => {
  it("should build global path", () => {
    const result = buildPath({
      root: "/data/memory",
      scope: "global",
      key: "MEMORY",
    })
    expect(result).toBe("/data/memory/global/MEMORY.md")
  })

  it("should build project path", () => {
    const result = buildPath({
      root: "/data/memory",
      scope: "projects",
      scope_id: "abc123",
      key: "MEMORY",
    })
    expect(result).toBe("/data/memory/projects/abc123/MEMORY.md")
  })

  it("should reject path traversal", () => {
    expect(() =>
      buildPath({
        root: "/data/memory",
        scope: "global",
        key: "../etc/passwd",
      })
    ).toThrow("invalid path component")
  })

  it("should reject absolute path", () => {
    expect(() =>
      buildPath({
        root: "/data/memory",
        scope: "global",
        key: "/etc/passwd",
      })
    ).toThrow("invalid path component")
  })
})

describe("resolveProjectId", () => {
  it("should generate consistent hash", () => {
    const id1 = resolveProjectId("/home/user/project")
    const id2 = resolveProjectId("/home/user/project")
    expect(id1).toBe(id2)
  })

  it("should generate 12-char hex string", () => {
    const id = resolveProjectId("/home/user/project")
    expect(id).toHaveLength(12)
    expect(id).toMatch(/^[0-9a-f]+$/)
  })

  it("should generate different hashes for different paths", () => {
    const id1 = resolveProjectId("/home/user/project1")
    const id2 = resolveProjectId("/home/user/project2")
    expect(id1).not.toBe(id2)
  })
})
