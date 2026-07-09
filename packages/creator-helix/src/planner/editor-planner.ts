export * as EditorPlanner from "./editor-planner"

import { Effect, Schema } from "effect"
import { EditorAgent } from "../agent/editor"
import { LlmModel } from "../llm/model"
import { VideoProject } from "../schema/project"

const EditingPlanOutput = Schema.Struct({
  plan: VideoProject.EditingPlan,
}).annotate({ identifier: "CreatorHelix.EditingPlanOutput" })

const ruleBasedPlan = (project: VideoProject.Info): VideoProject.EditingPlan => {
  const style = project.context.requirement?.style ?? "cinematic"
  const duration = project.context.script?.totalDurationSeconds ?? 0
  return VideoProject.EditingPlan.make({
    transitions: "smooth cuts between shots",
    subtitleStyle: `${style}, clean lower-third`,
    musicPrompt: `${style} background music, ${duration}s`,
    pacing: "medium, matching narration",
  })
}

export const generateEditingPlan = (project: VideoProject.Info) =>
  Effect.gen(function* () {
    const output = (yield* LlmModel.generateObject({
      system: EditorAgent.SYSTEM_PROMPT,
      prompt: `Create an editing plan for this project.\nRequirement: ${JSON.stringify(project.context.requirement)}\nScript: ${JSON.stringify(project.context.script)}\nStoryboard shots: ${project.context.storyboard?.shots.length ?? 0}\n\nReturn a JSON object with a single key "plan" containing exactly these fields: transitions, subtitleStyle, musicPrompt, pacing.`,
      schema: EditingPlanOutput,
    }).pipe(Effect.catch(() => Effect.succeed({ plan: ruleBasedPlan(project) })))) as {
      plan: VideoProject.EditingPlan
    }

    return output.plan
  })
