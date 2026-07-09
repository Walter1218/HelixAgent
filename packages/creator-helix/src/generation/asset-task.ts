import { Schema } from "effect"

export const AssetTaskSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literals([
    "portrait", "concept", "prop", "expression", "style-ref", "video",
  ] as const),
  status: Schema.Literals(["queued", "running", "succeeded", "failed"] as const),
  provider: Schema.Literals(["seedDream", "seedDance", "longcat"] as const),
  prompt: Schema.String,
  references: Schema.Array(Schema.String),
  outputs: Schema.Array(Schema.Struct({
    url: Schema.String,
    seed: Schema.Number,
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  })),
  retryCount: Schema.Number,
  maxRetries: Schema.Number,
  parentRef: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
})

export type AssetTask = Schema.Schema.Type<typeof AssetTaskSchema>

export const createAssetTask = (
  type: AssetTask["type"],
  provider: AssetTask["provider"],
  prompt: string,
  parentRef?: string,
): AssetTask => ({
  id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type,
  status: "queued",
  provider,
  prompt,
  references: [],
  outputs: [],
  retryCount: 0,
  maxRetries: 3,
  parentRef: parentRef ?? null,
  error: null,
})
