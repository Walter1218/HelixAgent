import { describe, it, expect } from "bun:test"

describe("Phase 4: Advanced Systems", () => {
  describe("Phase 4: Evolution Flywheel", () => {
    it("should export evolution types", async () => {
      const { matchPairs, filterDirtyTraces, exportToJsonl } = await import("@/evolution/evolution")
      expect(typeof matchPairs).toBe("function")
      expect(typeof filterDirtyTraces).toBe("function")
      expect(typeof exportToJsonl).toBe("function")
    })

    it("should match pairs correctly", async () => {
      const { matchPairs } = await import("@/evolution/evolution")
      const traces = [
        { id: "1", type: "action" as const, name: "bash", status: "success" as const, timestamp: Date.now() },
        { id: "2", type: "action" as const, name: "bash", status: "failed" as const, timestamp: Date.now() },
      ]
      const pairs = matchPairs(traces)
      expect(pairs.length).toBe(1)
      expect(pairs[0].chosen[0].status).toBe("success")
      expect(pairs[0].rejected[0].status).toBe("failed")
    })

    it("should filter dirty traces", async () => {
      const { filterDirtyTraces } = await import("@/evolution/evolution")
      const traces = [
        { id: "1", type: "action" as const, name: "bash", status: "success" as const, timestamp: Date.now() },
        { id: "2", type: "error" as const, name: "bash", status: "failed" as const, metadata: { error: "timeout" }, timestamp: Date.now() },
        { id: "3", type: "error" as const, name: "bash", status: "failed" as const, metadata: { error: "logic error" }, timestamp: Date.now() },
      ]
      const filtered = filterDirtyTraces(traces)
      expect(filtered.length).toBe(2)
      expect(filtered.some(t => t.metadata?.error === "timeout")).toBe(false)
    })

    it("should export to jsonl", async () => {
      const { exportToJsonl } = await import("@/evolution/evolution")
      const pairs = [
        {
          chosen: [{ id: "1", type: "action" as const, name: "bash", status: "success" as const, timestamp: Date.now() }],
          rejected: [{ id: "2", type: "action" as const, name: "bash", status: "failed" as const, timestamp: Date.now() }],
          reason: "test",
        },
      ]
      const jsonl = exportToJsonl(pairs)
      expect(jsonl.split("\n").length).toBe(1)
      expect(JSON.parse(jsonl)).toBeDefined()
    })
  })

  describe("Phase 4b: Token Tracker", () => {
    it("should export token types", async () => {
      const { calculateCost, formatTokens } = await import("@/token/tracker")
      expect(typeof calculateCost).toBe("function")
      expect(typeof formatTokens).toBe("function")
    })

    it("should calculate cost correctly", async () => {
      const { calculateCost } = await import("@/token/tracker")
      expect(calculateCost(1000, "mimo-v2.5-pro")).toBe(0.01)
      expect(calculateCost(1000, "unknown")).toBe(0.01)
    })

    it("should format tokens correctly", async () => {
      const { formatTokens } = await import("@/token/tracker")
      expect(formatTokens(500)).toBe("500")
      expect(formatTokens(1500)).toBe("1.5K")
      expect(formatTokens(1500000)).toBe("1.5M")
    })
  })

  describe("Phase 4c: Metrics系统", () => {
    it("should export metrics types", async () => {
      const { calculateTTFT, calculateLatency, formatLatency } = await import("@/metrics/metrics")
      expect(typeof calculateTTFT).toBe("function")
      expect(typeof calculateLatency).toBe("function")
      expect(typeof formatLatency).toBe("function")
    })

    it("should calculate TTFT correctly", async () => {
      const { calculateTTFT } = await import("@/metrics/metrics")
      expect(calculateTTFT(1000, 1500)).toBe(500)
    })

    it("should calculate latency correctly", async () => {
      const { calculateLatency } = await import("@/metrics/metrics")
      expect(calculateLatency(1000, 3000)).toBe(2000)
    })

    it("should format latency correctly", async () => {
      const { formatLatency } = await import("@/metrics/metrics")
      expect(formatLatency(500)).toBe("500ms")
      expect(formatLatency(1500)).toBe("1.50s")
    })
  })

  describe("Phase 4d: Workflow引擎", () => {
    it("should export workflow types", async () => {
      const { createRunId, isTerminalStatus, formatDuration } = await import("@/workflow/workflow")
      expect(typeof createRunId).toBe("function")
      expect(typeof isTerminalStatus).toBe("function")
      expect(typeof formatDuration).toBe("function")
    })

    it("should create run id", async () => {
      const { createRunId } = await import("@/workflow/workflow")
      const id = createRunId()
      expect(id).toMatch(/^wf_/)
    })

    it("should check terminal status", async () => {
      const { isTerminalStatus } = await import("@/workflow/workflow")
      expect(isTerminalStatus("completed")).toBe(true)
      expect(isTerminalStatus("failed")).toBe(true)
      expect(isTerminalStatus("cancelled")).toBe(true)
      expect(isTerminalStatus("running")).toBe(false)
    })

    it("should format duration correctly", async () => {
      const { formatDuration } = await import("@/workflow/workflow")
      expect(formatDuration(500)).toBe("500ms")
      expect(formatDuration(5000)).toBe("5.0s")
      expect(formatDuration(65000)).toBe("1m 5s")
      expect(formatDuration(3665000)).toBe("1h 1m")
    })
  })

  describe("Phase 4e: Trace机制", () => {
    it("should export trace types", async () => {
      const { createTraceId, formatTraceTree, filterByStatus, filterByType, getDuration } = await import("@/trace/trace")
      expect(typeof createTraceId).toBe("function")
      expect(typeof formatTraceTree).toBe("function")
      expect(typeof filterByStatus).toBe("function")
      expect(typeof filterByType).toBe("function")
      expect(typeof getDuration).toBe("function")
    })

    it("should create trace id", async () => {
      const { createTraceId } = await import("@/trace/trace")
      const id = createTraceId()
      expect(id).toMatch(/^tr_/)
    })

    it("should format trace tree", async () => {
      const { formatTraceTree } = await import("@/trace/trace")
      const events = [
        { id: "1", type: "node_start" as const, name: "session", status: "success" as const, timestamp: 1000 },
        { id: "2", parentId: "1", type: "action" as const, name: "bash", status: "success" as const, duration: 500, timestamp: 1100 },
        { id: "3", parentId: "1", type: "action" as const, name: "read", status: "success" as const, duration: 100, timestamp: 1200 },
      ]
      const tree = formatTraceTree(events)
      expect(tree).toContain("✓ session")
      expect(tree).toContain("✓ bash")
      expect(tree).toContain("✓ read")
    })

    it("should filter by status", async () => {
      const { filterByStatus } = await import("@/trace/trace")
      const events = [
        { id: "1", type: "action" as const, name: "bash", status: "success" as const, timestamp: 1000 },
        { id: "2", type: "action" as const, name: "read", status: "failed" as const, timestamp: 1100 },
      ]
      const successes = filterByStatus(events, "success")
      expect(successes.length).toBe(1)
      expect(successes[0].id).toBe("1")
    })

    it("should filter by type", async () => {
      const { filterByType } = await import("@/trace/trace")
      const events = [
        { id: "1", type: "node_start" as const, name: "session", status: "success" as const, timestamp: 1000 },
        { id: "2", type: "action" as const, name: "bash", status: "success" as const, timestamp: 1100 },
      ]
      const actions = filterByType(events, "action")
      expect(actions.length).toBe(1)
      expect(actions[0].id).toBe("2")
    })

    it("should get duration", async () => {
      const { getDuration } = await import("@/trace/trace")
      const events = [
        { id: "1", type: "action" as const, name: "bash", status: "success" as const, duration: 500, timestamp: 1000 },
        { id: "2", type: "action" as const, name: "read", status: "success" as const, duration: 100, timestamp: 1200 },
      ]
      const duration = getDuration(events)
      // max(1000+500, 1200+100) - min(1000, 1200) = 1500 - 1000 = 500
      expect(duration).toBe(500)
    })
  })
})
