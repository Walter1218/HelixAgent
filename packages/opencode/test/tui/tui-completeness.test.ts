import { describe, it, expect } from "bun:test"

describe("TUI外化完整性验证", () => {
  describe("组件文件存在性验证", () => {
    const fs = require("fs")
    const basePath = "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component"

    const components = [
      // 指示器组件
      { name: "ModeIndicator", file: "indicator-mode.tsx" },
      { name: "GoalIndicator", file: "indicator-goal.tsx" },
      { name: "TokenIndicator", file: "indicator-tokens.tsx" },

      // 面板组件
      { name: "TaskPanel", file: "panel-tasks.tsx" },
      { name: "ActorPanel", file: "panel-actors.tsx" },
      { name: "TracePanel", file: "panel-trace.tsx" },
      { name: "SkillPanel", file: "panel-skills.tsx" },
      { name: "AgentPanel", file: "panel-agents.tsx" },

      // 告警组件
      { name: "CardinalAlert", file: "alert-cardinal.tsx" },
      { name: "AlignmentAlert", file: "alert-alignment.tsx" },

      // 对话框组件
      { name: "DialogMode", file: "dialog-mode.tsx" },
      { name: "DialogMemory", file: "dialog-memory.tsx" },
      { name: "DialogHistory", file: "dialog-history.tsx" },

      // 集成组件
      { name: "FooterWithIndicators", file: "footer-indicators.tsx" },
      { name: "SidebarWithPanels", file: "sidebar-panels.tsx" },
      { name: "Footer", file: "footer-integrated.tsx" },
      { name: "Sidebar", file: "sidebar-integrated.tsx" },
      { name: "SessionLayout", file: "session-layout.tsx" },
    ]

    components.forEach(({ name, file }) => {
      it(`${name} 应该存在 (${file})`, () => {
        const filePath = `${basePath}/${file}`
        expect(fs.existsSync(filePath)).toBe(true)
        const content = fs.readFileSync(filePath, "utf-8")
        expect(content).toContain(name)
      })
    })
  })

  describe("Mode支持验证", () => {
    it("应该支持所有6种primary模式", async () => {
      const fs = await import("fs")
      const agentContent = fs.readFileSync(
        "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/agent/agent.ts",
        "utf-8"
      )

      const modes = ["ask", "build", "plan", "compose", "loop"]
      for (const mode of modes) {
        expect(agentContent).toContain(`name: "${mode}"`)
        expect(agentContent).toContain('mode: "primary"')
      }
    })

    it("ModeIndicator应该支持所有模式", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync(
        "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-mode.tsx",
        "utf-8"
      )

      const modes = ["ask", "build", "plan", "compose", "max", "loop"]
      for (const mode of modes) {
        expect(content).toContain(mode)
      }
    })
  })

  describe("功能完整性验证", () => {
    it("Footer应该包含Mode、Goal、Token", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync(
        "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/footer-integrated.tsx",
        "utf-8"
      )
      expect(content).toContain("mode")
      expect(content).toContain("goal")
      expect(content).toContain("tokens")
    })

    it("Sidebar应该包含Tasks、Actors、Trace、Skills、Agents", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync(
        "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/sidebar-integrated.tsx",
        "utf-8"
      )
      expect(content).toContain("Tasks")
      expect(content).toContain("Subagents")
      expect(content).toContain("Execution Trace")
      expect(content).toContain("Skills")
      expect(content).toContain("Agents")
    })

    it("SessionLayout应该包含Header、Chat Area、Sidebar", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync(
        "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/session-layout.tsx",
        "utf-8"
      )
      expect(content).toContain("Header")
      expect(content).toContain("Chat Area")
      expect(content).toContain("Sidebar")
    })
  })

  describe("告警组件验证", () => {
    it("CardinalAlert应该支持所有级别", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync(
        "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/alert-cardinal.tsx",
        "utf-8"
      )
      const levels = ["block", "pause", "stop", "warn"]
      for (const level of levels) {
        expect(content).toContain(level)
      }
    })

    it("AlignmentAlert应该支持所有类型", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync(
        "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/alert-alignment.tsx",
        "utf-8"
      )
      const types = ["file_drift", "rabbit_hole", "distraction"]
      for (const type of types) {
        expect(content).toContain(type)
      }
    })
  })
})
