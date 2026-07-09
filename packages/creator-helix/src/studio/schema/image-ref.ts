import { Schema } from "effect"

export const ImageRefSchema = Schema.Struct({
  url: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  seed: Schema.optional(Schema.Number),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
})

export type ImageRef = Schema.Schema.Type<typeof ImageRefSchema>
