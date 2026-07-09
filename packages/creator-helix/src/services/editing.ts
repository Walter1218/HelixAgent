export * as Editing from "./editing"

import { Effect } from "effect"
import { EditorPlanner } from "../planner/editor-planner"
import { VideoProject } from "../schema/project"

export const compose = (project: VideoProject.Info) =>
  Effect.gen(function* () {
    const editingPlan = yield* EditorPlanner.generateEditingPlan(project)
    const draftUrl = `https://creator-helix.mock/${project.id}/draft.mp4`
    return { draftUrl, editingPlan }
  })
