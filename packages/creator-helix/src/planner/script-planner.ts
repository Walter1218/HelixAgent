export * as ScriptPlanner from "./script-planner"

import { Effect, Schema } from "effect"
import { ScriptwriterAgent } from "../agent/scriptwriter"
import { StoryboardArtistAgent } from "../agent/storyboard-artist"
import { LlmModel } from "../llm/model"
import { VideoProject } from "../schema/project"

export const ScriptOutput = Schema.Struct({
  title: Schema.String,
  summary: Schema.String,
  totalDurationSeconds: Schema.Number,
  narration: Schema.String,
}).annotate({ identifier: "CreatorHelix.ScriptOutput" })
export interface ScriptOutput extends Schema.Schema.Type<typeof ScriptOutput> {}

export const StoryboardOutput = Schema.Struct({
  shots: Schema.Array(Schema.Struct({
    sequence: Schema.Number,
    description: Schema.String,
    visualPrompt: Schema.String,
    motionPrompt: Schema.String,
    narration: Schema.String,
    durationSeconds: Schema.Number,
  })),
}).annotate({ identifier: "CreatorHelix.StoryboardOutput" })
export interface StoryboardOutput extends Schema.Schema.Type<typeof StoryboardOutput> {}

export const generateScript = (requirement: VideoProject.Requirement) =>
  Effect.gen(function* () {
    const output = (yield* LlmModel.generateObject({
      system: ScriptwriterAgent.SYSTEM_PROMPT,
      prompt: `Write a script for this video requirement:\n${JSON.stringify(requirement, null, 2)}\n\nReturn a JSON object with exactly these fields:\n- title: string (video title)\n- summary: string (one paragraph summary)\n- totalDurationSeconds: number (must equal requirement duration)\n- narration: string (the full narration text as a single string, NOT an array)\n\nIMPORTANT: narration MUST be a single string, not an array of objects.`,
      schema: ScriptOutput,
    })) as ScriptOutput

    return VideoProject.Script.make({
      title: output.title,
      summary: output.summary,
      totalDurationSeconds: output.totalDurationSeconds,
      narration: output.narration,
    })
  })

export const generateStoryboard = (script: VideoProject.Script, requirement: VideoProject.Requirement) =>
  Effect.gen(function* () {
    const output = (yield* LlmModel.generateObject({
      system: StoryboardArtistAgent.SYSTEM_PROMPT,
      prompt: `Create a storyboard for this script and requirement:\nScript: ${JSON.stringify(script)}\nRequirement: ${JSON.stringify(requirement)}\n\nReturn a JSON object with a single key "shots" containing an array. Each array element must include exactly these fields: sequence, description, visualPrompt, motionPrompt, narration, durationSeconds.`,
      schema: StoryboardOutput,
    })) as StoryboardOutput

    return VideoProject.Storyboard.make({
      shots: output.shots.map((shot, index) =>
        VideoProject.Shot.make({
          id: `shot-${index + 1}`,
          sequence: shot.sequence,
          description: shot.description,
          visualPrompt: shot.visualPrompt,
          motionPrompt: shot.motionPrompt,
          narration: shot.narration,
          durationSeconds: shot.durationSeconds,
        })
      ),
    })
  })
