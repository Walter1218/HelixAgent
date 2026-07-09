import { beforeAll, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import { Database } from "@opencode-ai/core/database/database"
import { Migration } from "../../persistence/migrate"
import { TraceRepository } from "../../trace/repository"

beforeAll(async () => {
  const { runPromise } = makeRuntime(Database.Service, Database.defaultLayer)
  await runPromise(() => Migration.run)
})

describe("TraceRepository", () => {
  const runTrace = <A, E>(effect: Effect.Effect<A, E, TraceRepository.Service>) =>
    Effect.runPromise(effect.pipe(Effect.provide(TraceRepository.defaultLayer)))

  const makeId = () => `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  test("creates a pipeline run", async () => {
    const id = makeId()
    const run = await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        return yield* repo.createRun({
          id,
          projectId: "proj_001",
          studioId: "studio_001",
          totalShots: 3,
        })
      }),
    )
    expect(run.id).toBe(id)
    expect(run.status).toBe("running")
    expect(run.totalShots).toBe(3)
  })

  test("records events and tracks progress", async () => {
    const id = makeId()
    await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        yield* repo.createRun({ id, projectId: "proj_002", studioId: "studio_001", totalShots: 2 })
        yield* repo.recordEvent({
          runId: id,
          eventType: "pipeline_started",
          status: "started",
        })
        yield* repo.recordEvent({
          runId: id,
          shotId: "shot_001",
          eventType: "video_succeeded",
          status: "succeeded",
          durationMs: 12000,
          data: { videoUrl: "https://example.com/v.mp4" },
        })
        yield* repo.recordEvent({
          runId: id,
          shotId: "shot_002",
          eventType: "video_failed",
          status: "failed",
          error: "timeout",
        })
      }),
    )

    const run = await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        return yield* repo.getRun(id)
      }),
    )
    expect(run).toBeDefined()
    expect(run!.completedShots).toBe(1)
    expect(run!.failedShots).toBe(1)
  })

  test("gets run events in order", async () => {
    const id = makeId()
    await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        yield* repo.createRun({ id, projectId: "proj_003", studioId: "studio_001", totalShots: 1 })
        yield* repo.recordEvent({ runId: id, eventType: "pipeline_started", status: "started" })
        yield* repo.recordEvent({ runId: id, eventType: "global_style_decided", status: "succeeded", durationMs: 2000 })
        yield* repo.recordEvent({ runId: id, eventType: "shots_decided", status: "succeeded", durationMs: 3000 })
      }),
    )
    const events = await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        return yield* repo.getRunEvents(id)
      }),
    )
    expect(events.length).toBe(3)
    expect(events[0].eventType).toBe("pipeline_started")
    expect(events[1].eventType).toBe("global_style_decided")
    expect(events[2].eventType).toBe("shots_decided")
  })

  test("completes a run", async () => {
    await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        yield* repo.completeRun("run_test_001", "partial", "1 shot failed")
      }),
    )

    const run = await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        return yield* repo.getRun("run_test_001")
      }),
    )
    expect(run!.status).toBe("partial")
    expect(run!.error).toBe("1 shot failed")
    expect(run!.completedAt).toBeDefined()
  })

  test("lists runs by project", async () => {
    const id = makeId()
    await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        yield* repo.createRun({ id, projectId: "proj_list_test", studioId: "studio_001", totalShots: 1 })
      }),
    )
    const runs = await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        return yield* repo.listRunsByProject("proj_list_test")
      }),
    )
    expect(runs.length).toBeGreaterThanOrEqual(1)
    expect(runs[0].id).toBe(id)
  })

  test("lists recent runs", async () => {
    const runs = await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        return yield* repo.listRuns(10)
      }),
    )
    expect(runs.length).toBeGreaterThanOrEqual(1)
  })

  test("returns undefined for unknown run", async () => {
    const run = await runTrace(
      Effect.gen(function* () {
        const repo = yield* TraceRepository.Service
        return yield* repo.getRun("nonexistent")
      }),
    )
    expect(run).toBeUndefined()
  })
})
