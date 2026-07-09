import { beforeAll, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import { Database } from "@opencode-ai/core/database/database"
import { Migration } from "../../persistence/migrate"
import { SeriesRepository } from "../../series/repository"
import type { Series, Episode } from "../../series/schema"

beforeAll(async () => {
  const { runPromise } = makeRuntime(Database.Service, Database.defaultLayer)
  await runPromise(() => Migration.run)
})

describe("SeriesRepository", () => {
  const runSeries = <A>(effect: Effect.Effect<A, Error, SeriesRepository.Service>) =>
    Effect.runPromise(effect.pipe(Effect.provide(SeriesRepository.defaultLayer)))

  const makeId = () => `series_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  test("creates and retrieves a series", async () => {
    const id = makeId()
    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.save({
          id,
          title: "三体",
          logline: "人类与三体文明的首次接触",
          theme: "科幻/史诗",
          studioId: "studio_001",
          ordering: "sequential",
          episodes: [],
          created_at: Date.now(),
          updated_at: Date.now(),
        })
      }),
    )

    const series = await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.get(id)
      }),
    )
    expect(series).toBeDefined()
    expect(series!.title).toBe("三体")
    expect(series!.ordering).toBe("sequential")
  })

  test("adds and removes episodes", async () => {
    const id = makeId()
    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.save({
          id,
          title: "Test Series",
          logline: "test",
          studioId: "studio_001",
          ordering: "sequential",
          episodes: [],
          created_at: Date.now(),
          updated_at: Date.now(),
        })
      }),
    )

    const episode: Episode = {
      projectId: "proj_ep1",
      meta: { episodeNumber: 1, title: "第一集" },
    }

    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.addEpisode(id, episode)
      }),
    )

    let series = await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.get(id)
      }),
    )
    expect(series!.episodes.length).toBe(1)
    expect(series!.episodes[0].meta.title).toBe("第一集")

    // Remove
    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.removeEpisode(id, "proj_ep1")
      }),
    )

    series = await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.get(id)
      }),
    )
    expect(series!.episodes.length).toBe(0)
  })

  test("updates continuity state", async () => {
    const id = makeId()
    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.save({
          id,
          title: "Test Series",
          logline: "test",
          studioId: "studio_001",
          ordering: "sequential",
          episodes: [{
            projectId: "proj_ep1",
            meta: { episodeNumber: 1, title: "第一集" },
          }],
          created_at: Date.now(),
          updated_at: Date.now(),
        })
      }),
    )

    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.updateContinuity(id, "proj_ep1", {
          characterStates: [{
            characterId: "char_001",
            stateRef: "wounded",
            distinguishingMarks: ["左臂绷带"],
            notes: "第1集结尾受伤",
          }],
          relationshipStates: [],
        })
      }),
    )

    const series = await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.get(id)
      }),
    )
    const ep = series!.episodes.find(e => e.projectId === "proj_ep1")
    expect(ep!.meta.continuityState).toBeDefined()
    expect(ep!.meta.continuityState!.characterStates[0].stateRef).toBe("wounded")
  })

  test("lists series by studio", async () => {
    const id = makeId()
    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.save({
          id,
          title: "Studio Test",
          logline: "test",
          studioId: "studio_series_test",
          ordering: "sequential",
          episodes: [],
          created_at: Date.now(),
          updated_at: Date.now(),
        })
      }),
    )

    const series = await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.getByStudio("studio_series_test")
      }),
    )
    expect(series.length).toBeGreaterThanOrEqual(1)
  })

  test("deletes a series", async () => {
    const id = makeId()
    await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.save({
          id,
          title: "To Delete",
          logline: "test",
          studioId: "studio_001",
          ordering: "sequential",
          episodes: [],
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        yield* repo.delete(id)
      }),
    )

    const series = await runSeries(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.get(id)
      }),
    )
    expect(series).toBeUndefined()
  })
})
