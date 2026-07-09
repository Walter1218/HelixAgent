import { Schema } from "effect"
import { ShotSchema } from "./shot"

export const DialogueSchema = Schema.Struct({
  characterId: Schema.String,
  text: Schema.String,
  tone: Schema.String,
  timing: Schema.Literals(["pre-shot", "on-shot", "post-shot"] as const),
})

export const NarrativeBeatSchema = Schema.Struct({
  setup: Schema.String,
  conflict: Schema.String,
  climax: Schema.String,
  resolution: Schema.String,
})

export const SequenceSchema = Schema.Struct({
  id: Schema.String,
  scriptActRef: Schema.String,
  narrativeBeat: NarrativeBeatSchema,
  emotionalArc: Schema.String,
  locationId: Schema.String,
  locationStateRef: Schema.String,
  timeOfDay: Schema.String,
  weather: Schema.String,
  charactersPresent: Schema.Array(Schema.String),
  dialogue: Schema.Array(DialogueSchema),
  shots: Schema.Array(ShotSchema),
})

export type Sequence = Schema.Schema.Type<typeof SequenceSchema>
export type Dialogue = Schema.Schema.Type<typeof DialogueSchema>
export type NarrativeBeat = Schema.Schema.Type<typeof NarrativeBeatSchema>
