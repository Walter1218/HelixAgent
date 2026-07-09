export * as StoryboardIntentPlanner from "./storyboard-intent-planner"

import { Effect } from "effect"
import type { RendererTypes } from "../renderer"
import { TemplateRegistry } from "../renderer/template-registry"
import type { VideoProject } from "../schema/project"

const selectTemplateAndMotion = (
  shot: VideoProject.Shot,
): { templateId: string; motion: string } => {
  const text = `${shot.description} ${shot.visualPrompt} ${shot.motionPrompt}`.toLowerCase()

  if (text.includes("reveal") || text.includes("aftermath") || text.includes("pull back") || text.includes("overview")) {
    return { templateId: "reveal-pulback", motion: "pull-back" }
  }
  if (text.includes("explosion") || text.includes("burst") || text.includes("detonate") || text.includes("blast")) {
    return { templateId: "explosion-bloom", motion: "static" }
  }
  if (text.includes("impact") || text.includes("collision") || text.includes("speed") || text.includes("chase")) {
    return { templateId: "impact-action", motion: "track" }
  }
  if (text.includes("approach") || text.includes("close") || text.includes("zoom in") || text.includes("push in")) {
    return { templateId: "subject-approach", motion: text.includes("rotate") ? "slow-rotation" : "approach" }
  }
  if (text.includes("detail") || text.includes("close-up") || text.includes("portrait") || text.includes("macro")) {
    return { templateId: "portrait-closeup", motion: "static" }
  }
  if (text.includes("wide") || text.includes("establish") || text.includes("panorama") || text.includes("orbit")) {
    return { templateId: "establishing-wide", motion: text.includes("orbit") ? "orbit" : "push-in" }
  }

  return { templateId: "establishing-wide", motion: "push-in" }
}

const deriveMood = (requirement: VideoProject.Requirement, shot: VideoProject.Shot): string => {
  const text = `${requirement.style} ${shot.description} ${shot.visualPrompt}`.toLowerCase()
  if (text.includes("epic")) return "epic"
  if (text.includes("ominous") || text.includes("tense")) return "ominous"
  if (text.includes("chaotic") || text.includes("violent")) return "chaotic"
  if (text.includes("minimal") || text.includes("calm")) return "minimal"
  return "cinematic"
}

export const plan = (
  storyboard: VideoProject.Storyboard,
  requirement: VideoProject.Requirement,
): Effect.Effect<RendererTypes.StoryboardIntent, never> =>
  Effect.gen(function* () {
    const shots = storyboard.shots.map((shot) => {
      const { templateId, motion } = selectTemplateAndMotion(shot)
      const template = TemplateRegistry.get(templateId)

      const subjectText = shot.visualPrompt
        ? `${shot.description}. Visual: ${shot.visualPrompt}`
        : shot.description

      return {
        templateId,
        subject: subjectText,
        mood: deriveMood(requirement, shot),
        motion,
        durationSeconds: shot.durationSeconds,
        narration: shot.narration,
      } as RendererTypes.ShotIntent
    })

    const globalStyle: RendererTypes.GlobalStyle = {
      colorPalette: requirement.style.includes("cold") || requirement.style.includes("blue") ? "cool-blue-silver" : "warm-amber-grey",
      lighting: requirement.style.includes("dramatic") ? "high-contrast-key-light" : "motivated-space-lighting",
      postProcessing: "cinematic-bloom-vignette",
    }

    return { shots, globalStyle }
  })
