import { describe, it, expect } from "bun:test"

describe("TUI组件系统性验证", () => {
  describe("Phase 1: Memory相关组件", () => {
    it("MemoryDialog应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/dialog-memory.tsx", "utf-8")
      expect(content).toContain("DialogMemory")
      expect(content).toContain("Memory Search")
    })
  })

  describe("Phase 2: 核心系统组件", () => {
    it("ModeIndicator应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-mode.tsx", "utf-8")
      expect(content).toContain("ModeIndicator")
      expect(content).toContain("ask")
      expect(content).toContain("build")
      expect(content).toContain("plan")
      expect(content).toContain("compose")
      expect(content).toContain("max")
      expect(content).toContain("loop")
    })

    it("DialogMode应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/dialog-mode.tsx", "utf-8")
      expect(content).toContain("DialogMode")
      expect(content).toContain("Select Mode")
    })

    it("TaskPanel应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-tasks.tsx", "utf-8")
      expect(content).toContain("TaskPanel")
      expect(content).toContain("Tasks")
    })

    it("ActorPanel应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-actors.tsx", "utf-8")
      expect(content).toContain("ActorPanel")
      expect(content).toContain("Subagents")
    })
  })

  describe("Phase 3: 高级系统组件", () => {
    it("GoalIndicator应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-goal.tsx", "utf-8")
      expect(content).toContain("GoalIndicator")
      expect(content).toContain("Goal:")
    })

    it("CardinalAlert应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/alert-cardinal.tsx", "utf-8")
      expect(content).toContain("CardinalAlert")
      expect(content).toContain("Cardinal Alert")
    })

    it("AlignmentAlert应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/alert-alignment.tsx", "utf-8")
      expect(content).toContain("AlignmentAlert")
      expect(content).toContain("Alignment Alert")
    })

    it("HistoryDialog应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/dialog-history.tsx", "utf-8")
      expect(content).toContain("DialogHistory")
      expect(content).toContain("History Search")
    })
  })

  describe("Phase 4: 自动化系统组件", () => {
    it("TokenIndicator应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-tokens.tsx", "utf-8")
      expect(content).toContain("TokenIndicator")
      expect(content).toContain("tokens")
    })

    it("TracePanel应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-trace.tsx", "utf-8")
      expect(content).toContain("TracePanel")
      expect(content).toContain("Execution Trace")
    })
  })

  describe("Phase 5: 高级功能组件", () => {
    it("SkillPanel应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-skills.tsx", "utf-8")
      expect(content).toContain("SkillPanel")
      expect(content).toContain("Skills")
    })

    it("AgentPanel应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-agents.tsx", "utf-8")
      expect(content).toContain("AgentPanel")
      expect(content).toContain("Agents")
    })
  })

  describe("集成组件", () => {
    it("FooterWithIndicators应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/footer-indicators.tsx", "utf-8")
      expect(content).toContain("FooterWithIndicators")
      expect(content).toContain("mode")
      expect(content).toContain("goal")
      expect(content).toContain("tokens")
    })

    it("SidebarWithPanels应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/sidebar-panels.tsx", "utf-8")
      expect(content).toContain("SidebarWithPanels")
      expect(content).toContain("Tasks")
      expect(content).toContain("Subagents")
      expect(content).toContain("Skills")
      expect(content).toContain("Agents")
    })
  })

  describe("功能完整性验证", () => {
    it("所有Mode都应该被支持", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-mode.tsx", "utf-8")
      const modes = ["ask", "build", "plan", "compose", "max", "loop"]
      for (const mode of modes) {
        expect(content).toContain(mode)
      }
    })

    it("所有任务状态都应该被支持", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-tasks.tsx", "utf-8")
      const statuses = ["done", "in_progress", "blocked"]
      for (const status of statuses) {
        expect(content).toContain(status)
      }
    })

    it("所有Cardinal级别都应该被支持", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/alert-cardinal.tsx", "utf-8")
      const levels = ["block", "pause", "stop", "warn"]
      for (const level of levels) {
        expect(content).toContain(level)
      }
    })

    it("所有Alignment类型都应该被支持", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/alert-alignment.tsx", "utf-8")
      const types = ["file_drift", "rabbit_hole", "distraction"]
      for (const type of types) {
        expect(content).toContain(type)
      }
    })
  })

  describe("集成组件验证", () => {
    it("Footer集成组件应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/footer-integrated.tsx", "utf-8")
      expect(content).toContain("Footer")
      expect(content).toContain("Mode")
      expect(content).toContain("Goal")
      expect(content).toContain("tokens")
    })

    it("Sidebar集成组件应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/sidebar-integrated.tsx", "utf-8")
      expect(content).toContain("Sidebar")
      expect(content).toContain("Tasks")
      expect(content).toContain("Subagents")
      expect(content).toContain("Skills")
      expect(content).toContain("Agents")
    })

    it("SessionLayout应该存在", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/session-layout.tsx", "utf-8")
      expect(content).toContain("SessionLayout")
      expect(content).toContain("Header")
      expect(content).toContain("Sidebar")
      expect(content).toContain("Chat Area")
    })
  })
})
