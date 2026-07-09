export * as LlmDecisions from "./decisions"

import { Effect, Schema } from "effect"
import { LongCat } from "../../llm/longcat"
import { TemplateCatalog, LlmModelId, LlmBaseUrl, LlmApiKey, LlmMaxTokens } from "../config"

// ─── Output Schema ───

const ShotDecisionSchema = Schema.Struct({
  templateId: Schema.String,
  motion: Schema.String,
  mood: Schema.String,
  colorPalette: Schema.Array(Schema.String),
  lighting: Schema.String,
  postProcessing: Schema.Array(Schema.String),
  qualityTier: Schema.String,
  reasoning: Schema.String,
})

export type ShotDecision = Schema.Schema.Type<typeof ShotDecisionSchema>

const GlobalStyleDecisionSchema = Schema.Struct({
  colorPalette: Schema.Array(Schema.String),
  lighting: Schema.String,
  postProcessing: Schema.Array(Schema.String),
  moodKeywords: Schema.Array(Schema.String),
  qualityTier: Schema.String,
  reasoning: Schema.String,
})

export type GlobalStyleDecision = Schema.Schema.Type<typeof GlobalStyleDecisionSchema>

// ─── Context Types ───

export interface ShotContext {
  readonly description: string
  readonly visualPrompt?: string
  readonly motionPrompt?: string
  readonly narration?: string
  readonly sequenceContext: string
  readonly charactersPresent: ReadonlyArray<string>
}

export interface GlobalStyleContext {
  readonly requirementStyle: string
  readonly genre?: string
  readonly era?: string
  readonly overallMood?: string
  readonly scriptSummary?: string
}

// ─── Template Catalog Prompt ───

const buildTemplateCatalogPrompt = (): string => {
  const entries = TemplateCatalog.map(
    (t) => `- **${t.id}**: ${t.name} — ${t.description}\n  Best for: ${t.bestFor.join(", ")}\n  Mood: ${t.mood.join(", ")}`,
  )
  return entries.join("\n")
}

// ─── Shot-level Decision ───

export const decideShot = (ctx: ShotContext): Effect.Effect<ShotDecision, Error> =>
  Effect.gen(function* () {
    const apiKey = yield* LlmApiKey
    const model = yield* LlmModelId
    const baseURL = yield* LlmBaseUrl
    const maxTokens = yield* LlmMaxTokens

    const system = `You are a cinematic director AI. Your job is to make creative decisions for individual video shots.

For each shot, you must choose:
1. **templateId**: Which shot template to use (from the catalog below)
2. **motion**: Camera motion type (push-in, pull-back, track, orbit, pan, tilt, dolly, static, slow-rotation)
3. **mood**: The emotional tone of this shot (e.g., epic, ominous, intimate, chaotic, contemplative, tense)
4. **colorPalette**: 2-4 hex colors that define this shot's palette
5. **lighting**: Lighting style description (e.g., "high-contrast key light", "soft ambient", "neon rim lighting")
6. **postProcessing**: Array of post-processing effects (e.g., ["bloom", "vignette", "chromatic aberration"])
7. **qualityTier**: One of: cinematic, moody, minimal, epic, chaotic
8. **reasoning**: Brief explanation of your choices

## Template Catalog
${buildTemplateCatalogPrompt()}

## Rules
- Match the template to the shot's narrative purpose
- Consider the sequence context for continuity
- Mood should flow from the surrounding shots
- Color palette should reflect the emotional tone
- Be specific and creative — avoid generic choices`

    const prompt = `Make creative decisions for this shot:

**Shot Description**: ${ctx.description}
${ctx.visualPrompt ? `**Visual Prompt**: ${ctx.visualPrompt}` : ""}
${ctx.motionPrompt ? `**Motion Prompt**: ${ctx.motionPrompt}` : ""}
${ctx.narration ? `**Narration**: ${ctx.narration}` : ""}
**Sequence Context**: ${ctx.sequenceContext}
**Characters Present**: ${ctx.charactersPresent.join(", ") || "none"}`

    return yield* LongCat.generateObject({
      apiKey,
      baseURL,
      model,
      system,
      prompt,
      schema: ShotDecisionSchema,
      maxTokens: Math.min(maxTokens, 2048),
    }).pipe(Effect.map((d) => d as ShotDecision))
  })

// ─── Global Style Decision ───

export const decideGlobalStyle = (ctx: GlobalStyleContext): Effect.Effect<GlobalStyleDecision, Error> =>
  Effect.gen(function* () {
    const apiKey = yield* LlmApiKey
    const model = yield* LlmModelId
    const baseURL = yield* LlmBaseUrl
    const maxTokens = yield* LlmMaxTokens

    const system = `You are a cinematic art director AI. Your job is to define the overall visual style for a video project.

You must choose:
1. **colorPalette**: 3-5 hex colors defining the project's overall palette
2. **lighting**: Overall lighting philosophy (e.g., "high-contrast dramatic", "soft natural", "neon-noir")
3. **postProcessing**: Array of post-processing effects applied globally
4. **moodKeywords**: 3-5 keywords capturing the emotional tone
5. **qualityTier**: One of: cinematic, moody, minimal, epic, chaotic
6. **reasoning**: Brief explanation

## Rules
- Consider the genre, era, and overall narrative mood
- Palette should be cohesive across all shots
- Lighting should support the narrative tone
- Be bold and specific — avoid generic "cinematic" choices`

    const prompt = `Define the overall visual style for this project:

**Style Requirement**: ${ctx.requirementStyle}
${ctx.genre ? `**Genre**: ${ctx.genre}` : ""}
${ctx.era ? `**Era**: ${ctx.era}` : ""}
${ctx.overallMood ? `**Overall Mood**: ${ctx.overallMood}` : ""}
${ctx.scriptSummary ? `**Script Summary**: ${ctx.scriptSummary}` : ""}`

    return yield* LongCat.generateObject({
      apiKey,
      baseURL,
      model,
      system,
      prompt,
      schema: GlobalStyleDecisionSchema,
      maxTokens: Math.min(maxTokens, 2048),
    }).pipe(Effect.map((d) => d as GlobalStyleDecision))
  })

// ─── Batch Shot Decisions (for efficiency) ───

const BatchShotDecisionSchema = Schema.Struct({
  decisions: Schema.Array(ShotDecisionSchema),
})

export const decideShotBatch = (
  shots: ReadonlyArray<ShotContext>,
): Effect.Effect<ShotDecision[], Error> =>
  Effect.gen(function* () {
    const apiKey = yield* LlmApiKey
    const model = yield* LlmModelId
    const baseURL = yield* LlmBaseUrl
    const maxTokens = yield* LlmMaxTokens

    const system = `You are a cinematic director AI. Make creative decisions for ALL shots in a sequence at once.
Ensure visual continuity between adjacent shots while maintaining narrative progression.

For each shot, provide:
1. **templateId**: From the catalog below
2. **motion**: Camera motion type
3. **mood**: Emotional tone
4. **colorPalette**: 2-4 hex colors
5. **lighting**: Lighting style
6. **postProcessing**: Array of effects
7. **qualityTier**: cinematic, moody, minimal, epic, or chaotic
8. **reasoning**: Brief explanation

## Template Catalog
${buildTemplateCatalogPrompt()}

## Continuity Rules
- Adjacent shots should have related color palettes
- Mood should progress naturally through the sequence
- Avoid jarring template transitions unless intentional
- First shot should establish, last shot should resolve`

    const shotsDesc = shots.map((s, i) =>
      `**Shot ${i + 1}**: ${s.description}${s.visualPrompt ? `\n  Visual: ${s.visualPrompt}` : ""}${s.narration ? `\n  Narration: ${s.narration}` : ""}`
    ).join("\n\n")

    const prompt = `Make creative decisions for all ${shots.length} shots in this sequence:

${shotsDesc}

**Sequence Context**: ${shots[0]?.sequenceContext ?? "N/A"}
**Characters Present**: ${[...new Set(shots.flatMap(s => s.charactersPresent))].join(", ") || "none"}

Return a JSON object with a "decisions" array, one entry per shot, in order.`

    return yield* LongCat.generateObject({
      apiKey,
      baseURL,
      model,
      system,
      prompt,
      schema: BatchShotDecisionSchema,
      maxTokens: maxTokens,
    }).pipe(Effect.map((d) => (d as { decisions: ShotDecision[] }).decisions))
  })
