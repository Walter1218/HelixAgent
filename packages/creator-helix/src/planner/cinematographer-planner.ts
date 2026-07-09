export * as CinematographerPlanner from "./cinematographer-planner"

import { Effect, Schema } from "effect"
import { CinematographerAgent } from "../agent/cinematographer"
import { LlmModel } from "../llm/model"
import { VideoProject } from "../schema/project"

const RefinedShots = Schema.Struct({
  shots: Schema.Array(VideoProject.Shot),
}).annotate({ identifier: "CreatorHelix.RefinedShots" })

const ruleBasedRefine = (project: VideoProject.Info): VideoProject.Shot[] => {
  const shots = project.context.storyboard?.shots ?? []
  return shots.map((shot) =>
    VideoProject.Shot.make({
      ...shot,
      visualPrompt: `${shot.visualPrompt}, ${project.context.requirement?.style ?? "cinematic"}, high quality`,
      motionPrompt: shot.motionPrompt || "smooth camera movement",
    })
  )
}

const normalizeShots = (raw: unknown, fallback: VideoProject.Shot[]): VideoProject.Shot[] => {
  if (typeof raw !== "object" || raw === null) return fallback
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.shots)) {
    return obj.shots.map((shot) => VideoProject.Shot.make(shot as VideoProject.Shot))
  }
  const entries = Object.entries(obj).filter(([key]) => key.startsWith("shot-"))
  if (entries.length === 0) return fallback
  return entries.map(([id, shot]) =>
    VideoProject.Shot.make({
      ...(shot as object),
      id,
    } as VideoProject.Shot)
  )
}

export const refineShots = (project: VideoProject.Info) =>
  Effect.gen(function* () {
    const shots = project.context.storyboard?.shots ?? []
    if (shots.length === 0) return []

    const raw = yield* LlmModel.generateObject({
      system: CinematographerAgent.SYSTEM_PROMPT,
      prompt: `Refine visual and motion prompts for these shots. Requirement style: ${project.context.requirement?.style ?? "cinematic"}.\n\nInput shots:\n${JSON.stringify(shots, null, 2)}\n\nReturn a JSON object with a single key "shots" containing an array. Each array element must include exactly these fields: id, sequence, description, visualPrompt, motionPrompt, narration, durationSeconds.`,
      schema: RefinedShots,
      maxTokens: 4096,
    }).pipe(Effect.catch(() => Effect.succeed({ shots: ruleBasedRefine(project) })))

    return normalizeShots(raw, ruleBasedRefine(project))
  })
