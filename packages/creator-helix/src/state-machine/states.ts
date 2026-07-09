export * as StateMachine from "./states"

import { Schema } from "effect"
import { VideoProject } from "../schema/project"

export type State = VideoProject.State

const SubmitRequirement = Schema.Struct({
  type: Schema.Literal("SUBMIT_REQUIREMENT"),
  payload: VideoProject.Requirement,
})

const ScriptGenerated = Schema.Struct({
  type: Schema.Literal("SCRIPT_GENERATED"),
  payload: VideoProject.Script,
})

const StoryboardGenerated = Schema.Struct({
  type: Schema.Literal("STORYBOARD_GENERATED"),
  payload: VideoProject.Storyboard,
})

const AssetBatchDone = Schema.Struct({
  type: Schema.Literal("ASSET_BATCH_DONE"),
  payload: Schema.Array(VideoProject.Asset),
})

const AssetRejected = Schema.Struct({
  type: Schema.Literal("ASSET_REJECTED"),
  assetId: Schema.String,
  reason: Schema.String,
})

const ScriptRejected = Schema.Struct({
  type: Schema.Literal("SCRIPT_REJECTED"),
  reason: Schema.String,
})

const StoryboardRejected = Schema.Struct({
  type: Schema.Literal("STORYBOARD_REJECTED"),
  reason: Schema.String,
})

const ExportDone = Schema.Struct({
  type: Schema.Literal("EXPORT_DONE"),
  payload: VideoProject.ExportedVideo,
})

const ExportFailed = Schema.Struct({
  type: Schema.Literal("EXPORT_FAILED"),
  error: Schema.String,
})

const FinalRejected = Schema.Struct({
  type: Schema.Literal("FINAL_REJECTED"),
  reason: Schema.String,
})

const EditingDone = Schema.Struct({
  type: Schema.Literal("EDITING_DONE"),
  payload: Schema.Struct({
    draftVideo: VideoProject.DraftVideo,
    editingPlan: VideoProject.EditingPlan,
  }),
})

const SimpleEvent = (type: string) => Schema.Struct({ type: Schema.Literal(type) })

export const Event = Schema.Union([
  SubmitRequirement,
  SimpleEvent("ANALYSIS_DONE"),
  SimpleEvent("PLAN_DONE"),
  ScriptGenerated,
  SimpleEvent("SCRIPT_APPROVED"),
  ScriptRejected,
  StoryboardGenerated,
  SimpleEvent("STORYBOARD_APPROVED"),
  StoryboardRejected,
  AssetBatchDone,
  SimpleEvent("ALL_ASSETS_APPROVED"),
  AssetRejected,
  EditingDone,
  SimpleEvent("FINAL_APPROVED"),
  FinalRejected,
  ExportDone,
  ExportFailed,
  SimpleEvent("PAUSE"),
  SimpleEvent("RESUME"),
  SimpleEvent("RETRY"),
  SimpleEvent("RESTART"),
]).annotate({ identifier: "CreatorHelix.StateEvent" })
export type Event = Schema.Schema.Type<typeof Event>

export const isHumanState = (state: State) =>
  state === "PROJECT_INIT" ||
  state === "SCRIPT_REVIEW" ||
  state === "STORYBOARD_REVIEW" ||
  state === "FINAL_REVIEW" ||
  state === "PAUSED" ||
  state === "ERROR"

export const isTerminalState = (state: State) => state === "COMPLETED"
