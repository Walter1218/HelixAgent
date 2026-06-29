import { describe, it, expect } from "bun:test"

// 模块集成验证 - 不需要启动服务
// 验证各模块能正确导入和基本调用

describe("Phase 1-3 模块集成验证", () => {
  describe("Phase 1: Memory模块集成", () => {
    it("MemoryService能正确实例化", async () => {
      const { MemoryService } = await import("@opencode-ai/core/memory/service")
      const service = new MemoryService("/tmp/test-memory")
      expect(service).toBeDefined()
      expect(typeof service.search).toBe("function")
      expect(typeof service.reconcile).toBe("function")
    })

    it("Embedder能正确实例化", async () => {
      const { Embedder } = await import("@opencode-ai/core/memory/embedder")
      const embedder = new Embedder({
        enabled: true,
        baseUrl: "http://localhost:1234/v1/embeddings",
        model: "test-model",
      })
      expect(embedder).toBeDefined()
      expect(embedder.enabled).toBe(true)
    })

    it("VecStore能正确实例化", async () => {
      const { Embedder } = await import("@opencode-ai/core/memory/embedder")
      const { VecStore } = await import("@opencode-ai/core/memory/vec-store")
      const embedder = new Embedder({ enabled: false, baseUrl: "", model: "" })
      const store = new VecStore(embedder)
      expect(store).toBeDefined()
      expect(store.isEmbeddingEnabled).toBe(false)
    })

    it("buildFtsQuery能正确构建查询", async () => {
      const { buildFtsQuery } = await import("@opencode-ai/core/memory/fts-query")
      expect(buildFtsQuery("hello world")).toBe('"hello" OR "world"')
      expect(buildFtsQuery("")).toBeNull()
    })

    it("路径解析能正确工作", async () => {
      const { parsePath, buildPath, resolveProjectId } = await import("@opencode-ai/core/memory/paths")
      
      const loc = parsePath("/home/user/.local/share/opencode/memory/global/MEMORY.md")
      expect(loc).not.toBeNull()
      expect(loc?.scope).toBe("global")
      expect(loc?.type).toBe("memory")
      
      const path = buildPath({ root: "/data", scope: "global", key: "test" })
      expect(path).toBe("/data/global/test.md")
      
      const id = resolveProjectId("/home/user/project")
      expect(id).toHaveLength(12)
    })
  })

  describe("Phase 2: Actor模块集成", () => {
    it("Actor schema类型正确导出", async () => {
      const { Actor, ActorStatus, ActorOutcome, Lifecycle, ContextMode, SpawnMode } = await import("@/actor/schema")
      expect(Actor).toBeDefined()
      expect(ActorStatus).toBeDefined()
      expect(ActorOutcome).toBeDefined()
      expect(Lifecycle).toBeDefined()
      expect(ContextMode).toBeDefined()
      expect(SpawnMode).toBeDefined()
    })

    it("Actor事件正确导出", async () => {
      const { ActorRegistered, ActorStatusChanged, ActorStuck } = await import("@/actor/events")
      expect(ActorRegistered.type).toBe("actor.registered")
      expect(ActorStatusChanged.type).toBe("actor.status")
      expect(ActorStuck.type).toBe("actor.stuck")
    })

    it("ActorRegistry能正确实例化", async () => {
      const { Service: ActorRegistry } = await import("@/actor/registry")
      expect(ActorRegistry).toBeDefined()
    })

    it("ActorWaiter能正确实例化", async () => {
      const { Service: ActorWaiter } = await import("@/actor/waiter")
      expect(ActorWaiter).toBeDefined()
    })

    it("parseReturnHeader能正确解析", async () => {
      const { parseReturnHeader } = await import("@/actor/return-header")
      
      const result = parseReturnHeader("**Status**: success\n**Summary**: Done")
      expect(result.status).toBe("success")
      expect(result.summary).toBe("Done")
      
      const empty = parseReturnHeader(undefined)
      expect(empty.status).toBeUndefined()
    })
  })

  describe("Phase 2: Task模块集成", () => {
    it("Task schema类型正确导出", async () => {
      const { Task, TaskStatus, TaskPriority, TaskComplexity } = await import("@/task/schema")
      expect(Task).toBeDefined()
      expect(TaskStatus).toBeDefined()
      expect(TaskPriority).toBeDefined()
      expect(TaskComplexity).toBeDefined()
    })

    it("Task事件正确导出", async () => {
      const { TaskCreated, TaskStatusChanged, TaskCompleted } = await import("@/task/events")
      expect(TaskCreated.type).toBe("task.created")
      expect(TaskStatusChanged.type).toBe("task.status")
      expect(TaskCompleted.type).toBe("task.completed")
    })

    it("TaskRegistry能正确实例化", async () => {
      const { Service: TaskRegistry } = await import("@/task/registry")
      expect(TaskRegistry).toBeDefined()
    })
  })

  describe("Phase 2: Goal模块集成", () => {
    it("Goal类型正确导出", async () => {
      const { Verdict, Event } = await import("@/session/goal")
      expect(Verdict).toBeDefined()
      expect(Event.Updated.type).toBe("session.goal")
    })

    it("GoalService能正确实例化", async () => {
      const { Service: GoalService } = await import("@/session/goal")
      expect(GoalService).toBeDefined()
    })
  })

  describe("Phase 2: Mode模块集成", () => {
    it("ModeRegistry能正确实例化", async () => {
      const { Service: ModeRegistry } = await import("@/session/mode-registry")
      expect(ModeRegistry).toBeDefined()
    })

    it("ModeId类型正确导出", async () => {
      const { ModeId } = await import("@/session/mode-registry")
      expect(ModeId).toBeDefined()
    })
  })

  describe("Phase 2: Shell安全模块集成", () => {
    it("tokenize能正确解析命令", async () => {
      const { tokenize } = await import("@/tool/shell-tokenize")
      const result = tokenize("echo hello")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.result.length).toBeGreaterThan(0)
        expect(result.result[0].tokens).toContain("echo")
      }
    })
  })

  describe("Phase 3: Judge模块集成", () => {
    it("Judge检查函数正确工作", async () => {
      const { checkAssertionReduction, checkSecurityIssues, checkRegressionRisk } = await import("@/agent/judge")
      
      // 断言减少检测
      const assertionResult = checkAssertionReduction(
        "expect(1).toBe(1)\nexpect(2).toBe(2)",
        "expect(1).toBe(1)"
      )
      expect(assertionResult).toContain("Assertion reduction")
      
      // 安全问题检测
      const securityResult = checkSecurityIssues("const x = eval('1+1')")
      expect(securityResult.length).toBeGreaterThan(0)
      
      // 回归风险检测
      const regressionResult = checkRegressionRisk("DROP TABLE users")
      expect(regressionResult.length).toBeGreaterThan(0)
    })
  })

  describe("Phase 3: Cardinal模块集成", () => {
    it("evaluateCardinal能正确评估", async () => {
      const { evaluateCardinal } = await import("@/session/cardinal")
      
      // 安全风险
      const securityDecision = evaluateCardinal({
        taskId: "test",
        taskTitle: "test",
        diff: "const x = eval('1+1')",
      })
      expect(securityDecision?.level).toBe("block")
      
      // Token超限
      const tokenDecision = evaluateCardinal({
        taskId: "test",
        taskTitle: "test",
        tokensUsed: 300000,
        totalBudget: 1000000,
      })
      expect(tokenDecision?.level).toBe("warn")
    })
  })

  describe("Phase 3: AlignmentGuard模块集成", () => {
    it("检测函数正确工作", async () => {
      const { detectRabbitHole, detectDistraction, detectFileDrift } = await import("@/observability/alignment-guard")
      
      // 兔子洞检测
      expect(detectRabbitHole(["npm install", "npm install", "npm install", "npm install", "npm install", "npm install"])).toBe(true)
      
      // 分心检测
      expect(detectDistraction("curl https://example.com")).toBe(true)
      expect(detectDistraction("ls -la")).toBe(false)
      
      // 文件漂移检测
      const drifts = detectFileDrift("Implement login", new Set(["src/auth.ts", "src/blog.ts"]))
      expect(drifts).toContain("src/blog.ts")
    })
  })

  describe("Phase 3: 工具模块集成", () => {
    it("所有工具定义正确导出", async () => {
      const { ActorTool } = await import("@/tool/actor")
      const { HistoryTool } = await import("@/tool/history")
      const { MultiEditTool } = await import("@/tool/multiedit")
      const { ScreenshotTool } = await import("@/tool/screenshot")
      const { WorkflowTool } = await import("@/tool/workflow")
      
      expect(ActorTool.id).toBe("actor")
      expect(HistoryTool.id).toBe("history")
      expect(MultiEditTool.id).toBe("multiedit")
      expect(ScreenshotTool.id).toBe("screenshot")
      expect(WorkflowTool.id).toBe("workflow")
    })
  })
})
