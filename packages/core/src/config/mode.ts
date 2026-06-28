import { Schema } from "effect"

export const EvolutionConfig = Schema.Struct({
  judgeEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable judge for this mode (default: false)"
  }),
  judgeChecks: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Specific judge checks to run (default: all)"
  }),
  traceExportEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable trace export for this mode (default: false)"
  }),
  evolutionEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable evolution flywheel for this mode (default: false)"
  }),
})

export const ModeConfig = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable this mode (default: true)"
  }),
  candidates: Schema.optional(Schema.Number).annotate({
    description: "Number of candidates for max mode (default: 5)"
  }),
  evolution: Schema.optional(EvolutionConfig).annotate({
    description: "Evolution configuration for this mode"
  }),
})

export const ModesConfig = Schema.Struct({
  ask: Schema.optional(ModeConfig).annotate({
    description: "Ask mode configuration"
  }),
  build: Schema.optional(ModeConfig).annotate({
    description: "Build mode configuration"
  }),
  plan: Schema.optional(ModeConfig).annotate({
    description: "Plan mode configuration"
  }),
  compose: Schema.optional(ModeConfig).annotate({
    description: "Compose mode configuration"
  }),
  max: Schema.optional(ModeConfig).annotate({
    description: "Max mode configuration"
  }),
  loop: Schema.optional(ModeConfig).annotate({
    description: "Loop mode configuration"
  }),
}).annotate({
  description: "Mode system configuration"
})

export type ModesConfig = Schema.Schema.Type<typeof ModesConfig>

export * as ConfigMode from "./mode"
