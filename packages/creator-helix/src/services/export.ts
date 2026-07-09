export * as Export from "./export"

import { Effect } from "effect"
import { VideoProject } from "../schema/project"

export const render = (project: VideoProject.Info, draftUrl: string) =>
  Effect.gen(function* () {
    // TODO: replace with real final rendering / upload
    const finalUrl = `https://creator-helix.mock/${project.id}/final.mp4`
    return finalUrl
  })
