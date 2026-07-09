export * as ProjectApi from "./project-api"

import { Hono } from "hono"
import { Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { BackgroundJob } from "@opencode-ai/core/background-job"
import { ProjectRepository } from "../project/repository"
import { StudioRepository } from "../studio/repository"
import { AssetTaskRepository } from "../generation/repository"
import { TraceRepository } from "../trace/repository"

import type { Project } from "../project/schema/project"
import type { AssetTask } from "../generation/asset-task"

const projectLayer = Layer.mergeAll(
  ProjectRepository.defaultLayer,
  StudioRepository.defaultLayer,
  AssetTaskRepository.defaultLayer,
  BackgroundJob.defaultLayer,
  TraceRepository.defaultLayer,
).pipe(Layer.provide(Database.defaultLayer))

export const projectApp = new Hono().basePath("/api/creator-helix/v2")

// ─── Project CRUD ───

projectApp
  .post("/projects", async (c) => {
    const body = await c.req.json() as Partial<Project> & { studioId?: string }
    const project: Project = {
      id: body.id ?? `proj_${Date.now()}`,
      meta: {
        title: body.meta?.title ?? "Untitled",
        logline: body.meta?.logline ?? "",
        theme: body.meta?.theme ?? "",
        targetDuration: body.meta?.targetDuration ?? 0,
      },
      stylePresetId: body.stylePresetId ?? "",
      worldRules: body.worldRules ?? [],
      scripts: body.scripts ?? [],
    }
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ProjectRepository.Service
        yield* repo.save(project, body.studioId)
      }).pipe(Effect.provide(projectLayer)),
    )
    return c.json(project, 201)
  })
  .get("/projects/:id", async (c) => {
    const id = c.req.param("id")
    const project = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ProjectRepository.Service
        return yield* repo.get(id)
      }).pipe(Effect.provide(projectLayer)),
    )
    if (!project) return c.json({ error: "Project not found" }, 404)
    return c.json(project)
  })
  .put("/projects/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json() as Partial<Project>
    const updated = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ProjectRepository.Service
        const existing = yield* repo.get(id)
        if (!existing) return yield* Effect.fail(new Error("Project not found"))
        const updated: Project = {
          ...existing,
          ...body,
          id,
          meta: { ...existing.meta, ...body.meta },
        }
        yield* repo.save(updated)
        return updated
      }).pipe(Effect.provide(projectLayer)),
    )
    return c.json(updated)
  })
  .delete("/projects/:id", async (c) => {
    const id = c.req.param("id")
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ProjectRepository.Service
        yield* repo.delete(id)
      }).pipe(Effect.provide(projectLayer)),
    )
    return c.json({ success: true })
  })

// ─── Generate ───

projectApp.post("/projects/:id/generate", async (c) => {
  const id = c.req.param("id")
  const studioId = c.req.query("studio_id") ?? ""

  const job = await Effect.runPromise(
    Effect.gen(function* () {
      const projectRepo = yield* ProjectRepository.Service
      const studioRepo = yield* StudioRepository.Service
      const traceRepo = yield* TraceRepository.Service
      const bgJob = yield* BackgroundJob.Service

      const project = yield* projectRepo.get(id)
      if (!project) return yield* Effect.fail(new Error("Project not found"))

      const studio = yield* studioRepo.get(studioId)
      if (!studio) return yield* Effect.fail(new Error("Studio not found"))

      const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const totalShots = project.scripts.flatMap(s => s.sequences.flatMap(seq => seq.shots)).length

      yield* traceRepo.createRun({
        id: runId,
        projectId: id,
        studioId,
        totalShots,
      })

      const runEffect = Effect.gen(function* () {
        const mod = yield* Effect.promise(() => import("../v2/pipeline/full-pipeline"))
        const result = yield* mod.V2FullPipeline.runFullPipeline({
          project,
          studio,
          requirementStyle: project.stylePresetId,
          runId,
        })
        return JSON.stringify(result)
        }).pipe(Effect.catch((e) => Effect.gen(function* () {
          yield* traceRepo.completeRun(runId, "failed", String(e))
          return JSON.stringify({ error: String(e) })
        })))

      const runEffectProvided = runEffect.pipe(
        Effect.provideService(TraceRepository.Service, traceRepo),
      )

      return yield* bgJob.start({
        id: `generate-${id}`,
        type: "knowledge-project-generation",
        title: `Generate ${project.meta.title}`,
        metadata: { runId },
        run: runEffectProvided,
      })
    }).pipe(Effect.provide(projectLayer)),
  )

  return c.json({ jobId: job.id, status: job.status }, 202)
})

// ─── Tasks ───

projectApp.get("/projects/:id/tasks", async (c) => {
  const id = c.req.param("id")
  const tasks = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* AssetTaskRepository.Service
      return yield* repo.listByProject(id)
    }).pipe(Effect.provide(projectLayer)),
  )
  return c.json(tasks)
})

projectApp.get("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId")
  const task = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* AssetTaskRepository.Service
      return yield* repo.get(taskId)
    }).pipe(Effect.provide(projectLayer)),
  )
  if (!task) return c.json({ error: "Task not found" }, 404)
  return c.json(task)
})

projectApp.get("/tasks", async (c) => {
  const status = c.req.query("status") as AssetTask["status"] | undefined
  if (!status) return c.json([])
  const tasks = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* AssetTaskRepository.Service
      return yield* repo.listByStatus(status)
    }).pipe(Effect.provide(projectLayer)),
  )
  return c.json(tasks)
})

// ─── Pipeline Trace ───

projectApp.get("/projects/:id/runs", async (c) => {
  const id = c.req.param("id")
  const runs = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* TraceRepository.Service
      return yield* repo.listRunsByProject(id)
    }).pipe(Effect.provide(projectLayer)),
  )
  return c.json(runs)
})

projectApp.get("/runs/:runId", async (c) => {
  const runId = c.req.param("runId")
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* TraceRepository.Service
      const run = yield* repo.getRun(runId)
      if (!run) return yield* Effect.fail(new Error("Run not found"))
      const events = yield* repo.getRunEvents(runId)
      return { ...run, events }
    }).pipe(Effect.provide(projectLayer)).pipe(
      Effect.catch(() => Effect.succeed(undefined)),
    ),
  )
  if (!result) return c.json({ error: "Run not found" }, 404)
  return c.json(result)
})

projectApp.get("/runs", async (c) => {
  const limit = Number(c.req.query("limit") ?? 50)
  const runs = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* TraceRepository.Service
      return yield* repo.listRuns(limit)
    }).pipe(Effect.provide(projectLayer)),
  )
  return c.json(runs)
})
