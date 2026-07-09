export * as ControlSignalGenerator from "./control-signal-generator"

import { Effect, FileSystem, Path, Scope } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process"
import type { RendererTypes } from "./types"
import { HelixStructureAdapter } from "./helix-structure-adapter"

export interface RenderBackend {
  readonly render: (
    sceneConfig: HelixStructureAdapter.SceneConfig,
    config: RendererTypes.ControlSignalConfig,
  ) => Effect.Effect<RendererTypes.ControlSignalBundle, Error, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Scope.Scope>
}

export const generateForShot = (
  shotIntent: RendererTypes.ShotIntent,
  controlConfig: RendererTypes.ControlSignalConfig,
  prompt: string,
) =>
  Effect.gen(function* () {
    const sceneConfig = HelixStructureAdapter.toSceneConfig(shotIntent, controlConfig)

    // TODO: plug in real headless renderer or HelixStructure CLI
    const bundle: RendererTypes.ControlSignalBundle = {
      shotId: `shot-${shotIntent.templateId}`,
      prompt,
      camera: sceneConfig.animation.cameraKeyframes.length > 0
        ? {
            fps: controlConfig.fps ?? 30,
            durationSeconds: shotIntent.durationSeconds,
            keyframes: sceneConfig.animation.cameraKeyframes,
          }
        : undefined,
    }

    return bundle
  })

export const buildVideoPrompt = (
  shotIntent: RendererTypes.ShotIntent,
  globalStyle: RendererTypes.GlobalStyle,
  sceneConfig: HelixStructureAdapter.SceneConfig,
): string => {
  const cameraDesc = sceneConfig.animation.cameraKeyframes.length > 0
    ? describeCameraMotion(sceneConfig.animation.cameraKeyframes, sceneConfig.animation.duration)
    : ""
  const moodKeywords = moodToKeywords(shotIntent.mood)
  const lightingDesc = describeLighting(sceneConfig.scene.lighting)
  const sceneStructure = elementCountToStructure(sceneConfig.elements.length)

  return [
    `Cinematic film shot, ${sceneConfig.animation.duration} seconds long.`,
    `${shotIntent.subject}.`,
    shotIntent.narration ? `Context: ${shotIntent.narration}` : "",
    `Scene composition: ${sceneStructure}.`,
    cameraDesc,
    lightingDesc ? `Lighting: ${lightingDesc}, ${globalStyle.lighting}.` : `Lighting: ${globalStyle.lighting}.`,
    `Mood: ${moodKeywords}.`,
    `Color palette: ${globalStyle.colorPalette}.`,
    `Post-processing: ${globalStyle.postProcessing}.`,
    `Quality: photorealistic, 8K, film grain, volumetric lighting, high detail.`,
  ].filter(Boolean).join(" ")
}

function describeCameraMotion(keyframes: readonly HelixStructureAdapter.CameraKeyframe[], duration: number): string {
  if (keyframes.length < 2) return "Static camera."
  const start = keyframes[0].position!
  const end = keyframes[keyframes.length - 1].position!
  const [sx, sy, sz] = start
  const [ex, ey, ez] = end
  if (ez < sz && Math.abs(ex - sx) < 3) return `Camera slowly pushes in over ${duration}s, revealing more detail.`
  if (Math.abs(ex + sx) < 3 && Math.abs(ez - sz) > 5) return `Camera orbits around the scene in a sweeping arc over ${duration}s.`
  if (ez > sz && ey > sy) return `Camera pulls back and rises over ${duration}s, revealing the full scale of the scene.`
  if (Math.abs(ex + sx) < 5 && Math.abs(ez + sz) < 5) return `Camera tracks laterally, following the action across the frame over ${duration}s.`
  return `Camera moves fluidly through the scene over ${duration}s.`
}

function moodToKeywords(mood: string): string {
  const map: Record<string, string> = {
    epic: "epic scale, grand composition, awe-inspiring",
    ominous: "foreboding atmosphere, dark shadows, tension",
    chaotic: "chaotic energy, explosive motion, intense action",
    minimal: "minimalist composition, clean lines, stark contrast",
  }
  return map[mood] ?? "cinematic mood, dramatic lighting"
}

function describeLighting(lighting?: HelixStructureAdapter.SceneConfig["scene"]["lighting"]): string {
  if (!lighting) return ""
  const parts: string[] = []
  if (lighting.ambient) parts.push(`ambient fill at ${Math.round(lighting.ambient.intensity! * 100)}% intensity`)
  if (lighting.main) parts.push(`key light from above at ${Math.round(lighting.main.intensity! * 100)}% intensity`)
  if (lighting.fill) parts.push(`subtle rim/fill light for separation`)
  return parts.join(", ")
}

function elementCountToStructure(count: number): string {
  if (count <= 1) return "single subject centered in frame"
  if (count <= 3) return "two main subjects in dynamic composition"
  return "multiple elements spread across the scene"
}
