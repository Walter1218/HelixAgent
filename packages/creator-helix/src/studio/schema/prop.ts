import { Schema } from "effect"
import { ImageRefSchema } from "./image-ref"

export const PropStateSchema = Schema.Struct({
  stateId: Schema.String,
  era: Schema.String,
  condition: Schema.String,
  referenceImage: ImageRefSchema,
})

export const PropSchema = Schema.Struct({
  id: Schema.String,
  baseDefinition: Schema.Struct({
    name: Schema.String,
    category: Schema.String,
    material: Schema.String,
    description: Schema.String,
  }),
  stateTimeline: Schema.Array(PropStateSchema),
  scaleReference: Schema.Struct({
    size: Schema.String,
    comparison: Schema.String,
  }),
})

export type Prop = Schema.Schema.Type<typeof PropSchema>
export type PropState = Schema.Schema.Type<typeof PropStateSchema>
