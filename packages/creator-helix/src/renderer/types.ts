export * as RendererTypes from "./types"

import { Schema } from "effect"

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]).pipe(
  Schema.annotate({ identifier: "CreatorHelix.Vec3" }),
)
export type Vec3 = Schema.Schema.Type<typeof Vec3>

export const CameraKeyframe = Schema.Struct({
  time: Schema.Number,
  position: Schema.optional(Vec3),
  target: Schema.optional(Vec3),
  fov: Schema.optional(Schema.Number),
}).pipe(Schema.annotate({ identifier: "CreatorHelix.CameraKeyframe" }))
export type CameraKeyframe = Schema.Schema.Type<typeof CameraKeyframe>

export const CameraTrajectory = Schema.Struct({
  fps: Schema.Number,
  durationSeconds: Schema.Number,
  keyframes: Schema.Array(CameraKeyframe),
}).pipe(Schema.annotate({ identifier: "CreatorHelix.CameraTrajectory" }))
export type CameraTrajectory = Schema.Schema.Type<typeof CameraTrajectory>

export const ControlSignalConfig = Schema.Struct({
  keyframes: Schema.optional(Schema.Boolean),
  depth: Schema.optional(Schema.Boolean),
  camera: Schema.optional(Schema.Boolean),
  mask: Schema.optional(Schema.Boolean),
  flow: Schema.optional(Schema.Boolean),
  normals: Schema.optional(Schema.Boolean),
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
  fps: Schema.optional(Schema.Number),
}).pipe(Schema.annotate({ identifier: "CreatorHelix.ControlSignalConfig" }))
export type ControlSignalConfig = Schema.Schema.Type<typeof ControlSignalConfig>

export const ControlSignalBundle = Schema.Struct({
  shotId: Schema.String,
  prompt: Schema.String,
  keyframes: Schema.optional(Schema.Array(Schema.String)),
  depth: Schema.optional(Schema.Array(Schema.String)),
  camera: Schema.optional(CameraTrajectory),
  masks: Schema.optional(Schema.Array(Schema.String)),
  flow: Schema.optional(Schema.Array(Schema.String)),
  normals: Schema.optional(Schema.Array(Schema.String)),
}).pipe(Schema.annotate({ identifier: "CreatorHelix.ControlSignalBundle" }))
export type ControlSignalBundle = Schema.Schema.Type<typeof ControlSignalBundle>

export const ShotIntent = Schema.Struct({
  templateId: Schema.String,
  subject: Schema.String,
  mood: Schema.String,
  motion: Schema.String,
  durationSeconds: Schema.Number,
  narration: Schema.optional(Schema.String),
}).pipe(Schema.annotate({ identifier: "CreatorHelix.ShotIntent" }))
export type ShotIntent = Schema.Schema.Type<typeof ShotIntent>

export const GlobalStyle = Schema.Struct({
  colorPalette: Schema.String,
  lighting: Schema.String,
  postProcessing: Schema.String,
}).pipe(Schema.annotate({ identifier: "CreatorHelix.GlobalStyle" }))
export type GlobalStyle = Schema.Schema.Type<typeof GlobalStyle>

export const StoryboardIntent = Schema.Struct({
  shots: Schema.Array(ShotIntent),
  globalStyle: GlobalStyle,
}).pipe(Schema.annotate({ identifier: "CreatorHelix.StoryboardIntent" }))
export type StoryboardIntent = Schema.Schema.Type<typeof StoryboardIntent>
