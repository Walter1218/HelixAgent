import { Schema } from "effect"
import { ImageRefSchema } from "./image-ref"

export const CharacterAppearanceSchema = Schema.Struct({
  face: Schema.String,
  hair: Schema.String,
  eyes: Schema.String,
  skin: Schema.String,
  bodyType: Schema.String,
  typicalOutfit: Schema.String,
})

export const RelationSchema = Schema.Struct({
  targetCharacterId: Schema.String,
  type: Schema.String,
  description: Schema.String,
  emotionalTension: Schema.Number,
})

export const CharacterStateSchema = Schema.Struct({
  stateId: Schema.String,
  era: Schema.String,
  ageRange: Schema.Tuple([Schema.Number, Schema.Number]),
  appearance: CharacterAppearanceSchema,
  portrait: ImageRefSchema,
  personalityShift: Schema.String,
  relations: Schema.Array(RelationSchema),
})

export const ExpressionMapSchema = Schema.Struct({
  neutral: ImageRefSchema,
  angry: ImageRefSchema,
  sad: ImageRefSchema,
  surprised: ImageRefSchema,
  happy: ImageRefSchema,
  determined: ImageRefSchema,
  fearful: ImageRefSchema,
})

export const CharacterSchema = Schema.Struct({
  id: Schema.String,
  baseIdentity: Schema.Struct({
    name: Schema.String,
    gender: Schema.String,
    race: Schema.String,
    distinguishingMarks: Schema.Array(Schema.String),
  }),
  stateTimeline: Schema.Array(CharacterStateSchema),
  expressionSheet: ExpressionMapSchema,
})

export type Character = Schema.Schema.Type<typeof CharacterSchema>
export type CharacterState = Schema.Schema.Type<typeof CharacterStateSchema>
export type CharacterAppearance = Schema.Schema.Type<typeof CharacterAppearanceSchema>
export type Relation = Schema.Schema.Type<typeof RelationSchema>
export type ExpressionMap = Schema.Schema.Type<typeof ExpressionMapSchema>
