import { Schema } from "effect"
import { CharacterSchema } from "./character"
import { LocationSchema } from "./location"
import { PropSchema } from "./prop"
import { StylePresetSchema } from "./style-preset"
import { WorldRuleSchema } from "./world-rule"
import { CrowdPresetSchema } from "./crowd-preset"
import { AudioLibrarySchema } from "./audio"

export const StudioSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  characters: Schema.Array(CharacterSchema),
  locations: Schema.Array(LocationSchema),
  props: Schema.Array(PropSchema),
  crowdPresets: Schema.Array(CrowdPresetSchema),
  stylePresets: Schema.Array(StylePresetSchema),
  worldRules: Schema.Array(WorldRuleSchema),
  audioLibrary: AudioLibrarySchema,
})

export type Studio = Schema.Schema.Type<typeof StudioSchema>
