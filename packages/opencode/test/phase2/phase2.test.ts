import { describe, it, expect } from "bun:test"

describe("Phase 2: Core Systems", () => {
  describe("Phase 2a: Auto-Dream", () => {
    it("should export AUTO_DREAM_TITLE", async () => {
      const { AUTO_DREAM_TITLE } = await import("@/session/auto-dream")
      expect(AUTO_DREAM_TITLE).toBe("Auto Dream")
    })

    it("should export DREAM_TASK", async () => {
      const { DREAM_TASK } = await import("@/session/auto-dream")
      expect(DREAM_TASK).toContain("memory consolidation")
    })
  })

  describe("Phase 2b: Checkpoint", () => {
    it("should export checkpoint templates", async () => {
      const { CHECKPOINT_TEMPLATE, MEMORY_TEMPLATE } = await import("@/session/checkpoint-templates")
      expect(CHECKPOINT_TEMPLATE).toContain("§1 Active intent")
      expect(MEMORY_TEMPLATE).toContain("Project memory")
    })

    it("should export checkpoint paths", async () => {
      const { checkpointPath, memoryPath } = await import("@/session/checkpoint-paths")
      expect(typeof checkpointPath).toBe("function")
      expect(typeof memoryPath).toBe("function")
    })

    it("should export system agents", async () => {
      const { SYSTEM_SPAWNED_AGENT_TYPES, isSystemAgent } = await import("@/agent/system-agents")
      expect(SYSTEM_SPAWNED_AGENT_TYPES).toContain("dream")
      expect(isSystemAgent("dream")).toBe(true)
      expect(isSystemAgent("build")).toBe(false)
    })
  })

  describe("Phase 2c: Shell Safety", () => {
    it("should export tokenize function", async () => {
      const { tokenize } = await import("@/tool/shell-tokenize")
      expect(typeof tokenize).toBe("function")
    })

    it("should parse simple command", async () => {
      const { tokenize } = await import("@/tool/shell-tokenize")
      const result = tokenize("echo hello")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.result.length).toBeGreaterThan(0)
      }
    })
  })

  describe("Phase 2d: Actor System", () => {
    it("should export actor schema types", async () => {
      const { ActorStatus, ActorOutcome, Lifecycle, ContextMode, SpawnMode } = await import("@/actor/schema")
      expect(ActorStatus).toBeDefined()
      expect(ActorOutcome).toBeDefined()
      expect(Lifecycle).toBeDefined()
      expect(ContextMode).toBeDefined()
      expect(SpawnMode).toBeDefined()
    })

    it("should export return header parser", async () => {
      const { parseReturnHeader } = await import("@/actor/return-header")
      expect(typeof parseReturnHeader).toBe("function")
    })

    it("should parse return header correctly", async () => {
      const { parseReturnHeader } = await import("@/actor/return-header")
      const result = parseReturnHeader("**Status**: success\n**Summary**: Task completed")
      expect(result.status).toBe("success")
      expect(result.summary).toBe("Task completed")
    })
  })

  describe("Phase 2e: Task System", () => {
    it("should export task schema types", async () => {
      const { TaskStatus, TaskPriority, TaskComplexity } = await import("@/task/schema")
      expect(TaskStatus).toBeDefined()
      expect(TaskPriority).toBeDefined()
      expect(TaskComplexity).toBeDefined()
    })
  })

  describe("Phase 2f: Goal System", () => {
    it("should export goal types", async () => {
      const { Verdict, Event } = await import("@/session/goal")
      expect(Verdict).toBeDefined()
      expect(Event).toBeDefined()
    })
  })

  describe("Phase 2g: Mode System", () => {
    it("should export mode registry types", async () => {
      const { ModeId } = await import("@/session/mode-registry")
      expect(ModeId).toBeDefined()
    })
  })
})
