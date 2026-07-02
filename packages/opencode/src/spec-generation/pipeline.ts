import { Effect } from "effect"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { runReqAgent } from "./req-agent"
import { runArchAgent } from "./arch-agent"
import { runAcceptAgent } from "./accept-agent"
import { runTestAgent } from "./test-agent"
import { runMergeAgent } from "./merge-agent"
import { runReviewAgent } from "./review-agent"
import { runFixAgent } from "./fix-agent"
import type { SpecReviewConfig, ReviewReport, AcceptanceCriterion } from "./schema"

export interface PipelineInput {
  userPrompt: string
  sessionHistory?: string[]
  projectContext: {
    rootPath: string
    relevantFiles: string[]
    packageJson?: Record<string, unknown>
    memory?: string
  }
  config?: SpecReviewConfig
  maxFixIterations?: number
}

export interface PipelineResult {
  specMarkdown: string
  report: ReviewReport
}

const DEFAULT_CONFIG: SpecReviewConfig = {
  requireSecurityCheck: true,
  requireErrorHandling: true,
  requireTestVerification: true,
  minVerificationCoverage: 0.5,
  minScore: 70,
  maxManualRatio: 0.3,
}

export function runPipeline(
  model: LanguageModelV3,
  input: PipelineInput,
): Effect.Effect<PipelineResult, never, FSUtil.Service> {
  return Effect.gen(function* () {
    const config = input.config ?? DEFAULT_CONFIG
    const maxFixIterations = input.maxFixIterations ?? 2

    // Step 1: req-agent — decompose requirements
    const reqOutput = yield* runReqAgent(model, {
      userPrompt: input.userPrompt,
      sessionHistory: input.sessionHistory ?? [],
      projectMemory: input.projectContext.memory,
    }).pipe(Effect.catch(() => Effect.succeed(null)))

    if (!reqOutput) {
      return yield* Effect.die(new Error("req-agent failed"))
    }

    // Step 2: arch-agent — analyze architecture
    const archOutput = yield* runArchAgent(model, {
      reqOutput,
      projectContext: input.projectContext,
    }).pipe(Effect.catch(() => Effect.succeed(null)))

    if (!archOutput) {
      return yield* Effect.die(new Error("arch-agent failed"))
    }

    // Step 3: accept-agent — design acceptance criteria
    const acceptOutput = yield* runAcceptAgent(model, {
      reqOutput,
      archOutput,
    }).pipe(Effect.catch(() => Effect.succeed(null)))

    if (!acceptOutput) {
      return yield* Effect.die(new Error("accept-agent failed"))
    }

    // Step 4: test-agent — verify runnability of verifications
    const testOutput = yield* runTestAgent({
      criteria: acceptOutput.criteria,
      projectRoot: input.projectContext.rootPath,
    }).pipe(Effect.catch(() => Effect.succeed({ results: [] })))

    // Fix unrunnable criteria
    const verifiedCriteria = fixUnrunnableCriteria(acceptOutput.criteria, testOutput.results)

    // Step 5: merge-agent — combine into spec markdown
    const mergeOutput = yield* runMergeAgent(model, {
      reqOutput,
      archOutput,
      criteria: verifiedCriteria,
    }).pipe(Effect.catch(() => Effect.succeed(null)))

    if (!mergeOutput) {
      return yield* Effect.die(new Error("merge-agent failed"))
    }

    // Step 6: review-agent — quality review + fix loop
    let specMarkdown = mergeOutput.specMarkdown
    let report = yield* runReviewAgent(model, {
      specMarkdown,
      config,
    }).pipe(Effect.catch(() => Effect.succeed(null)))

    if (!report) {
      return yield* Effect.die(new Error("review-agent failed"))
    }

    for (let i = 0; i < maxFixIterations && report.verdict === "revise"; i++) {
      const fixOutput = yield* runFixAgent(model, {
        specMarkdown,
        issues: report.issues,
      }).pipe(Effect.catch(() => Effect.succeed(null)))

      if (!fixOutput) break
      specMarkdown = fixOutput.fixedSpecMarkdown

      report = yield* runReviewAgent(model, {
        specMarkdown,
        config,
      }).pipe(Effect.catch(() => Effect.succeed(null)))

      if (!report) break
    }

    return { specMarkdown, report } as PipelineResult
  })
}

function fixUnrunnableCriteria(
  criteria: readonly AcceptanceCriterion[],
  testResults: readonly { requirementId: string; runnable: boolean; suggestion?: string }[],
): AcceptanceCriterion[] {
  const unrunnable = new Map(testResults.filter((r) => !r.runnable).map((r) => [r.requirementId, r]))

  return criteria.map((c) => {
    const result = unrunnable.get(c.requirementId)
    if (!result) return c

    return {
      ...c,
      verification: { type: "manual" as const, target: result.suggestion ?? "Requires manual verification" },
      confidence: "low" as const,
      explanation: `Downgraded from ${(c.verification as { type: string }).type}: ${result.suggestion}`,
    }
  })
}
