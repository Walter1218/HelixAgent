export * as HelixStructureAdapter from "./helix-structure-adapter"

import type { RendererTypes } from "./types"
import { TemplateRegistry } from "./template-registry"

export interface SceneConfig {
  readonly scene: {
    readonly width: number
    readonly height: number
    readonly depth: number
    readonly background: string
    readonly showGrid: boolean
    readonly showAxes: boolean
    readonly camera: {
      readonly position: RendererTypes.Vec3
      readonly fov: number
      readonly target?: RendererTypes.Vec3
    }
    readonly lighting?: {
      readonly ambient?: { readonly intensity?: number; readonly color?: string }
      readonly main?: { readonly position?: RendererTypes.Vec3; readonly intensity?: number }
      readonly fill?: { readonly position?: RendererTypes.Vec3; readonly intensity?: number }
    }
  }
  readonly elements: readonly SceneElement[]
  readonly animation: {
    readonly duration: number
    readonly fps: number
    readonly loop: boolean
    readonly keyframes: readonly Keyframe[]
    readonly cameraKeyframes: readonly CameraKeyframe[]
    readonly paths: readonly unknown[]
  }
  readonly postProcessing?: unknown
  readonly output?: {
    readonly width: number
    readonly height: number
    readonly format: "webm" | "mp4" | "gif" | "png-sequence"
    readonly fps: number
  }
}

export interface SceneElement {
  readonly id: string
  readonly shape: string
  readonly color: string
  readonly position: RendererTypes.Vec3
  readonly rotation?: RendererTypes.Vec3
  readonly scale?: RendererTypes.Vec3
  readonly size?: number
  readonly opacity?: number
  readonly material?: {
    readonly type?: "standard" | "physical" | "toon" | "basic"
    readonly metalness?: number
    readonly roughness?: number
  }
}

export interface Keyframe {
  readonly time: number
  readonly elements: readonly { readonly id: string; readonly position?: RendererTypes.Vec3; readonly rotation?: RendererTypes.Vec3; readonly scale?: RendererTypes.Vec3 }[]
}

export interface CameraKeyframe {
  readonly time: number
  readonly position?: RendererTypes.Vec3
  readonly target?: RendererTypes.Vec3
  readonly fov?: number
}

const motionToCameraKeyframes = (
  template: TemplateRegistry.Template,
  motion: string,
  durationSeconds: number,
): CameraKeyframe[] => {
  const preset = template.motionPresets[motion] ?? template.motionPresets["static"]
  const frames = (preset as { cameraKeyframes: { time: number; position: RendererTypes.Vec3 }[] }).cameraKeyframes
  return frames.map((kf) => ({
    time: kf.time * durationSeconds,
    position: kf.position,
    target: template.defaultCamera.target,
    fov: template.defaultCamera.fov,
  }))
}

export const toSceneConfig = (
  shotIntent: RendererTypes.ShotIntent,
  controlConfig: RendererTypes.ControlSignalConfig,
): SceneConfig => {
  const template = TemplateRegistry.get(shotIntent.templateId)
  if (!template) {
    throw new Error(`Template not found: ${shotIntent.templateId}`)
  }

  const width = controlConfig.width ?? 1280
  const height = controlConfig.height ?? 720
  const fps = controlConfig.fps ?? 30
  const subjectElements = buildSubjectElements(shotIntent)

  return {
    scene: {
      width,
      height,
      depth: Math.max(width, height),
      background: template.defaultBackground,
      showGrid: false,
      showAxes: false,
      camera: {
        position: template.defaultCamera.position,
        fov: template.defaultCamera.fov ?? 60,
        target: template.defaultCamera.target,
      },
      lighting: template.defaultLighting,
    },
    elements: subjectElements,
    animation: {
      duration: shotIntent.durationSeconds,
      fps,
      loop: false,
      keyframes: [],
      cameraKeyframes: motionToCameraKeyframes(template, shotIntent.motion, shotIntent.durationSeconds),
      paths: [],
    },
    postProcessing: template.defaultPostProcessing,
    output: {
      width,
      height,
      format: "png-sequence",
      fps,
    },
  }
}

const buildSubjectElements = (shotIntent: RendererTypes.ShotIntent): SceneElement[] => {
  switch (shotIntent.templateId) {
    case "establishing-wide":
      return [
        { id: "main-structure", shape: "box", color: "#6688aa", position: [0, 0, 0], scale: [12, 3, 6], material: { type: "physical", metalness: 0.7, roughness: 0.3 } },
        { id: "secondary-1", shape: "box", color: "#557799", position: [-10, 0, -3], scale: [6, 2, 3], material: { type: "physical", metalness: 0.7, roughness: 0.3 } },
        { id: "secondary-2", shape: "box", color: "#557799", position: [10, 0, -3], scale: [6, 2, 3], material: { type: "physical", metalness: 0.7, roughness: 0.3 } },
        { id: "background-element", shape: "sphere", color: "#cc8855", position: [0, -15, -30], scale: [25, 25, 25], material: { type: "standard", roughness: 0.9 } },
      ]
    case "subject-approach":
      return [
        { id: "main-subject", shape: "sphere", color: "#eeeeee", position: [0, 0, 0], scale: [3, 4, 3], material: { type: "physical", metalness: 1, roughness: 0.05 } },
        { id: "light-source", shape: "sphere", color: "#ffffff", position: [8, 4, -8], scale: [1, 1, 1], material: { type: "basic" } },
      ]
    case "impact-action":
      return [
        { id: "projectile", shape: "sphere", color: "#eeeeee", position: [-4, 0, 0], scale: [2, 2.5, 2], material: { type: "physical", metalness: 1, roughness: 0.05 } },
        { id: "target", shape: "box", color: "#778899", position: [4, 0, 0], scale: [10, 3, 3], material: { type: "physical", metalness: 0.6, roughness: 0.4 } },
      ]
    case "explosion-bloom":
      return [
        { id: "blast-core", shape: "sphere", color: "#ffaa44", position: [0, 0, 0], scale: [8, 8, 8], material: { type: "basic" } },
        { id: "fragment-1", shape: "box", color: "#667788", position: [-12, 3, -8], scale: [5, 2, 2.5], material: { type: "physical", metalness: 0.6, roughness: 0.4 } },
        { id: "fragment-2", shape: "box", color: "#667788", position: [12, -3, 8], scale: [5, 2, 2.5], material: { type: "physical", metalness: 0.6, roughness: 0.4 } },
      ]
    case "reveal-pulback":
      return [
        { id: "center-subject", shape: "sphere", color: "#eeeeee", position: [0, 0, 0], scale: [2, 2.5, 2], material: { type: "physical", metalness: 1, roughness: 0.05 } },
        { id: "debris-1", shape: "box", color: "#555566", position: [6, 3, 4], scale: [2, 0.5, 1.5], material: { type: "standard", roughness: 0.8 } },
        { id: "debris-2", shape: "box", color: "#555566", position: [-5, -2, -6], scale: [1.5, 0.6, 2], material: { type: "standard", roughness: 0.8 } },
        { id: "debris-3", shape: "box", color: "#555566", position: [3, -4, 3], scale: [2, 0.4, 1], material: { type: "standard", roughness: 0.8 } },
      ]
    case "portrait-closeup":
      return [
        { id: "main-subject", shape: "sphere", color: "#dddddd", position: [0, 0, 0], scale: [3, 3, 3], material: { type: "physical", metalness: 0.3, roughness: 0.6 } },
        { id: "bg-bokeh", shape: "sphere", color: "#334455", position: [0, 5, -10], scale: [15, 15, 15], material: { type: "basic" } },
      ]
    default:
      return [{ id: "subject", shape: "sphere", color: "#888888", position: [0, 0, 0], scale: [2, 2, 2] }]
  }
}
