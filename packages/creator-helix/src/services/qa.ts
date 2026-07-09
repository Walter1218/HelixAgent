export * as Qa from "./qa"

import { Effect } from "effect"
import { QaPlanner } from "../planner/qa-planner"
import { VideoProject } from "../schema/project"

export const reviewAssets = (project: VideoProject.Info) =>
  Effect.gen(function* () {
    const result = yield* QaPlanner.reviewAssets(project)
    return result
  })
