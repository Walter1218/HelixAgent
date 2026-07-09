export * as ProjectRunner from "./runner"

import { Clock, Effect } from "effect"
import { BackgroundJob } from "@opencode-ai/core/background-job"
import { ProjectRepository } from "../persistence/repository"
import { ScriptPlanner } from "../planner/script-planner"
import { AssetGeneration } from "../services/asset-generation"
import { Editing } from "../services/editing"
import { Export } from "../services/export"
import { Qa } from "../services/qa"
import type { VideoProject } from "../schema/project"
import { isHumanState, isTerminalState, type Event, type State } from "../state-machine/states"
import { Transitions } from "../state-machine/transitions"

export const transition = (
  project: VideoProject.Info,
  event: Event,
): Effect.Effect<VideoProject.Info, Error, ProjectRepository.Service> =>
  Effect.gen(function* () {
    const repo = yield* ProjectRepository.Service
    const t = Transitions.find(project, event)
    if (!t) {
      return yield* Effect.fail(new Error(`Invalid transition: ${project.state} + ${event.type}`))
    }

    const context = applyEvent(project.state, project.context, event)
    const next: VideoProject.Info = {
      ...project,
      state: t.to,
      context,
      updatedAt: yield* Clock.currentTimeMillis,
    }

    yield* repo.save(next)
    yield* repo.logTransition({
      projectId: project.id,
      fromState: project.state,
      toState: t.to,
      event,
    })

    return next
  })

const hasPayload = (event: Event): event is Extract<Event, { payload: unknown }> =>
  "payload" in event

const applyEvent = (
  fromState: State,
  context: VideoProject.Context,
  event: Event,
): VideoProject.Context => {
  if (hasPayload(event)) {
    switch (event.type) {
      case "SUBMIT_REQUIREMENT":
        return { ...context, requirement: event.payload }
      case "SCRIPT_GENERATED":
        return { ...context, script: event.payload }
      case "STORYBOARD_GENERATED":
        return { ...context, storyboard: event.payload }
      case "ASSET_BATCH_DONE":
        return { ...context, assets: [...context.assets, ...event.payload] }
      case "EDITING_DONE":
        return { ...context, draftVideo: event.payload.draftVideo, editingPlan: event.payload.editingPlan }
      case "EXPORT_DONE":
        return { ...context, exportedVideo: event.payload }
    }
  }

  if (event.type === "PAUSE") {
    return { ...context, pausedFrom: fromState }
  }

  return context
}

export const runUntilHuman = (
  projectId: VideoProject.ID,
): Effect.Effect<VideoProject.Info, Error, ProjectRepository.Service> =>
  Effect.gen(function* () {
    const repo = yield* ProjectRepository.Service
    let project = yield* repo.get(projectId)
    if (!project) return yield* Effect.fail(new Error(`Project not found: ${projectId}`))

    while (!isHumanState(project.state) && !isTerminalState(project.state)) {
      const event: Event = yield* executeState(project)
      project = yield* transition(project, event)
    }

    return project
  })

export const startBackground = (
  projectId: VideoProject.ID,
): Effect.Effect<BackgroundJob.Info, never, BackgroundJob.Service | ProjectRepository.Service> =>
  Effect.gen(function* () {
    const repo = yield* ProjectRepository.Service
    const job = yield* BackgroundJob.Service

    const run = runUntilHuman(projectId).pipe(
      Effect.provideService(ProjectRepository.Service, repo),
      Effect.map(() => "waiting-for-human"),
      Effect.matchCauseEffect({
        onFailure: (cause) => Effect.succeed(`failed: ${cause}`),
        onSuccess: (value) => Effect.succeed(value),
      }),
    )

    return yield* job.start({
      type: "creator-helix-project",
      title: `CreatorHelix project ${projectId}`,
      metadata: { projectId },
      run,
    })
  })

const executeState = (project: VideoProject.Info): Effect.Effect<Event, Error> => {
  switch (project.state) {
    case "REQUIREMENT_ANALYSIS":
      return Effect.succeed<Event>({ type: "ANALYSIS_DONE" })

    case "PLANNING":
      return Effect.succeed<Event>({ type: "PLAN_DONE" })

    case "SCRIPT_GENERATION":
      return Effect.gen(function* () {
        const requirement = project.context.requirement
        if (!requirement) return yield* Effect.fail(new Error("Missing requirement"))
        const script = yield* ScriptPlanner.generateScript(requirement)
        return { type: "SCRIPT_GENERATED", payload: script } as Event
      }) as Effect.Effect<Event, Error>

    case "STORYBOARD_GENERATION":
      return Effect.gen(function* () {
        const requirement = project.context.requirement
        const script = project.context.script
        if (!requirement || !script) return yield* Effect.fail(new Error("Missing requirement or script"))
        const storyboard = yield* ScriptPlanner.generateStoryboard(script, requirement)
        return { type: "STORYBOARD_GENERATED", payload: storyboard } as Event
      }) as Effect.Effect<Event, Error>

    case "ASSET_GENERATION":
      return Effect.gen(function* () {
        if (!project.context.storyboard) return yield* Effect.fail(new Error("Missing storyboard"))
        const assets = yield* AssetGeneration.generateForProject(project)
        return { type: "ASSET_BATCH_DONE", payload: assets } as Event
      }) as Effect.Effect<Event, Error>

    case "ASSET_REVIEW":
      return Effect.gen(function* () {
        const result = yield* Qa.reviewAssets(project)
        if (!result.passed) {
          if (result.failedAssetId) {
            return { type: "ASSET_REJECTED", assetId: result.failedAssetId, reason: result.reason } as Event
          }
          return yield* Effect.fail(new Error(result.reason))
        }
        return { type: "ALL_ASSETS_APPROVED" } as Event
      }) as Effect.Effect<Event, Error>

    case "EDITING":
      return Effect.gen(function* () {
        const { draftUrl, editingPlan } = yield* Editing.compose(project)
        const draftVideo = {
          url: draftUrl,
          durationSeconds: project.context.script?.totalDurationSeconds ?? 0,
        }
        return { type: "EDITING_DONE", payload: { draftVideo, editingPlan } } as Event
      }) as Effect.Effect<Event, Error>

    case "EXPORT":
      return Effect.gen(function* () {
        const draftVideo = project.context.draftVideo
        if (!draftVideo) return yield* Effect.fail(new Error("Missing draft video"))
        const finalUrl = yield* Export.render(project, draftVideo.url)
        const exportedVideo = {
          url: finalUrl,
          durationSeconds: draftVideo.durationSeconds,
        }
        return { type: "EXPORT_DONE", payload: exportedVideo } as Event
      }) as Effect.Effect<Event, Error>

    default:
      return Effect.fail(new Error(`Automatic execution not implemented for state: ${project.state}`))
  }
}
