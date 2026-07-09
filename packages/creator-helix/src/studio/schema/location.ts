import { Schema } from "effect"
import { ImageRefSchema } from "./image-ref"

export const AtmosphereSchema = Schema.Struct({
  timeOfDay: Schema.String,
  weather: Schema.String,
  season: Schema.String,
  lighting: Schema.String,
  crowdDensity: Schema.String,
})

export const DepthLayersSchema = Schema.Struct({
  foreground: Schema.String,
  midground: Schema.String,
  background: Schema.String,
})

export const LocationStateSchema = Schema.Struct({
  stateId: Schema.String,
  era: Schema.String,
  condition: Schema.String,
  atmosphere: AtmosphereSchema,
  conceptImage: ImageRefSchema,
  depthLayers: DepthLayersSchema,
  referenceAngles: Schema.Array(
    Schema.Struct({
      angle: Schema.String,
      image: ImageRefSchema,
    }),
  ),
})

export const LocationSchema = Schema.Struct({
  id: Schema.String,
  baseDefinition: Schema.Struct({
    name: Schema.String,
    type: Schema.Literals(["interior", "exterior", "virtual"] as const),
    architecture: Schema.String,
    geography: Schema.String,
    scale: Schema.String,
  }),
  stateTimeline: Schema.Array(LocationStateSchema),
})

export type Location = Schema.Schema.Type<typeof LocationSchema>
export type LocationState = Schema.Schema.Type<typeof LocationStateSchema>
export type Atmosphere = Schema.Schema.Type<typeof AtmosphereSchema>
export type DepthLayers = Schema.Schema.Type<typeof DepthLayersSchema>
