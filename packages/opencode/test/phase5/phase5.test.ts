import { describe, it, expect } from "bun:test"

describe("Phase 5: Advanced Features", () => {
  describe("Phase 5: Auto-Dev Scheduler", () => {
    it("should export scheduler types", async () => {
      const { selectTasks, formatBudget } = await import("@/scheduler/scheduler")
      expect(typeof selectTasks).toBe("function")
      expect(typeof formatBudget).toBe("function")
    })

    it("should select tasks by priority", async () => {
      const { selectTasks } = await import("@/scheduler/scheduler")
      const tasks = [
        { id: "1", title: "Low", description: "", priority: "low" as const, status: "pending" as const, estimatedTokens: 100, createdAt: Date.now(), updatedAt: Date.now() },
        { id: "2", title: "High", description: "", priority: "high" as const, status: "pending" as const, estimatedTokens: 100, createdAt: Date.now(), updatedAt: Date.now() },
        { id: "3", title: "Medium", description: "", priority: "medium" as const, status: "pending" as const, estimatedTokens: 100, createdAt: Date.now(), updatedAt: Date.now() },
      ]
      const result = selectTasks(tasks, { dailyBudget: 1000, maxRetries: 3, strategy: "priority_first" })
      expect(result.selected[0].id).toBe("2") // High first
      expect(result.selected[1].id).toBe("3") // Medium second
      expect(result.selected[2].id).toBe("1") // Low last
    })

    it("should defer tasks over budget", async () => {
      const { selectTasks } = await import("@/scheduler/scheduler")
      const tasks = [
        { id: "1", title: "Big", description: "", priority: "high" as const, status: "pending" as const, estimatedTokens: 1000, createdAt: Date.now(), updatedAt: Date.now() },
        { id: "2", title: "Small", description: "", priority: "high" as const, status: "pending" as const, estimatedTokens: 100, createdAt: Date.now(), updatedAt: Date.now() },
      ]
      const result = selectTasks(tasks, { dailyBudget: 500, maxRetries: 3, strategy: "priority_first" })
      expect(result.selected.length).toBe(1)
      expect(result.deferred.length).toBe(1)
    })

    it("should format budget correctly", async () => {
      const { formatBudget } = await import("@/scheduler/scheduler")
      expect(formatBudget(500)).toBe("500")
      expect(formatBudget(1500)).toBe("1.5K")
      expect(formatBudget(1500000)).toBe("1.5M")
    })
  })

  describe("Phase 5b: Team系统", () => {
    it("should export team types", async () => {
      const { createTeamId, addMember, removeMember, getMember, getMembersByRole, formatTeam } = await import("@/team/team")
      expect(typeof createTeamId).toBe("function")
      expect(typeof addMember).toBe("function")
      expect(typeof removeMember).toBe("function")
      expect(typeof getMember).toBe("function")
      expect(typeof getMembersByRole).toBe("function")
      expect(typeof formatTeam).toBe("function")
    })

    it("should create team id", async () => {
      const { createTeamId } = await import("@/team/team")
      const id = createTeamId()
      expect(id).toMatch(/^team_/)
    })

    it("should add member", async () => {
      const { addMember } = await import("@/team/team")
      const team = { id: "team1", name: "Test", members: [], createdAt: Date.now() }
      const member = { sessionID: "ses1", agent: "build", role: "developer", joinedAt: Date.now() }
      const updated = addMember(team, member)
      expect(updated.members.length).toBe(1)
      expect(updated.members[0].sessionID).toBe("ses1")
    })

    it("should not add duplicate member", async () => {
      const { addMember } = await import("@/team/team")
      const member = { sessionID: "ses1", agent: "build", role: "developer", joinedAt: Date.now() }
      const team = { id: "team1", name: "Test", members: [member], createdAt: Date.now() }
      const updated = addMember(team, member)
      expect(updated.members.length).toBe(1)
    })

    it("should remove member", async () => {
      const { removeMember } = await import("@/team/team")
      const member = { sessionID: "ses1", agent: "build", role: "developer", joinedAt: Date.now() }
      const team = { id: "team1", name: "Test", members: [member], createdAt: Date.now() }
      const updated = removeMember(team, "ses1")
      expect(updated.members.length).toBe(0)
    })

    it("should get member by session id", async () => {
      const { getMember } = await import("@/team/team")
      const member = { sessionID: "ses1", agent: "build", role: "developer", joinedAt: Date.now() }
      const team = { id: "team1", name: "Test", members: [member], createdAt: Date.now() }
      expect(getMember(team, "ses1")).toBeDefined()
      expect(getMember(team, "ses2")).toBeUndefined()
    })

    it("should get members by role", async () => {
      const { getMembersByRole } = await import("@/team/team")
      const members = [
        { sessionID: "ses1", agent: "build", role: "developer", joinedAt: Date.now() },
        { sessionID: "ses2", agent: "ask", role: "reviewer", joinedAt: Date.now() },
      ]
      const team = { id: "team1", name: "Test", members, createdAt: Date.now() }
      expect(getMembersByRole(team, "developer").length).toBe(1)
      expect(getMembersByRole(team, "reviewer").length).toBe(1)
    })

    it("should format team", async () => {
      const { formatTeam } = await import("@/team/team")
      const team = {
        id: "team1",
        name: "Test Team",
        members: [
          { sessionID: "ses1", agent: "build", role: "developer", joinedAt: Date.now() },
        ],
        createdAt: Date.now(),
      }
      const formatted = formatTeam(team)
      expect(formatted).toContain("Test Team")
      expect(formatted).toContain("developer")
    })
  })

  describe("Phase 5c: AST Graph", () => {
    it("should export ast types", async () => {
      const { calculateBlastRadius, extractContract, formatBlastRadius } = await import("@/ast/ast")
      expect(typeof calculateBlastRadius).toBe("function")
      expect(typeof extractContract).toBe("function")
      expect(typeof formatBlastRadius).toBe("function")
    })

    it("should calculate blast radius", async () => {
      const { calculateBlastRadius } = await import("@/ast/ast")
      const dependencies = new Map([
        ["a.ts", ["b.ts", "c.ts"]],
        ["b.ts", ["d.ts"]],
        ["c.ts", []],
        ["d.ts", []],
      ])
      const radius = calculateBlastRadius("a.ts", dependencies)
      expect(radius.file).toBe("a.ts")
      expect(radius.dependents.length).toBeGreaterThan(0)
    })

    it("should extract contract", async () => {
      const { extractContract } = await import("@/ast/ast")
      const content = `
        export class UserService {
          getUser() {}
        }
        export function createUser() {}
      `
      const contract = extractContract(content)
      expect(contract.classes.length).toBe(1)
      expect(contract.functions.length).toBe(1)
    })

    it("should format blast radius", async () => {
      const { formatBlastRadius } = await import("@/ast/ast")
      const radius = { file: "a.ts", dependents: ["b.ts", "c.ts"], depth: 2 }
      const formatted = formatBlastRadius(radius)
      expect(formatted).toContain("a.ts")
      expect(formatted).toContain("2")
    })
  })

  describe("Phase 5d: 插件补充", () => {
    it("should have plugin module", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/plugin/index.ts", "utf-8")
      expect(content).toBeDefined()
      expect(content.length).toBeGreaterThan(0)
    })

    it("should export plugin types", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/opencode/src/plugin/index.ts", "utf-8")
      expect(content).toContain("Plugin")
    })
  })

  describe("Phase 5e: 配置补充", () => {
    it("should export skills config", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/core/src/config/skills.ts", "utf-8")
      expect(content).toContain("SkillsConfig")
      expect(content).toContain("DEFAULT_SKILLS_CONFIG")
    })

    it("should export history config", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/core/src/config/history.ts", "utf-8")
      expect(content).toContain("HistoryConfig")
      expect(content).toContain("DEFAULT_HISTORY_CONFIG")
    })

    it("should have skills config structure", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/core/src/config/skills.ts", "utf-8")
      expect(content).toContain("paths")
      expect(content).toContain("urls")
    })

    it("should have history config structure", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("/Users/onetwo/Documents/trae_projects/HelixAgent/packages/core/src/config/history.ts", "utf-8")
      expect(content).toContain("kinds")
      expect(content).toContain("enabled")
    })
  })
})
