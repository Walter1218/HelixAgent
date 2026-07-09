import { Schema } from "effect"

export const WorldRuleSchema = Schema.Struct({
  id: Schema.String,
  category: Schema.Literals(["physics", "technology", "magic", "society", "visual"] as const),
  rule: Schema.String,
  visualConstraint: Schema.String,
})

export type WorldRule = Schema.Schema.Type<typeof WorldRuleSchema>
