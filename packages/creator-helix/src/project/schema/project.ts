import { Schema } from "effect"
import { ScriptSchema } from "./script"

export const ProjectMetaSchema = Schema.Struct({
  title: Schema.String,
  logline: Schema.String,
  theme: Schema.String,
  targetDuration: Schema.Number,
})

export const ProjectSchema = Schema.Struct({
  id: Schema.String,
  meta: ProjectMetaSchema,
  stylePresetId: Schema.String,
  worldRules: Schema.Array(Schema.String),
  scripts: Schema.Array(ScriptSchema),
})

export type Project = Schema.Schema.Type<typeof ProjectSchema>
export type ProjectMeta = Schema.Schema.Type<typeof ProjectMetaSchema>
