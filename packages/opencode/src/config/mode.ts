import { Schema } from "effect"

export const MaxModeConfig = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable Max mode (parallel candidate generation)",
  }),
  candidates: Schema.optional(Schema.Number.pipe(Schema.positive())).annotate({
    description: "Number of candidates to generate (default: 3)",
  }),
  judge: Schema.optional(Schema.Boolean).annotate({
    description: "Enable Judge evaluation for Max mode",
  }),
})

export type MaxModeConfig = Schema.Schema.Type<typeof MaxModeConfig>
