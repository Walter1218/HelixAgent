export * as QaPlanner from "./qa-planner"

import { Effect, Schema } from "effect"
import { QaAgent } from "../agent/qa"
import { LlmModel } from "../llm/model"
import { VideoProject } from "../schema/project"

const ReviewOutput = Schema.Struct({
  passed: Schema.Boolean,
  reason: Schema.optional(Schema.String),
  failedAssetId: Schema.optional(Schema.String),
}).annotate({ identifier: "CreatorHelix.QaReviewOutput" })

const ruleBasedReview = (assets: VideoProject.Asset[]) => {
  const failed = assets.find((a) => a.status === "failed")
  if (failed) {
    return { passed: false as const, reason: "mock review failed", failedAssetId: failed.id }
  }
  const allDone = assets.length > 0 && assets.every((a) => a.status === "done")
  if (!allDone) {
    return { passed: false as const, reason: "assets not ready", failedAssetId: undefined }
  }
  return { passed: true as const, reason: undefined, failedAssetId: undefined }
}

export const reviewAssets = (project: VideoProject.Info) =>
  Effect.gen(function* () {
    const assets = Array.from(project.context.assets)
    if (assets.length === 0) {
      return { passed: false as const, reason: "no assets", failedAssetId: undefined }
    }

    const output = (yield* LlmModel.generateObject({
      system: QaAgent.SYSTEM_PROMPT,
      prompt: `Review these generated asset records for consistency with the project.\nRequirement: ${JSON.stringify(project.context.requirement)}\nAssets: ${JSON.stringify(assets, null, 2)}\n\nReturn a JSON object with exactly these fields: passed (boolean), reason (optional string), failedAssetId (optional string).`,
      schema: ReviewOutput,
    }).pipe(Effect.catch(() => Effect.succeed(ruleBasedReview(assets))))) as {
      passed: boolean
      reason?: string
      failedAssetId?: string
    }

    return {
      passed: output.passed,
      reason: output.reason,
      failedAssetId: output.failedAssetId,
    }
  })
