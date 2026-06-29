import { describe, it, expect } from "bun:test"

describe("Phase 3c: Shadow Worktree", () => {
  describe("Worktree核心功能", () => {
    it("should export worktree types", async () => {
      const { createWorktree, removeWorktree, resetWorktree, commitChanges, cleanWorktree, listWorktrees, isWorktreeLocked, generateSlug } = await import("@/shadow-worktree/worktree")
      expect(typeof createWorktree).toBe("function")
      expect(typeof removeWorktree).toBe("function")
      expect(typeof resetWorktree).toBe("function")
      expect(typeof commitChanges).toBe("function")
      expect(typeof cleanWorktree).toBe("function")
      expect(typeof listWorktrees).toBe("function")
      expect(typeof isWorktreeLocked).toBe("function")
      expect(typeof generateSlug).toBe("function")
    })

    it("should generate slug", async () => {
      const { generateSlug } = await import("@/shadow-worktree/worktree")
      const slug = generateSlug()
      expect(slug).toMatch(/^[a-z]+-[a-z]+-[a-z0-9]+$/)
    })

    it("should list worktrees", async () => {
      const { listWorktrees } = await import("@/shadow-worktree/worktree")
      const worktrees = await listWorktrees("/Users/onetwo/Documents/trae_projects/HelixAgent")
      expect(Array.isArray(worktrees)).toBe(true)
    })
  })

  describe("Worktree GC功能", () => {
    it("should export gc types", async () => {
      const { garbageCollect } = await import("@/shadow-worktree/gc")
      expect(typeof garbageCollect).toBe("function")
    })
  })
})
