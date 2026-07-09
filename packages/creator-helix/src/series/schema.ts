import { Schema } from "effect"

// ─── Episode Continuity ───

export const CharacterStateOverrideSchema = Schema.Struct({
  characterId: Schema.String,
  stateRef: Schema.String,
  distinguishingMarks: Schema.optional(Schema.Array(Schema.String)),
  notes: Schema.optional(Schema.String),
})

export const RelationshipStateSchema = Schema.Struct({
  characterAId: Schema.String,
  characterBId: Schema.String,
  tension: Schema.Number,
  status: Schema.String,
})

export const ContinuityStateSchema = Schema.Struct({
  characterStates: Schema.Array(CharacterStateOverrideSchema),
  relationshipStates: Schema.Array(RelationshipStateSchema),
  worldState: Schema.optional(Schema.Record(Schema.String, Schema.String)),
})

// ─── Episode (Series 中的单集) ───

export const EpisodeMetaSchema = Schema.Struct({
  episodeNumber: Schema.Number,
  title: Schema.String,
  synopsis: Schema.optional(Schema.String),
  continuityState: Schema.optional(ContinuityStateSchema),
})

export const EpisodeSchema = Schema.Struct({
  projectId: Schema.String,
  meta: EpisodeMetaSchema,
  styleOverrides: Schema.optional(Schema.Struct({
    colorPalette: Schema.optional(Schema.Array(Schema.String)),
    lightingStyle: Schema.optional(Schema.String),
    postProcessing: Schema.optional(Schema.Array(Schema.String)),
  })),
})

export type Episode = Schema.Schema.Type<typeof EpisodeSchema>
export type EpisodeMeta = Schema.Schema.Type<typeof EpisodeMetaSchema>
export type ContinuityState = Schema.Schema.Type<typeof ContinuityStateSchema>

// ─── Series ───

export const SeriesSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  logline: Schema.String,
  theme: Schema.optional(Schema.String),
  studioId: Schema.String,
  stylePresetId: Schema.optional(Schema.String),
  worldRules: Schema.optional(Schema.Array(Schema.String)),
  ordering: Schema.Literals(["sequential", "parallel"]),
  episodes: Schema.Array(EpisodeSchema),
  created_at: Schema.Number,
  updated_at: Schema.Number,
})

export type Series = Schema.Schema.Type<typeof SeriesSchema>
