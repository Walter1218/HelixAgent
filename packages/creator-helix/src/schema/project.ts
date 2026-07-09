export * as VideoProject from "./project"

import { Schema } from "effect"
import { optional } from "@opencode-ai/schema/schema"

export const ID = Schema.String.pipe(Schema.brand("CreatorHelix.ProjectID"))
export type ID = typeof ID.Type

export const State = Schema.Union([
  Schema.Literal("PROJECT_INIT"),
  Schema.Literal("REQUIREMENT_ANALYSIS"),
  Schema.Literal("PLANNING"),
  Schema.Literal("SCRIPT_GENERATION"),
  Schema.Literal("SCRIPT_REVIEW"),
  Schema.Literal("STORYBOARD_GENERATION"),
  Schema.Literal("STORYBOARD_REVIEW"),
  Schema.Literal("ASSET_GENERATION"),
  Schema.Literal("ASSET_REVIEW"),
  Schema.Literal("EDITING"),
  Schema.Literal("FINAL_REVIEW"),
  Schema.Literal("EXPORT"),
  Schema.Literal("COMPLETED"),
  Schema.Literal("ERROR"),
  Schema.Literal("PAUSED"),
]).annotate({ identifier: "CreatorHelix.State" })
export type State = typeof State.Type

export const Requirement = Schema.Struct({
  topic: Schema.String,
  durationSeconds: Schema.Number,
  style: Schema.String,
  targetAudience: Schema.String,
  referenceUrls: Schema.Array(Schema.String),
}).annotate({ identifier: "CreatorHelix.Requirement" })
export interface Requirement extends Schema.Schema.Type<typeof Requirement> {}

export const Shot = Schema.Struct({
  id: Schema.String,
  sequence: Schema.Number,
  description: Schema.String,
  visualPrompt: Schema.String,
  motionPrompt: Schema.String,
  narration: Schema.String,
  durationSeconds: Schema.Number,
  assetId: optional(Schema.String),
}).annotate({ identifier: "CreatorHelix.Shot" })
export interface Shot extends Schema.Schema.Type<typeof Shot> {}

export const Script = Schema.Struct({
  title: Schema.String,
  summary: Schema.String,
  totalDurationSeconds: Schema.Number,
  narration: Schema.String,
}).annotate({ identifier: "CreatorHelix.Script" })
export interface Script extends Schema.Schema.Type<typeof Script> {}

export const Storyboard = Schema.Struct({
  shots: Schema.Array(Shot),
}).annotate({ identifier: "CreatorHelix.Storyboard" })
export interface Storyboard extends Schema.Schema.Type<typeof Storyboard> {}

const assetType = Schema.Union([
  Schema.Literal("video"),
  Schema.Literal("image"),
  Schema.Literal("audio"),
  Schema.Literal("tts"),
  Schema.Literal("music"),
]).annotate({ identifier: "CreatorHelix.AssetType" })

const assetStatus = Schema.Union([
  Schema.Literal("pending"),
  Schema.Literal("generating"),
  Schema.Literal("done"),
  Schema.Literal("failed"),
]).annotate({ identifier: "CreatorHelix.AssetStatus" })

export const Asset = Schema.Struct({
  id: Schema.String,
  type: assetType,
  url: Schema.String,
  shotId: optional(Schema.String),
  status: assetStatus,
  controlSignals: optional(Schema.Unknown),
}).annotate({ identifier: "CreatorHelix.Asset" })
export interface Asset extends Schema.Schema.Type<typeof Asset> {}

export const DraftVideo = Schema.Struct({
  url: Schema.String,
  durationSeconds: Schema.Number,
}).annotate({ identifier: "CreatorHelix.DraftVideo" })
export interface DraftVideo extends Schema.Schema.Type<typeof DraftVideo> {}

export const ExportedVideo = Schema.Struct({
  url: Schema.String,
  durationSeconds: Schema.Number,
}).annotate({ identifier: "CreatorHelix.ExportedVideo" })
export interface ExportedVideo extends Schema.Schema.Type<typeof ExportedVideo> {}

export const EditingPlan = Schema.Struct({
  transitions: Schema.String,
  subtitleStyle: Schema.String,
  musicPrompt: Schema.String,
  pacing: Schema.String,
}).annotate({ identifier: "CreatorHelix.EditingPlan" })
export interface EditingPlan extends Schema.Schema.Type<typeof EditingPlan> {}

export const Context = Schema.Struct({
  requirement: optional(Requirement),
  script: optional(Script),
  storyboard: optional(Storyboard),
  assets: Schema.Array(Asset),
  editingPlan: optional(EditingPlan),
  draftVideo: optional(DraftVideo),
  exportedVideo: optional(ExportedVideo),
  pausedFrom: optional(State),
  error: optional(Schema.String),
}).annotate({ identifier: "CreatorHelix.Context" })
export interface Context extends Schema.Schema.Type<typeof Context> {}

export const Info = Schema.Struct({
  id: ID,
  userId: Schema.String,
  title: Schema.String,
  state: State,
  context: Context,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}).annotate({ identifier: "CreatorHelix.Project" })
export interface Info extends Schema.Schema.Type<typeof Info> {}
