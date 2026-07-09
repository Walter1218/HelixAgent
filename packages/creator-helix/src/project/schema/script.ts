import { Schema } from "effect"
import { SequenceSchema } from "./sequence"

export const ActSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  sequenceIds: Schema.Array(Schema.String),
})

export const NarrativeStructureSchema = Schema.Struct({
  acts: Schema.Array(ActSchema),
})

export const TimelineSchema = Schema.Struct({
  storyStart: Schema.String,
  narrativeOrder: Schema.Array(Schema.String),
})

export const CharacterOverridesSchema = Schema.Struct({
  face: Schema.optional(Schema.String),
  hair: Schema.optional(Schema.String),
  eyes: Schema.optional(Schema.String),
  skin: Schema.optional(Schema.String),
  bodyType: Schema.optional(Schema.String),
  typicalOutfit: Schema.optional(Schema.String),
  personality: Schema.optional(Schema.String),
})

export const CharacterUsageSchema = Schema.Struct({
  characterId: Schema.String,
  stateRef: Schema.String,
  arc: Schema.Array(Schema.String),
  overrides: Schema.optional(CharacterOverridesSchema),
})

export const AtmosphereOverridesSchema = Schema.Struct({
  timeOfDay: Schema.optional(Schema.String),
  weather: Schema.optional(Schema.String),
  season: Schema.optional(Schema.String),
  lighting: Schema.optional(Schema.String),
  crowdDensity: Schema.optional(Schema.String),
})

export const LocationUsageSchema = Schema.Struct({
  locationId: Schema.String,
  stateRef: Schema.String,
  atmosphereOverrides: Schema.optional(AtmosphereOverridesSchema),
})

export const PropUsageSchema = Schema.Struct({
  propId: Schema.String,
  stateRef: Schema.String,
})

export const ScriptSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  narrativeStructure: NarrativeStructureSchema,
  timeline: TimelineSchema,
  characterUsages: Schema.Array(CharacterUsageSchema),
  locationUsages: Schema.Array(LocationUsageSchema),
  propUsages: Schema.Array(PropUsageSchema),
  sequences: Schema.Array(SequenceSchema),
})

export type Script = Schema.Schema.Type<typeof ScriptSchema>
export type CharacterUsage = Schema.Schema.Type<typeof CharacterUsageSchema>
export type LocationUsage = Schema.Schema.Type<typeof LocationUsageSchema>
export type PropUsage = Schema.Schema.Type<typeof PropUsageSchema>
export type Act = Schema.Schema.Type<typeof ActSchema>
