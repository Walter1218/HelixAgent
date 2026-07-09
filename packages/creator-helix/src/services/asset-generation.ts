export * as AssetGeneration from "./asset-generation"

import { Effect } from "effect"
import { ControlSignalGenerator } from "../renderer/control-signal-generator"
import type { RendererTypes } from "../renderer"
import { StoryboardIntentPlanner } from "../planner/storyboard-intent-planner"
import { VideoProject } from "../schema/project"
import { SeedDanceClient } from "./seeddance-client"
import { HelixStructureAdapter } from "../renderer/helix-structure-adapter"

const defaultRenderBackend: ControlSignalGenerator.RenderBackend = {
  render: (sceneConfig, config) =>
    Effect.gen(function* () {
      return {
        shotId: "mock",
        prompt: `${sceneConfig.scene.width}x${sceneConfig.scene.height} mock render`,
        camera: sceneConfig.animation.cameraKeyframes.length > 0
          ? {
              fps: config.fps ?? 30,
              durationSeconds: sceneConfig.animation.duration,
              keyframes: sceneConfig.animation.cameraKeyframes,
            }
          : undefined,
      }
    }),
}

export const generateForProject = (
  project: VideoProject.Info,
  backend: ControlSignalGenerator.RenderBackend = defaultRenderBackend,
  baseOutputDir?: string,
) =>
  Effect.gen(function* () {
    const storyboard = project.context.storyboard
    const requirement = project.context.requirement
    if (!storyboard || !requirement) {
      return yield* Effect.fail(new Error("Missing storyboard or requirement"))
    }

    const storyboardIntent = yield* StoryboardIntentPlanner.plan(storyboard, requirement)

    const controlConfig: RendererTypes.ControlSignalConfig = {
      keyframes: true,
      camera: true,
      depth: false,
      mask: false,
      flow: false,
      normals: false,
      width: 1280,
      height: 720,
      fps: 30,
    }

    const assets: VideoProject.Asset[] = []
    for (const shot of storyboard.shots) {
      const shotIntent = storyboardIntent.shots[shot.sequence - 1]
      if (!shotIntent) {
        return yield* Effect.fail(new Error(`No shot intent for shot ${shot.id}`))
      }

      const sceneConfig = HelixStructureAdapter.toSceneConfig(shotIntent, controlConfig)
      const bundle = yield* ControlSignalGenerator.generateForShot(shotIntent, controlConfig, "")
      const prompt = ControlSignalGenerator.buildVideoPrompt(shotIntent, storyboardIntent.globalStyle, sceneConfig)

      const result = yield* SeedDanceClient.generateVideo({
        content: [{ type: "text" as const, text: prompt }],
        duration: shotIntent.durationSeconds,
        ratio: "16:9",
        generateAudio: false,
        watermark: false,
      })

      const asset = VideoProject.Asset.make({
        id: `asset-${shot.id}`,
        type: "video",
        url: result.videoUrl ?? "",
        shotId: shot.id,
        status: result.status === "succeeded" ? "done" : "failed",
        controlSignals: bundle,
      })
      assets.push(asset)
    }
    return assets
  })
