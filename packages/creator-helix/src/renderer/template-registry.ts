export * as TemplateRegistry from "./template-registry"

import type { RendererTypes } from "./types"

export interface Template {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly tags: string[]
  readonly defaultCamera: {
    readonly position: RendererTypes.Vec3
    readonly target?: RendererTypes.Vec3
    readonly fov?: number
  }
  readonly defaultLighting: {
    readonly ambient?: { readonly intensity?: number; readonly color?: string }
    readonly main?: { readonly position?: RendererTypes.Vec3; readonly intensity?: number }
    readonly fill?: { readonly position?: RendererTypes.Vec3; readonly intensity?: number }
  }
  readonly defaultBackground: string
  readonly defaultPostProcessing: unknown
  readonly motionPresets: Record<string, unknown>
}

const establishingWide: Template = {
  id: "establishing-wide",
  name: "远景建立",
  description: "广角远景，适合大场景开场",
  tags: ["wide", "establishing", "panorama", "landscape", "opening"],
  defaultCamera: {
    position: [15, 6, 15],
    target: [0, 0, 0],
    fov: 50,
  },
  defaultLighting: {
    ambient: { intensity: 0.4, color: "#ffffff" },
    main: { position: [10, 15, 10], intensity: 1.5 },
    fill: { position: [-5, 5, -5], intensity: 0.5 },
  },
  defaultBackground: "#050510",
  defaultPostProcessing: { bloom: { enabled: true, intensity: 1.2 } },
  motionPresets: {
    "push-in": { cameraKeyframes: [{ time: 0, position: [15, 6, 15] }, { time: 1, position: [8, 4, 8] }] },
    orbit: { cameraKeyframes: [{ time: 0, position: [15, 6, 15] }, { time: 1, position: [-15, 6, 15] }] },
    static: { cameraKeyframes: [{ time: 0, position: [15, 6, 15] }] },
  },
}

const subjectApproach: Template = {
  id: "subject-approach",
  name: "主体接近",
  description: "中景推进，主体靠近镜头",
  tags: ["approach", "close", "zoom", "subject", "reveal"],
  defaultCamera: {
    position: [8, 3, 8],
    target: [0, 0, 0],
    fov: 45,
  },
  defaultLighting: {
    ambient: { intensity: 0.3, color: "#ffffff" },
    main: { position: [8, 8, 8], intensity: 2 },
    fill: { position: [-5, 3, -5], intensity: 0.6 },
  },
  defaultBackground: "#000000",
  defaultPostProcessing: { bloom: { enabled: true, intensity: 1 } },
  motionPresets: {
    "slow-rotation": { cameraKeyframes: [{ time: 0, position: [8, 3, 8] }, { time: 1, position: [-8, 3, -8] }] },
    approach: { cameraKeyframes: [{ time: 0, position: [10, 4, 10] }, { time: 1, position: [3, 1, 3] }] },
    static: { cameraKeyframes: [{ time: 0, position: [8, 3, 8] }] },
  },
}

const impactAction: Template = {
  id: "impact-action",
  name: "冲击动作",
  description: "动态追踪，高速动作",
  tags: ["impact", "collision", "speed", "action", "dynamic"],
  defaultCamera: {
    position: [8, 3, 8],
    target: [0, 0, 0],
    fov: 70,
  },
  defaultLighting: {
    ambient: { intensity: 0.3, color: "#ffffff" },
    main: { position: [10, 10, 10], intensity: 1.4 },
    fill: { position: [-5, 5, -5], intensity: 0.5 },
  },
  defaultBackground: "#050510",
  defaultPostProcessing: { bloom: { enabled: true, intensity: 1.5 } },
  motionPresets: {
    track: { cameraKeyframes: [{ time: 0, position: [8, 3, 8] }, { time: 1, position: [-8, 3, -8] }] },
    follow: { cameraKeyframes: [{ time: 0, position: [5, 1, 5] }, { time: 1, position: [-5, 1, -5] }] },
  },
}

const explosionBloom: Template = {
  id: "explosion-bloom",
  name: "爆炸扩散",
  description: "广角静止，爆炸/扩散效果",
  tags: ["explosion", "burst", "detonate", "epic", "wide"],
  defaultCamera: {
    position: [0, 15, 30],
    target: [0, 0, 0],
    fov: 80,
  },
  defaultLighting: {
    ambient: { intensity: 0.2, color: "#ffffff" },
    main: { position: [0, 20, 20], intensity: 2 },
    fill: { position: [0, 5, -10], intensity: 0.5 },
  },
  defaultBackground: "#000000",
  defaultPostProcessing: { bloom: { enabled: true, intensity: 2.5, threshold: 0.5 } },
  motionPresets: {
    static: { cameraKeyframes: [{ time: 0, position: [0, 15, 30] }] },
    "slow-push": { cameraKeyframes: [{ time: 0, position: [0, 15, 35] }, { time: 1, position: [0, 15, 25] }] },
  },
}

const revealPulback: Template = {
  id: "reveal-pulback",
  name: "揭示拉远",
  description: "拉远揭示全貌",
  tags: ["reveal", "aftermath", "pullback", "overview", "scale"],
  defaultCamera: {
    position: [3, 2, 3],
    target: [0, 0, 0],
    fov: 60,
  },
  defaultLighting: {
    ambient: { intensity: 0.25, color: "#ffffff" },
    main: { position: [5, 10, 5], intensity: 1.2 },
    fill: { position: [-3, 3, -3], intensity: 0.4 },
  },
  defaultBackground: "#080815",
  defaultPostProcessing: { bloom: { enabled: true, intensity: 1 }, vignette: { enabled: true, darkness: 0.4 } },
  motionPresets: {
    "pull-back": { cameraKeyframes: [{ time: 0, position: [3, 2, 3] }, { time: 1, position: [20, 10, 20] }] },
    orbit: { cameraKeyframes: [{ time: 0, position: [5, 3, 5] }, { time: 1, position: [-5, 3, 5] }] },
  },
}

const portraitCloseup: Template = {
  id: "portrait-closeup",
  name: "特写",
  description: "近景特写，细节展示",
  tags: ["portrait", "closeup", "detail", "macro", "intimate"],
  defaultCamera: {
    position: [4, 2, 5],
    target: [0, 1, 0],
    fov: 35,
  },
  defaultLighting: {
    ambient: { intensity: 0.35, color: "#ffffff" },
    main: { position: [5, 6, 5], intensity: 1.8 },
    fill: { position: [-3, 3, -2], intensity: 0.4 },
  },
  defaultBackground: "#0a0a12",
  defaultPostProcessing: { bloom: { enabled: true, intensity: 0.8 }, depthOfField: { enabled: true, focusDistance: 5 } },
  motionPresets: {
    static: { cameraKeyframes: [{ time: 0, position: [4, 2, 5] }] },
    "slow-push": { cameraKeyframes: [{ time: 0, position: [5, 2, 6] }, { time: 1, position: [3, 2, 4] }] },
  },
}

const templates: Record<string, Template> = {
  "establishing-wide": establishingWide,
  "subject-approach": subjectApproach,
  "impact-action": impactAction,
  "explosion-bloom": explosionBloom,
  "reveal-pulback": revealPulback,
  "portrait-closeup": portraitCloseup,
}

export const get = (id: string): Template | undefined => templates[id]

export const list = (): Template[] => Object.values(templates)

export const findByTags = (tags: string[]): Template[] =>
  list().filter((t) => tags.some((tag) => t.tags.includes(tag)))
