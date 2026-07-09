export * as Transitions from "./transitions"

import type { VideoProject } from "../schema/project"
import type { Event, State } from "./states"

export interface Transition {
  readonly from: State
  readonly event: Event["type"]
  readonly to: State
  readonly guard?: (project: VideoProject.Info, event: Event) => boolean
}

export const all: Transition[] = [
  { from: "PROJECT_INIT", event: "SUBMIT_REQUIREMENT", to: "REQUIREMENT_ANALYSIS" },
  { from: "REQUIREMENT_ANALYSIS", event: "ANALYSIS_DONE", to: "PLANNING" },
  { from: "PLANNING", event: "PLAN_DONE", to: "SCRIPT_GENERATION" },
  { from: "SCRIPT_GENERATION", event: "SCRIPT_GENERATED", to: "SCRIPT_REVIEW" },
  { from: "SCRIPT_REVIEW", event: "SCRIPT_APPROVED", to: "STORYBOARD_GENERATION" },
  { from: "SCRIPT_REVIEW", event: "SCRIPT_REJECTED", to: "SCRIPT_GENERATION" },
  { from: "SCRIPT_REVIEW", event: "PAUSE", to: "PAUSED" },
  { from: "STORYBOARD_GENERATION", event: "STORYBOARD_GENERATED", to: "STORYBOARD_REVIEW" },
  { from: "STORYBOARD_REVIEW", event: "STORYBOARD_APPROVED", to: "ASSET_GENERATION" },
  { from: "STORYBOARD_REVIEW", event: "STORYBOARD_REJECTED", to: "STORYBOARD_GENERATION" },
  { from: "STORYBOARD_REVIEW", event: "SCRIPT_REJECTED", to: "SCRIPT_GENERATION" },
  { from: "STORYBOARD_REVIEW", event: "PAUSE", to: "PAUSED" },
  { from: "ASSET_GENERATION", event: "ASSET_BATCH_DONE", to: "ASSET_REVIEW" },
  { from: "ASSET_REVIEW", event: "ASSET_REJECTED", to: "ASSET_GENERATION" },
  { from: "ASSET_REVIEW", event: "ALL_ASSETS_APPROVED", to: "EDITING" },
  { from: "ASSET_REVIEW", event: "PAUSE", to: "PAUSED" },
  { from: "EDITING", event: "EDITING_DONE", to: "FINAL_REVIEW" },
  { from: "FINAL_REVIEW", event: "FINAL_APPROVED", to: "EXPORT" },
  { from: "FINAL_REVIEW", event: "FINAL_REJECTED", to: "EDITING" },
  { from: "FINAL_REVIEW", event: "PAUSE", to: "PAUSED" },
  { from: "EXPORT", event: "EXPORT_DONE", to: "COMPLETED" },
  { from: "EXPORT", event: "EXPORT_FAILED", to: "ERROR" },
  { from: "ERROR", event: "RETRY", to: "EXPORT" },
  { from: "ERROR", event: "RESTART", to: "REQUIREMENT_ANALYSIS" },
  {
    from: "PAUSED",
    event: "RESUME",
    to: "SCRIPT_REVIEW",
    guard: (project) => project.context.pausedFrom === "SCRIPT_REVIEW",
  },
  {
    from: "PAUSED",
    event: "RESUME",
    to: "STORYBOARD_REVIEW",
    guard: (project) => project.context.pausedFrom === "STORYBOARD_REVIEW",
  },
  {
    from: "PAUSED",
    event: "RESUME",
    to: "ASSET_REVIEW",
    guard: (project) => project.context.pausedFrom === "ASSET_REVIEW",
  },
  {
    from: "PAUSED",
    event: "RESUME",
    to: "FINAL_REVIEW",
    guard: (project) => project.context.pausedFrom === "FINAL_REVIEW",
  },
]

export const find = (project: VideoProject.Info, event: Event): Transition | undefined =>
  all.find((t) => t.from === project.state && t.event === event.type && (!t.guard || t.guard(project, event)))
