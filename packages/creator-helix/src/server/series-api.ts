export * as SeriesApi from "./series-api"

import { Hono } from "hono"
import { Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { BackgroundJob } from "@opencode-ai/core/background-job"
import { SeriesRepository } from "../series/repository"
import { ProjectRepository } from "../project/repository"
import { StudioRepository } from "../studio/repository"
import { TraceRepository } from "../trace/repository"
import type { Series, Episode } from "../series/schema"

const seriesLayer = Layer.mergeAll(
  SeriesRepository.defaultLayer,
  ProjectRepository.defaultLayer,
  StudioRepository.defaultLayer,
  TraceRepository.defaultLayer,
  BackgroundJob.defaultLayer,
).pipe(Layer.provide(Database.defaultLayer))

export const seriesApp = new Hono().basePath("/api/creator-helix/v2")

// ─── Series CRUD ───

seriesApp
  .post("/series", async (c) => {
    const body = await c.req.json() as Partial<Series>
    const series: Series = {
      id: body.id ?? `series_${Date.now()}`,
      title: body.title ?? "Untitled Series",
      logline: body.logline ?? "",
      theme: body.theme,
      studioId: body.studioId ?? "",
      stylePresetId: body.stylePresetId,
      worldRules: body.worldRules ?? [],
      ordering: body.ordering ?? "sequential",
      episodes: body.episodes ?? [],
      created_at: Date.now(),
      updated_at: Date.now(),
    }
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.save(series)
      }).pipe(Effect.provide(seriesLayer)),
    )
    return c.json(series, 201)
  })
  .get("/series", async (c) => {
    const series = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.list()
      }).pipe(Effect.provide(seriesLayer)),
    )
    return c.json(series)
  })
  .get("/series/:id", async (c) => {
    const id = c.req.param("id")
    const series = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.get(id)
      }).pipe(Effect.provide(seriesLayer)),
    )
    if (!series) return c.json({ error: "Series not found" }, 404)
    return c.json(series)
  })
  .put("/series/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json() as Partial<Series>
    const existing = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        return yield* repo.get(id)
      }).pipe(Effect.provide(seriesLayer)),
    )
    if (!existing) return c.json({ error: "Series not found" }, 404)

    const updated: Series = { ...existing, ...body, id, updated_at: Date.now() }
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.save(updated)
      }).pipe(Effect.provide(seriesLayer)),
    )
    return c.json(updated)
  })
  .delete("/series/:id", async (c) => {
    const id = c.req.param("id")
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* SeriesRepository.Service
        yield* repo.delete(id)
      }).pipe(Effect.provide(seriesLayer)),
    )
    return c.json({ success: true })
  })

// ─── Episode Management ───

seriesApp.post("/series/:id/episodes", async (c) => {
  const id = c.req.param("id")
  const episode = await c.req.json() as Episode
  await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* SeriesRepository.Service
      yield* repo.addEpisode(id, episode)
    }).pipe(Effect.provide(seriesLayer)),
  )
  return c.json(episode, 201)
})

seriesApp.delete("/series/:id/episodes/:projectId", async (c) => {
  const id = c.req.param("id")
  const projectId = c.req.param("projectId")
  await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* SeriesRepository.Service
      yield* repo.removeEpisode(id, projectId)
    }).pipe(Effect.provide(seriesLayer)),
  )
  return c.json({ success: true })
})

seriesApp.put("/series/:id/episodes/:projectId/continuity", async (c) => {
  const id = c.req.param("id")
  const projectId = c.req.param("projectId")
  const state = await c.req.json()
  await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* SeriesRepository.Service
      yield* repo.updateContinuity(id, projectId, state)
    }).pipe(Effect.provide(seriesLayer)),
  )
  return c.json({ success: true })
})

// ─── Batch Create Series (一键创建剧集) ───

interface EpisodeInput {
  title: string
  synopsis?: string
  shots: Array<{
    description: string
    visualPrompt?: string
    duration?: number
    characters?: string[]
    locationId?: string
  }>
}

interface BatchCreateRequest {
  studioId: string
  stylePresetId?: string
  worldRules?: string[]
  episodes: EpisodeInput[]
}

seriesApp.post("/series/batch-create", async (c) => {
  const body = await c.req.json() as BatchCreateRequest

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const seriesRepo = yield* SeriesRepository.Service
      const projectRepo = yield* ProjectRepository.Service

      const seriesId = `series_${Date.now()}`
      const episodes: Array<{ projectId: string; meta: { episodeNumber: number; title: string; synopsis?: string } }> = []

      for (let i = 0; i < body.episodes.length; i++) {
        const ep = body.episodes[i]
        const projectId = `proj_${seriesId}_ep${i + 1}`

        yield* projectRepo.save({
          id: projectId,
          meta: {
            title: ep.title,
            logline: ep.synopsis ?? "",
            theme: "",
            targetDuration: ep.shots.reduce((sum, s) => sum + (s.duration ?? 5), 0),
          },
          stylePresetId: body.stylePresetId ?? "",
          worldRules: body.worldRules ?? [],
          scripts: [{
            id: `script_${projectId}`,
            title: ep.title,
            narrativeStructure: { acts: [] },
            timeline: { storyStart: "", narrativeOrder: [] },
            characterUsages: [],
            locationUsages: [],
            propUsages: [],
            sequences: [{
              id: `seq_${projectId}_01`,
              scriptActRef: "",
              narrativeBeat: { setup: "", conflict: "", climax: "", resolution: "" },
              emotionalArc: "",
              locationId: ep.shots[0]?.locationId ?? "",
              locationStateRef: "",
              timeOfDay: "",
              weather: "",
              charactersPresent: [],
              dialogue: [],
              shots: ep.shots.map((shot, j) => ({
                id: `shot_${projectId}_${j + 1}`,
                order: j,
                duration: shot.duration ?? 5,
                transitionIn: "cut",
                transitionOut: "cut",
                narrativePurpose: shot.description,
                camera: {
                  type: "static" as const,
                  framing: "medium" as const,
                  angle: "front" as const,
                  movementSpeed: "slow" as const,
                  lens: "standard" as const,
                },
                continuity: {
                  eyelineMatch: null,
                  shotReverseShot: null,
                  actionContinuation: null,
                  costumeState: "default",
                  propState: "default",
                  timeOfDayLock: false,
                  parallelMontage: [],
                },
                subjects: (shot.characters ?? []).map(charId => ({
                  characterId: charId,
                  characterState: "default",
                  expression: "neutral",
                  action: "",
                  position: "center",
                  depthLayer: "midground" as const,
                  outfitVariant: null,
                  crowdPresetId: null,
                })),
                environmentOverrides: {},
                audio: { dialogueRef: null, bgmId: null, sfx: [], ambientSound: null },
                references: {
                  characters: (shot.characters ?? []).map(charId => ({
                    characterId: charId,
                    stateRef: "default",
                    expressionRef: "neutral",
                    outfitVariant: null,
                  })),
                  location: {
                    locationId: shot.locationId ?? "",
                    stateRef: "default",
                    angleRef: null,
                  },
                  props: [],
                  stylePresetId: body.stylePresetId ?? "",
                },
                prompt: {
                  subjectDesc: shot.description,
                  visualDesc: shot.visualPrompt ?? "",
                  cameraDesc: "",
                  lightingDesc: "",
                  moodDesc: "",
                },
                output: { versions: [], selectedVersion: null, approvalStatus: "pending" as const },
              })),
            }],
          }],
        }, body.studioId)

        episodes.push({
          projectId,
          meta: {
            episodeNumber: i + 1,
            title: ep.title,
            synopsis: ep.synopsis,
          },
        })
      }

      const series: import("../series/schema").Series = {
        id: seriesId,
        title: "",
        logline: "",
        studioId: body.studioId,
        stylePresetId: body.stylePresetId,
        worldRules: body.worldRules,
        ordering: "sequential",
        episodes,
        created_at: Date.now(),
        updated_at: Date.now(),
      }
      yield* seriesRepo.save(series)

      return { seriesId, episodeCount: episodes.length, episodes }
    }).pipe(Effect.provide(seriesLayer)).pipe(
      Effect.catch((e) => Effect.succeed({ error: String(e) })),
    ),
  )

  if ("error" in result) return c.json(result, 500)
  return c.json(result, 201)
})

// ─── Series Generate (批量生成整部剧集) ───

seriesApp.post("/series/:id/generate", async (c) => {
  const id = c.req.param("id")

  const job = await Effect.runPromise(
    Effect.gen(function* () {
      const seriesRepo = yield* SeriesRepository.Service
      const series = yield* seriesRepo.get(id)
      if (!series) return yield* Effect.fail(new Error("Series not found"))

      const bgJob = yield* BackgroundJob.Service

      const projectRepo = yield* ProjectRepository.Service
      const studioRepo = yield* StudioRepository.Service
      const traceRepo = yield* TraceRepository.Service

      const runEffect = Effect.gen(function* () {
        const studio = yield* studioRepo.get(series.studioId)
        if (!studio) return JSON.stringify({ error: "Studio not found" })

        const pipelineMod = yield* Effect.promise(() => import("../v2/pipeline/full-pipeline"))

        for (const episode of series.episodes) {
          const project = yield* projectRepo.get(episode.projectId)
          if (!project) continue

          const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const totalShots = project.scripts.flatMap(s => s.sequences.flatMap(seq => seq.shots)).length

          yield* traceRepo.createRun({
            id: runId,
            projectId: episode.projectId,
            studioId: series.studioId,
            totalShots,
          })

          yield* pipelineMod.V2FullPipeline.runFullPipeline({
            project,
            studio,
            requirementStyle: series.stylePresetId ?? project.stylePresetId,
            runId,
          })
        }

        return JSON.stringify({ seriesId: id, episodeCount: series.episodes.length })
      }).pipe(Effect.catch((e) => Effect.succeed(JSON.stringify({ error: String(e) }))))

      const runEffectProvided = runEffect.pipe(
        Effect.provideService(ProjectRepository.Service, projectRepo),
        Effect.provideService(StudioRepository.Service, studioRepo),
        Effect.provideService(TraceRepository.Service, traceRepo),
      )

      return yield* bgJob.start({
        id: `series-generate-${id}`,
        type: "series-generation",
        title: `Generate series: ${series.title}`,
        run: runEffectProvided,
      })
    }).pipe(Effect.provide(seriesLayer)),
  )

  return c.json({ jobId: job.id, status: job.status }, 202)
})
