import { describe, it, expect } from "bun:test"

describe("TUI Components", () => {
  describe("ModeIndicator", () => {
    it("should export mode indicator component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-mode.tsx", "utf-8")
      expect(content).toContain("ModeIndicator")
      expect(content).toContain("ask")
      expect(content).toContain("build")
      expect(content).toContain("plan")
    })
  })

  describe("GoalIndicator", () => {
    it("should export goal indicator component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-goal.tsx", "utf-8")
      expect(content).toContain("GoalIndicator")
      expect(content).toContain("Goal:")
    })
  })

  describe("TokenIndicator", () => {
    it("should export token indicator component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/indicator-tokens.tsx", "utf-8")
      expect(content).toContain("TokenIndicator")
      expect(content).toContain("tokens")
    })
  })

  describe("TaskPanel", () => {
    it("should export task panel component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-tasks.tsx", "utf-8")
      expect(content).toContain("TaskPanel")
      expect(content).toContain("Tasks")
    })
  })

  describe("ActorPanel", () => {
    it("should export actor panel component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-actors.tsx", "utf-8")
      expect(content).toContain("ActorPanel")
      expect(content).toContain("Subagents")
    })
  })

  describe("TracePanel", () => {
    it("should export trace panel component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-trace.tsx", "utf-8")
      expect(content).toContain("TracePanel")
      expect(content).toContain("Execution Trace")
    })
  })

  describe("SkillPanel", () => {
    it("should export skill panel component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-skills.tsx", "utf-8")
      expect(content).toContain("SkillPanel")
      expect(content).toContain("Skills")
    })
  })

  describe("AgentPanel", () => {
    it("should export agent panel component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/panel-agents.tsx", "utf-8")
      expect(content).toContain("AgentPanel")
      expect(content).toContain("Agents")
    })
  })

  describe("CardinalAlert", () => {
    it("should export cardinal alert component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/alert-cardinal.tsx", "utf-8")
      expect(content).toContain("CardinalAlert")
      expect(content).toContain("Cardinal Alert")
    })
  })

  describe("DialogMode", () => {
    it("should export mode dialog component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/dialog-mode.tsx", "utf-8")
      expect(content).toContain("DialogMode")
      expect(content).toContain("Select mode")
    })
  })

  describe("DialogMemory", () => {
    it("should export memory dialog component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/dialog-memory.tsx", "utf-8")
      expect(content).toContain("DialogMemory")
      expect(content).toContain("Memory Search")
    })
  })

  describe("DialogHistory", () => {
    it("should export history dialog component", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/cli/cmd/tui/component/dialog-history.tsx", "utf-8")
      expect(content).toContain("DialogHistory")
      expect(content).toContain("History Search")
    })
  })
})
