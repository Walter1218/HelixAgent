import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { Trace } from "@/trace/trace"

// In-memory mock Trace layer for unit tests
function createMockTraceLayer() {
  const events: any[] = []
  return {
    layer: Layer.succeed(Trace.Service, Trace.Service.of({
      emit: (event: any) => Effect.sync(() => { events.push({ ...event, timestamp: Date.now() }) }),
      getTraces: (sessionID: string) => Effect.sync(() => events.filter(e => e.metadata?.sessionID === sessionID)),
      getTracesByTimeRange: () => Effect.sync(() => events),
    })),
    events,
  }
}

describe("Trace persistence", () => {
  it("emit and getTraces roundtrip", async () => {
    const mock = createMockTraceLayer()
    const program = Effect.gen(function* () {
      const trace = yield* Trace.Service

      yield* trace.emit({
        id: "test-1",
        type: "action",
        name: "tool.bash",
        status: "pending",
        metadata: { sessionID: "sess-1", toolName: "bash" },
      })

      yield* trace.emit({
        id: "test-1",
        type: "action",
        name: "tool.bash",
        status: "success",
        duration: 150,
        metadata: { sessionID: "sess-1" },
      })

      const traces = yield* trace.getTraces("sess-1")
      expect(traces).toHaveLength(2)
      expect(traces[0].id).toBe("test-1")
      expect(traces[0].status).toBe("pending")
      expect(traces[1].status).toBe("success")
      expect(traces[1].duration).toBe(150)
    })

    await Effect.runPromise(program.pipe(Effect.provide(mock.layer)))
  })

  it("emit includes timestamp", async () => {
    const mock = createMockTraceLayer()
    const before = Date.now()
    const program = Effect.gen(function* () {
      const trace = yield* Trace.Service
      yield* trace.emit({
        id: "test-ts",
        type: "node_start",
        name: "session.prompt",
        status: "pending",
        metadata: { sessionID: "sess-ts" },
      })
      const traces = yield* trace.getTraces("sess-ts")
      expect(traces[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(traces[0].timestamp).toBeLessThanOrEqual(Date.now())
    })
    await Effect.runPromise(program.pipe(Effect.provide(mock.layer)))
  })

  it("getTraces filters by sessionID", async () => {
    const mock = createMockTraceLayer()
    const program = Effect.gen(function* () {
      const trace = yield* Trace.Service
      yield* trace.emit({ id: "a-1", type: "action", name: "a", status: "success", metadata: { sessionID: "a" } })
      yield* trace.emit({ id: "b-1", type: "action", name: "b", status: "success", metadata: { sessionID: "b" } })
      const tracesA = yield* trace.getTraces("a")
      const tracesB = yield* trace.getTraces("b")
      expect(tracesA).toHaveLength(1)
      expect(tracesA[0].id).toBe("a-1")
      expect(tracesB).toHaveLength(1)
      expect(tracesB[0].id).toBe("b-1")
    })
    await Effect.runPromise(program.pipe(Effect.provide(mock.layer)))
  })
})
