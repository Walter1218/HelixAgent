import { Schema } from "effect"
import { ImageRefSchema } from "./image-ref"

export const CrowdPresetSchema = Schema.Struct({
  id: Schema.String,
  category: Schema.String,
  density: Schema.Literals(["sparse", "moderate", "dense", "massive"] as const),
  styleReference: ImageRefSchema,
  description: Schema.String,
})

export type CrowdPreset = Schema.Schema.Type<typeof CrowdPresetSchema>
