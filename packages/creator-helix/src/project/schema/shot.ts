import { Schema } from "effect"

export const CameraSchema = Schema.Struct({
  type: Schema.Literals([
    "push-in", "pull-back", "pan", "tilt", "track", "dolly",
    "crane", "orbit", "static",
  ] as const),
  framing: Schema.Literals([
    "extreme-wide", "wide", "full", "medium", "close-up", "extreme-close-up",
  ] as const),
  angle: Schema.Literals([
    "front", "side", "back", "high", "low", "dutch", "birds-eye", "worms-eye",
  ] as const),
  movementSpeed: Schema.Literals(["static", "slow", "normal", "fast"] as const),
  lens: Schema.Literals(["wide", "standard", "telephoto", "macro"] as const),
})

export const ContinuitySchema = Schema.Struct({
  eyelineMatch: Schema.NullOr(Schema.String),
  shotReverseShot: Schema.NullOr(Schema.String),
  actionContinuation: Schema.NullOr(Schema.String),
  costumeState: Schema.String,
  propState: Schema.String,
  timeOfDayLock: Schema.Boolean,
  parallelMontage: Schema.Array(Schema.String),
})

export const ShotSubjectSchema = Schema.Struct({
  characterId: Schema.String,
  characterState: Schema.String,
  expression: Schema.String,
  action: Schema.String,
  position: Schema.String,
  depthLayer: Schema.Literals(["foreground", "midground", "background"] as const),
  outfitVariant: Schema.NullOr(Schema.String),
  crowdPresetId: Schema.NullOr(Schema.String),
})

export const EnvironmentOverridesSchema = Schema.Struct({
  lighting: Schema.optional(Schema.String),
  weather: Schema.optional(Schema.String),
  timeShift: Schema.optional(Schema.String),
  extraProps: Schema.optional(Schema.Array(Schema.String)),
})

export const AudioSchema = Schema.Struct({
  dialogueRef: Schema.NullOr(Schema.String),
  bgmId: Schema.NullOr(Schema.String),
  sfx: Schema.Array(Schema.String),
  ambientSound: Schema.NullOr(Schema.String),
})

export const ShotReferenceCharacterSchema = Schema.Struct({
  characterId: Schema.String,
  stateRef: Schema.String,
  expressionRef: Schema.String,
  outfitVariant: Schema.NullOr(Schema.String),
})

export const ShotReferenceLocationSchema = Schema.Struct({
  locationId: Schema.String,
  stateRef: Schema.String,
  angleRef: Schema.NullOr(Schema.String),
})

export const ShotReferencePropSchema = Schema.Struct({
  propId: Schema.String,
  stateRef: Schema.String,
})

export const ShotReferencesSchema = Schema.Struct({
  characters: Schema.Array(ShotReferenceCharacterSchema),
  location: ShotReferenceLocationSchema,
  props: Schema.Array(ShotReferencePropSchema),
  stylePresetId: Schema.String,
})

export const ShotPromptSchema = Schema.Struct({
  subjectDesc: Schema.String,
  visualDesc: Schema.String,
  cameraDesc: Schema.String,
  lightingDesc: Schema.String,
  moodDesc: Schema.String,
})

export const ShotVersionSchema = Schema.Struct({
  versionId: Schema.String,
  taskId: Schema.String,
  videoUrl: Schema.String,
  resolution: Schema.String,
  fileSize: Schema.Number,
  status: Schema.Literals(["generating", "succeeded", "failed"] as const),
  score: Schema.NullOr(Schema.Number),
  createdAt: Schema.Date,
})

export const ShotOutputSchema = Schema.Struct({
  versions: Schema.Array(ShotVersionSchema),
  selectedVersion: Schema.NullOr(Schema.String),
  approvalStatus: Schema.Literals(["pending", "approved", "rejected", "revise"] as const),
})

export const ShotSchema = Schema.Struct({
  id: Schema.String,
  order: Schema.Number,
  duration: Schema.Number,
  transitionIn: Schema.String,
  transitionOut: Schema.String,
  narrativePurpose: Schema.String,
  camera: CameraSchema,
  continuity: ContinuitySchema,
  subjects: Schema.Array(ShotSubjectSchema),
  environmentOverrides: EnvironmentOverridesSchema,
  audio: AudioSchema,
  references: ShotReferencesSchema,
  prompt: ShotPromptSchema,
  output: ShotOutputSchema,
})

export type Shot = Schema.Schema.Type<typeof ShotSchema>
export type ShotSubject = Schema.Schema.Type<typeof ShotSubjectSchema>
export type ShotVersion = Schema.Schema.Type<typeof ShotVersionSchema>
export type Camera = Schema.Schema.Type<typeof CameraSchema>
export type Continuity = Schema.Schema.Type<typeof ContinuitySchema>
