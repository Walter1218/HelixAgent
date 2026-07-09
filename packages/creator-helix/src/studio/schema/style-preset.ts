import { Schema } from "effect"
import { ImageRefSchema } from "./image-ref"

export const CameraStyleSchema = Schema.Struct({
  preferredMovements: Schema.Array(Schema.String),
  pacing: Schema.String,
  framingBias: Schema.String,
})

export const StylePresetSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  colorPalette: Schema.Array(Schema.String),
  lightingStyle: Schema.String,
  postProcessing: Schema.Array(Schema.String),
  cameraStyle: CameraStyleSchema,
  moodKeywords: Schema.Array(Schema.String),
  referenceImages: Schema.Array(ImageRefSchema),
})

export type StylePreset = Schema.Schema.Type<typeof StylePresetSchema>
export type CameraStyle = Schema.Schema.Type<typeof CameraStyleSchema>
