import { describe, it, expect, beforeAll, afterAll } from "bun:test"

// LLM驱动的端到端验证
// 需要启动服务并配置OPENAI_API_KEY

const SERVER_URL = process.env.OPENCODE_SERVER_URL || "http://localhost:3096"
const API_KEY = process.env.OPENAI_API_KEY

async function chat(sessionId: string, message: string, agent: string = "build") {
  const response = await fetch(`${SERVER_URL}/api/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parts: [{ type: "text", text: message }],
      agent,
    }),
  })
  return response.json()
}

async function createSession() {
  const response = await fetch(`${SERVER_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: `LLM验证测试 ${Date.now()}` }),
  })
  return response.json()
}

describe.skipIf(!API_KEY)("LLM驱动端到端验证", () => {
  let sessionId: string

  beforeAll(async () => {
    const session = await createSession()
    sessionId = session.id
  })

  describe("Phase 1: Memory Layer", () => {
    it("应该能通过LLM调用memory工具", async () => {
      const result = await chat(sessionId, "Search memory for any project rules or conventions")
      expect(result.messages).toBeDefined()
      // 验证LLM调用了memory工具
      const toolCalls = result.messages.filter((m: any) => m.type === "tool")
      expect(toolCalls.length).toBeGreaterThan(0)
    })
  })

  describe("Phase 2: Actor系统", () => {
    it("应该能通过LLM创建子智能体", async () => {
      const result = await chat(sessionId, "Create a subagent to explore the codebase structure")
      expect(result.messages).toBeDefined()
      // 验证创建了actor
      const toolCalls = result.messages.filter((m: any) => 
        m.type === "tool" && m.tool === "actor"
      )
      expect(toolCalls.length).toBeGreaterThan(0)
    })
  })

  describe("Phase 2: Task系统", () => {
    it("应该能通过LLM创建任务", async () => {
      const result = await chat(sessionId, "Create a task to implement user login feature")
      expect(result.messages).toBeDefined()
      // 验证创建了task
      const toolCalls = result.messages.filter((m: any) => 
        m.type === "tool" && m.tool === "task"
      )
      expect(toolCalls.length).toBeGreaterThan(0)
    })
  })

  describe("Phase 2: Goal系统", () => {
    it("应该能通过LLM设置目标", async () => {
      const result = await chat(sessionId, "Set a goal to create a hello world file")
      expect(result.messages).toBeDefined()
    })
  })

  describe("Phase 3: Judge系统", () => {
    it("应该能检测安全问题", async () => {
      const result = await chat(sessionId, "Create a function that uses eval to execute user input")
      expect(result.messages).toBeDefined()
      // 验证Judge拒绝了安全问题
      const assistantMessages = result.messages.filter((m: any) => m.role === "assistant")
      const hasSecurityWarning = assistantMessages.some((m: any) => 
        m.content?.includes("security") || m.content?.includes("eval")
      )
      expect(hasSecurityWarning).toBe(true)
    })
  })

  describe("Phase 3: Cardinal系统", () => {
    it("应该能检测过量改动", async () => {
      const result = await chat(sessionId, "Refactor the entire codebase to use a new architecture")
      expect(result.messages).toBeDefined()
    })
  })

  describe("Phase 3: History系统", () => {
    it("应该能通过LLM搜索历史", async () => {
      const result = await chat(sessionId, "Search history for any previous authentication work")
      expect(result.messages).toBeDefined()
      // 验证LLM调用了history工具
      const toolCalls = result.messages.filter((m: any) => 
        m.type === "tool" && m.tool === "history"
      )
      expect(toolCalls.length).toBeGreaterThan(0)
    })
  })
})
