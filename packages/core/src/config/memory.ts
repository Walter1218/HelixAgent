import { Schema } from "effect"

export const Info = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable memory system (default: true)"
  }),
  vector: Schema.optional(Schema.Struct({
    enabled: Schema.optional(Schema.Boolean).annotate({
      description: "Enable vector embeddings (default: true)"
    }),
    api_url: Schema.optional(Schema.String).annotate({
      description: "Embedding API URL (default: http://localhost:1234/v1/embeddings)"
    }),
    model: Schema.optional(Schema.String).annotate({
      description: "Embedding model name (default: text-embedding-nomic-embed-text-v1.5)"
    }),
  })).annotate({
    description: "Vector embedding configuration"
  }),
  decay: Schema.optional(Schema.Struct({
    enabled: Schema.optional(Schema.Boolean).annotate({
      description: "Enable memory decay (default: true)"
    }),
    max_age_days: Schema.optional(Schema.Number).annotate({
      description: "Maximum age in days for memory entries (default: 90)"
    }),
  })).annotate({
    description: "Memory decay configuration"
  }),
  cc_index: Schema.optional(Schema.Boolean).annotate({
    description: "Enable Claude Code memory indexing (default: false)"
  }),
  reconcile_on_search: Schema.optional(Schema.Boolean).annotate({
    description: "Reconcile memory before search (default: true)"
  }),
}).annotate({
  description: "Memory system configuration"
})

export type Info = Schema.Schema.Type<typeof Info>

export * as ConfigMemory from "./memory"
