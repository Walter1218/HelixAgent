import { Schema } from "effect"

// ── Shared types ──

export const RequirementDraft = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  type: Schema.Literals(["functional", "non-functional", "security", "performance", "ux", "compatibility"]),
  priority: Schema.Literals(["must", "should", "nice-to-have"]),
  dependencies: Schema.Array(Schema.String),
})
export type RequirementDraft = Schema.Schema.Type<typeof RequirementDraft>

export const Verification = Schema.Union([
  Schema.Struct({ type: Schema.Literal("test"), target: Schema.String }),
  Schema.Struct({ type: Schema.Literal("script"), target: Schema.String }),
  Schema.Struct({ type: Schema.Literal("ast"), target: Schema.String }),
  Schema.Struct({ type: Schema.Literal("grep"), target: Schema.String }),
  Schema.Struct({ type: Schema.Literal("manual"), target: Schema.String }),
])
export type Verification = Schema.Schema.Type<typeof Verification>

export const FileChange = Schema.Struct({
  path: Schema.String,
  action: Schema.Literals(["create", "modify", "delete"]),
  description: Schema.String,
})
export type FileChange = Schema.Schema.Type<typeof FileChange>

export const Risk = Schema.Struct({
  description: Schema.String,
  severity: Schema.Literals(["high", "medium", "low"]),
  mitigation: Schema.String,
})
export type Risk = Schema.Schema.Type<typeof Risk>

export const InterfaceContract = Schema.Struct({
  name: Schema.String,
  file: Schema.String,
  description: Schema.String,
})
export type InterfaceContract = Schema.Schema.Type<typeof InterfaceContract>

export const ReuseModule = Schema.Struct({
  name: Schema.String,
  file: Schema.String,
  description: Schema.String,
})
export type ReuseModule = Schema.Schema.Type<typeof ReuseModule>

// ── req-agent ──

export const ReqAgentOutput = Schema.Struct({
  coreGoal: Schema.String,
  requirementDrafts: Schema.Array(RequirementDraft),
  constraints: Schema.Array(Schema.String),
  assumptions: Schema.Array(Schema.String),
  openQuestions: Schema.Array(Schema.String),
  domain: Schema.String,
})
export type ReqAgentOutput = Schema.Schema.Type<typeof ReqAgentOutput>

// ── arch-agent ──

export const ArchAgentOutput = Schema.Struct({
  projectType: Schema.String,
  techStack: Schema.Array(Schema.String),
  filesToModify: Schema.Array(FileChange),
  filesToCreate: Schema.Array(FileChange),
  modulesToReuse: Schema.Array(ReuseModule),
  interfaces: Schema.Array(InterfaceContract),
  dataFlow: Schema.Array(Schema.String),
  risks: Schema.Array(Risk),
  conventions: Schema.Array(Schema.String),
})
export type ArchAgentOutput = Schema.Schema.Type<typeof ArchAgentOutput>

// ── accept-agent ──

export const AcceptanceCriterion = Schema.Struct({
  requirementId: Schema.String,
  description: Schema.String,
  verification: Verification,
  fallback: Schema.optional(Verification),
  confidence: Schema.Literals(["high", "medium", "low"]),
  explanation: Schema.String,
})
export type AcceptanceCriterion = Schema.Schema.Type<typeof AcceptanceCriterion>

export const UnverifiableRequirement = Schema.Struct({
  requirementId: Schema.String,
  reason: Schema.String,
  suggestedAction: Schema.Literals(["manual", "clarify", "decompose"]),
})
export type UnverifiableRequirement = Schema.Schema.Type<typeof UnverifiableRequirement>

export const AcceptAgentOutput = Schema.Struct({
  criteria: Schema.Array(AcceptanceCriterion),
  unverifiableRequirements: Schema.Array(UnverifiableRequirement),
})
export type AcceptAgentOutput = Schema.Schema.Type<typeof AcceptAgentOutput>

// ── test-agent ──

export const TestResultItem = Schema.Struct({
  requirementId: Schema.String,
  verification: Verification,
  runnable: Schema.Boolean,
  actualOutput: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  suggestion: Schema.optional(Schema.String),
})
export type TestResultItem = Schema.Schema.Type<typeof TestResultItem>

export const TestAgentOutput = Schema.Struct({
  results: Schema.Array(TestResultItem),
})
export type TestAgentOutput = Schema.Schema.Type<typeof TestAgentOutput>

// ── review-agent ──

export const ReviewIssue = Schema.Struct({
  category: Schema.Literals([
    "completeness", "verifiability", "clarity", "security",
    "performance", "architecture", "consistency", "maintainability",
  ]),
  severity: Schema.Literals(["blocker", "warning", "suggestion"]),
  requirementId: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  description: Schema.String,
  fixSuggestion: Schema.String,
})
export type ReviewIssue = Schema.Schema.Type<typeof ReviewIssue>

export const ReviewReport = Schema.Struct({
  score: Schema.Number,
  verdict: Schema.Literals(["approve", "revise", "reject"]),
  issues: Schema.Array(ReviewIssue),
  strengths: Schema.Array(Schema.String),
  summary: Schema.String,
})
export type ReviewReport = Schema.Schema.Type<typeof ReviewReport>

// ── Pipeline config ──

export const SpecReviewConfig = Schema.Struct({
  requireSecurityCheck: Schema.optional(Schema.Boolean),
  requireErrorHandling: Schema.optional(Schema.Boolean),
  requireTestVerification: Schema.optional(Schema.Boolean),
  minVerificationCoverage: Schema.optional(Schema.Number),
  minScore: Schema.optional(Schema.Number),
  maxManualRatio: Schema.optional(Schema.Number),
})
export type SpecReviewConfig = Schema.Schema.Type<typeof SpecReviewConfig>
