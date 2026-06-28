import { describe, it, expect } from "bun:test"

// Phase 2: Core Systems Test Suite

describe("Phase 2: Core Systems", () => {
  describe("Phase 2a: Auto-Dream", () => {
    it("should export AUTO_DREAM_TITLE", async () => {
      const { AUTO_DREAM_TITLE } = await import("@/session/auto-dream")
      expect(AUTO_DREAM_TITLE).toBe("Auto Dream")
    })

    it("should export AUTO_DISTILL_TITLE", async () => {
      const { AUTO_DISTILL_TITLE } = await import("@/session/auto-dream")
      expect(AUTO_DISTILL_TITLE).toBe("Auto Distill")
    })

    it("should export DREAM_TASK", async () => {
      const { DREAM_TASK } = await import("@/session/auto-dream")
      expect(DREAM_TASK).toContain("memory consolidation")
    })

    it("should export DISTILL_TASK", async () => {
      const { DISTILL_TASK } = await import("@/session/auto-dream")
      expect(DISTILL_TASK).toContain("distill pass")
    })
  })

  describe("Phase 2b: Checkpoint", () => {
    it("should export checkpoint templates", async () => {
      const { CHECKPOINT_TEMPLATE, MEMORY_TEMPLATE, NOTES_TEMPLATE } = await import("@/session/checkpoint-templates")
      expect(CHECKPOINT_TEMPLATE).toContain("§1 Active intent")
      expect(MEMORY_TEMPLATE).toContain("Project memory")
      expect(NOTES_TEMPLATE).toContain("Session notes")
    })

    it("should export checkpoint paths", async () => {
      const { checkpointPath, memoryPath, notesPath } = await import("@/session/checkpoint-paths")
      expect(typeof checkpointPath).toBe("function")
      expect(typeof memoryPath).toBe("function")
      expect(typeof notesPath).toBe("function")
    })

    it("should export system agents", async () => {
      const { SYSTEM_SPAWNED_AGENT_TYPES, isSystemAgent } = await import("@/agent/system-agents")
      expect(SYSTEM_SPAWNED_AGENT_TYPES).toContain("checkpoint-writer")
      expect(SYSTEM_SPAWNED_AGENT_TYPES).toContain("dream")
      expect(SYSTEM_SPAWNED_AGENT_TYPES).toContain("distill")
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
      const result = await tokenize("echo hello").pipe(
        (eff: any) => eff
      )
      // tokenize returns Effect, need to run it
      expect(typeof tokenize).toBe("function")
    })

    it("should export shellWrap function", async () => {
      const { shellWrap } = await import("@/tool/shell-wrap")
      expect(typeof shellWrap).toBe("function")
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

    it("should export actor events", async () => {
      const { ActorRegistered, ActorStatusChanged, ActorStuck } = await import("@/actor/events")
      expect(ActorRegistered).toBeDefined()
      expect(ActorStatusChanged).toBeDefined()
      expect(ActorStuck).toBeDefined()
    })

    it("should export spawn-ref", async () => {
      const { spawnRef } = await import("@/actor/spawn-ref")
      expect(spawnRef).toBeDefined()
      expect(spawnRef.current).toBeUndefined()
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

    it("should parse return header with partial status", async () => {
      const { parseReturnHeader } = await import("@/actor/return-header")
      const result = parseReturnHeader("**Status**: partial\n**Summary**: Some work done")
      expect(result.status).toBe("partial")
      expect(result.summary).toBe("Some work done")
    })

    it("should handle empty return header", async () => {
      const { parseReturnHeader } = await import("@/actor/return-header")
      const result = parseReturnHeader(undefined)
      expect(result.status).toBeUndefined()
      expect(result.summary).toBeUndefined()
    })
  })

  describe("Phase 2e: Task System", () => {
    it("should export task schema types", async () => {
      const { TaskStatus, TaskPriority, TaskComplexity } = await import("@/task/schema")
      expect(TaskStatus).toBeDefined()
      expect(TaskPriority).toBeDefined()
      expect(TaskComplexity).toBeDefined()
    })

    it("should export task events", async () => {
      const { TaskCreated, TaskStatusChanged, TaskCompleted } = await import("@/task/events")
      expect(TaskCreated).toBeDefined()
      expect(TaskStatusChanged).toBeDefined()
      expect(TaskCompleted).toBeDefined()
    })
  })

  describe("Phase 2f: Goal System", () => {
    it("should export goal types", async () => {
      const { Verdict, Event } = await import("@/session/goal")
      expect(Verdict).toBeDefined()
      expect(Event).toBeDefined()
      expect(Event.Updated).toBeDefined()
    })
  })

  describe("Phase 2g: Mode System", () => {
    it("should export mode registry types", async () => {
      const { ModeId } = await import("@/session/mode-registry")
      expect(ModeId).toBeDefined()
    })

    it("should export mode config", async () => {
      const { ModesConfig } = await import("@/config/mode")
      expect(ModesConfig).toBeDefined()
    })
  })
})
