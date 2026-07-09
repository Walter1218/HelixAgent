import { Schema } from "effect"

export const SoundEffectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: Schema.String,
  duration: Schema.Number,
  url: Schema.String,
})

export const BGMSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  mood: Schema.String,
  tempo: Schema.String,
  duration: Schema.Number,
  url: Schema.String,
})

export const VoicePresetSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  gender: Schema.String,
  age: Schema.String,
  tone: Schema.String,
  language: Schema.String,
})

export const AudioLibrarySchema = Schema.Struct({
  soundEffects: Schema.Array(SoundEffectSchema),
  bgm: Schema.Array(BGMSchema),
  voicePresets: Schema.Array(VoicePresetSchema),
})

export type SoundEffect = Schema.Schema.Type<typeof SoundEffectSchema>
export type BGM = Schema.Schema.Type<typeof BGMSchema>
export type VoicePreset = Schema.Schema.Type<typeof VoicePresetSchema>
export type AudioLibrary = Schema.Schema.Type<typeof AudioLibrarySchema>
