import { describe, it, expect } from "bun:test"

describe("Phase 3: Advanced Systems", () => {
  describe("Phase 3a: Distill Agent", () => {
    it("should export distill prompt", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/agent/prompt/distill.txt", "utf-8")
      expect(content).toContain("Distill agent")
    })
  })

  describe("Phase 3b: Judge System", () => {
    it("should export judge checks", async () => {
      const { JudgeCheck, DEFAULT_JUDGE_CONFIG } = await import("@/agent/judge")
      expect(JudgeCheck).toBeDefined()
      expect(DEFAULT_JUDGE_CONFIG.enabled).toBe(true)
      expect(DEFAULT_JUDGE_CONFIG.checks.length).toBe(8)
    })

    it("should check assertion reduction", async () => {
      const { checkAssertionReduction } = await import("@/agent/judge")
      const result = checkAssertionReduction(
        "expect(1).toBe(1)\nexpect(2).toBe(2)\nexpect(3).toBe(3)",
        "expect(1).toBe(1)"
      )
      expect(result).toContain("Assertion reduction")
    })

    it("should check security issues", async () => {
      const { checkSecurityIssues } = await import("@/agent/judge")
      const issues = checkSecurityIssues("const x = eval('1+1')")
      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0]).toContain("eval/exec")
    })

    it("should check regression risk", async () => {
      const { checkRegressionRisk } = await import("@/agent/judge")
      const issues = checkRegressionRisk("DROP TABLE users")
      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0]).toContain("destructive SQL")
    })
  })

  describe("Phase 3d: Cardinal System", () => {
    it("should export cardinal rules", async () => {
      const { DEFAULT_RULES, evaluateCardinal } = await import("@/session/cardinal")
      expect(DEFAULT_RULES.length).toBe(5)
      expect(typeof evaluateCardinal).toBe("function")
    })

    it("should block eval/exec", async () => {
      const { evaluateCardinal } = await import("@/session/cardinal")
      const decision = evaluateCardinal({
        taskId: "test",
        taskTitle: "test",
        diff: "const x = eval('1+1')",
      })
      expect(decision).not.toBeNull()
      expect(decision?.level).toBe("block")
    })

    it("should warn on token limit", async () => {
      const { evaluateCardinal } = await import("@/session/cardinal")
      const decision = evaluateCardinal({
        taskId: "test",
        taskTitle: "test",
        tokensUsed: 300000,
        totalBudget: 1000000,
      })
      expect(decision).not.toBeNull()
      expect(decision?.level).toBe("warn")
    })
  })

  describe("Phase 3e: AlignmentGuard", () => {
    it("should export detection functions", async () => {
      const { detectRabbitHole, detectDistraction, detectFileDrift } = await import("@/observability/alignment-guard")
      expect(typeof detectRabbitHole).toBe("function")
      expect(typeof detectDistraction).toBe("function")
      expect(typeof detectFileDrift).toBe("function")
    })

    it("should detect rabbit hole", async () => {
      const { detectRabbitHole } = await import("@/observability/alignment-guard")
      const commands = ["npm install", "npm install", "npm install", "npm install", "npm install", "npm install"]
      expect(detectRabbitHole(commands)).toBe(true)
    })

    it("should detect distraction", async () => {
      const { detectDistraction } = await import("@/observability/alignment-guard")
      expect(detectDistraction("curl https://example.com")).toBe(true)
      expect(detectDistraction("ls -la")).toBe(false)
    })

    it("should detect file drift", async () => {
      const { detectFileDrift } = await import("@/observability/alignment-guard")
      const files = new Set(["src/auth.ts", "src/blog.ts", "src/database.ts"])
      const drifts = detectFileDrift("Implement user login", files)
      expect(drifts).toContain("src/blog.ts")
      expect(drifts).toContain("src/database.ts")
    })
  })

  describe("Phase 3g: History System", () => {
    it("should export history schema", async () => {
      const schema = await import("@/history/schema")
      expect(schema).toBeDefined()
    })
  })

  describe("Phase 3h: Tool Supplements", () => {
    it("should export actor tool", async () => {
      const { ActorTool } = await import("@/tool/actor")
      expect(ActorTool.id).toBe("actor")
    })

    it("should export history tool", async () => {
      const { HistoryTool } = await import("@/tool/history")
      expect(HistoryTool.id).toBe("history")
    })

    it("should export multiedit tool", async () => {
      const { MultiEditTool } = await import("@/tool/multiedit")
      expect(MultiEditTool.id).toBe("multiedit")
    })

    it("should export screenshot tool", async () => {
      const { ScreenshotTool } = await import("@/tool/screenshot")
      expect(ScreenshotTool.id).toBe("screenshot")
    })

    it("should export workflow tool", async () => {
      const { WorkflowTool } = await import("@/tool/workflow")
      expect(WorkflowTool.id).toBe("workflow")
    })
  })
})
