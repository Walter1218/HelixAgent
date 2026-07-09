export * as Server from "./app"

import { Hono } from "hono"
import { Effect, Layer } from "effect"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import { BackgroundJob } from "@opencode-ai/core/background-job"
import { Database } from "@opencode-ai/core/database/database"
import { ProjectRepository } from "../persistence/repository"
import { VideoProject } from "../schema/project"
import { ProjectRunner } from "../executor/runner"
import type { Event } from "../state-machine/states"
import { studioApp } from "./studio-api"
import { projectApp } from "./project-api"
import { seriesApp } from "./series-api"

const appLayer = ProjectRepository.defaultLayer.pipe(
  Layer.merge(BackgroundJob.defaultLayer),
  Layer.provide(Database.defaultLayer),
)

const { runPromise } = makeRuntime(ProjectRepository.Service, appLayer)

export const app = new Hono()

// ─── Legacy VideoProject API (旧管线) ───

app
  .basePath("/api/creator-helix")
  .post("/projects", async (c) => {
    const body = await c.req.json()
    const project = await runPromise((repo) =>
      repo.create({
        userId: String(body.userId ?? "anonymous"),
        title: String(body.title ?? "Untitled"),
      }),
    )
    return c.json(project, 201)
  })
  .get("/projects/:projectID", async (c) => {
    const projectID = c.req.param("projectID")
    const project = await runPromise((repo) => repo.get(VideoProject.ID.make(projectID)))
    if (!project) return c.json({ error: "Project not found" }, 404)
    return c.json(project)
  })
  .post("/projects/:projectID/run", async (c) => {
    const projectID = c.req.param("projectID")
    const project = await runPromise((repo) =>
      ProjectRunner.runUntilHuman(VideoProject.ID.make(projectID)).pipe(
        Effect.provideService(ProjectRepository.Service, repo),
      ),
    )
    return c.json(project)
  })
  .post("/projects/:projectID/reviews/:stage", async (c) => {
    const projectID = c.req.param("projectID")
    const stage = c.req.param("stage")
    const body = await c.req.json()
    const action = String(body.action ?? "approved")
    const project = await runPromise((repo) =>
      Effect.gen(function* () {
        const current = yield* repo.get(VideoProject.ID.make(projectID))
        if (!current) return yield* Effect.fail(new Error("Project not found"))

        const event = reviewActionToEvent(stage, action)
        if (!event) return yield* Effect.fail(new Error(`Invalid review: ${stage}/${action}`))

        return yield* ProjectRunner.transition(current, event)
      }).pipe(Effect.provideService(ProjectRepository.Service, repo)),
    )
    return c.json(project)
  })
  .post("/projects/:projectID/pause", async (c) => {
    const projectID = c.req.param("projectID")
    const project = await runPromise((repo) =>
      Effect.gen(function* () {
        const current = yield* repo.get(VideoProject.ID.make(projectID))
        if (!current) return yield* Effect.fail(new Error("Project not found"))
        return yield* ProjectRunner.transition(current, { type: "PAUSE" })
      }).pipe(Effect.provideService(ProjectRepository.Service, repo)),
    )
    return c.json(project)
  })
  .post("/projects/:projectID/resume", async (c) => {
    const projectID = c.req.param("projectID")
    const project = await runPromise((repo) =>
      Effect.gen(function* () {
        const current = yield* repo.get(VideoProject.ID.make(projectID))
        if (!current) return yield* Effect.fail(new Error("Project not found"))
        return yield* ProjectRunner.transition(current, { type: "RESUME" })
      }).pipe(Effect.provideService(ProjectRepository.Service, repo)),
    )
    return c.json(project)
  })

// ─── New Knowledge Graph API ───

app.route("/", studioApp)
app.route("/", projectApp)
app.route("/", seriesApp)

const reviewActionToEvent = (stage: string, action: string): Event | undefined => {
  if (action === "approved") {
    if (stage === "script") return { type: "SCRIPT_APPROVED" }
    if (stage === "storyboard") return { type: "STORYBOARD_APPROVED" }
    if (stage === "final") return { type: "FINAL_APPROVED" }
  }
  if (action === "rejected") {
    if (stage === "script") return { type: "SCRIPT_REJECTED", reason: "manual" }
    if (stage === "storyboard") return { type: "STORYBOARD_REJECTED", reason: "manual" }
    if (stage === "final") return { type: "FINAL_REJECTED", reason: "manual" }
  }
  return undefined
}
