export * as V2Config from "./index"

import { Config } from "effect"

// ─── LLM Config ───

export const LlmModelId = Config.string("LONGCAT_MODEL").pipe(
  Config.withDefault("LongCat-2.0"),
)

export const LlmBaseUrl = Config.string("LONGCAT_BASE_URL").pipe(
  Config.withDefault("https://api.longcat.chat/openai"),
)

export const LlmApiKey = Config.redacted("LONGCAT_API_KEY")

export const LlmMaxTokens = Config.number("LONGCAT_MAX_TOKENS").pipe(
  Config.withDefault(4096),
)

// ─── SeedDance Config ───

export const SeedDanceModelId = Config.string("SEEDANCE_MODEL").pipe(
  Config.withDefault("doubao-seedance-2-0-mini-260615"),
)

export const SeedDanceBaseUrl = Config.string("SEEDANCE_API_BASE").pipe(
  Config.withDefault("https://ark.cn-beijing.volces.com/api/v3"),
)

export const SeedDanceApiKey = Config.redacted("SEEDANCE_API_KEY")

export const SeedDancePollInterval = Config.number("SEEDANCE_POLL_INTERVAL_MS").pipe(
  Config.withDefault(5000),
)

export const SeedDancePollMaxAttempts = Config.number("SEEDANCE_POLL_MAX_ATTEMPTS").pipe(
  Config.withDefault(72),
)

// ─── SeedDream Config ───

export const SeedDreamModelId = Config.string("SEEDREAM_MODEL").pipe(
  Config.withDefault("doubao-seedream-3-0-t2i-250815"),
)

export const SeedDreamApiKey = Config.redacted("SEEDREAM_API_KEY")

export const SeedDreamDefaultWidth = Config.number("SEEDREAM_DEFAULT_WIDTH").pipe(
  Config.withDefault(1024),
)

export const SeedDreamDefaultHeight = Config.number("SEEDREAM_DEFAULT_HEIGHT").pipe(
  Config.withDefault(1024),
)

// ─── TOS Config ───

export const TosAccessKey = Config.redacted("TOS_AK")

export const TosSecretKey = Config.redacted("TOS_SK")

export const TosBucket = Config.string("TOS_BUCKET").pipe(
  Config.withDefault("creator-helix-keyframes"),
)

export const TosRegion = Config.string("TOS_REGION").pipe(
  Config.withDefault("cn-beijing"),
)

export const TosEndpoint = Config.string("TOS_ENDPOINT").pipe(
  Config.withDefault("tos-cn-beijing.volces.com"),
)

// ─── Render Config ───

export const RenderWidth = Config.number("RENDER_WIDTH").pipe(
  Config.withDefault(1920),
)

export const RenderHeight = Config.number("RENDER_HEIGHT").pipe(
  Config.withDefault(1080),
)

export const RenderFps = Config.number("RENDER_FPS").pipe(
  Config.withDefault(24),
)

export const RenderDefaultDuration = Config.number("RENDER_DEFAULT_DURATION_SEC").pipe(
  Config.withDefault(6),
)

export const RenderDefaultRatio = Config.string("RENDER_DEFAULT_RATIO").pipe(
  Config.withDefault("16:9"),
)

// ─── Pipeline Config ───

export const PipelineMaxRetries = Config.number("PIPELINE_MAX_RETRIES").pipe(
  Config.withDefault(3),
)

export const PipelineConcurrency = Config.number("PIPELINE_CONCURRENCY").pipe(
  Config.withDefault(3),
)

// ─── Named Constants ───

export const CameraMotionThresholds = {
  zoomDistanceDelta: 3,
  orbitPositionSum: 3,
  orbitDistanceDelta: 5,
  trackPositionSum: 5,
  trackDistanceSum: 5,
} as const

export const DepthNormalization = {
  nearPlane: -100,
  farPlane: 100,
} as const

export const QualityTiers = {
  cinematic: "photorealistic, 8K, film grain, volumetric lighting, ray-traced reflections, high detail",
  moody: "atmospheric, cinematic color grading, soft shadows, shallow depth of field, film grain",
  minimal: "clean, sharp focus, natural lighting, subtle tones, high contrast",
  epic: "epic scale, dramatic lighting, 8K detail, volumetric fog, particle effects, anamorphic lens flare",
  chaotic: "dynamic motion blur, high contrast, dramatic lighting, gritty texture, intense color grading",
} as const

export type QualityTier = keyof typeof QualityTiers

// ─── Template Catalog (for LLM context) ───

export interface TemplateInfo {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly bestFor: ReadonlyArray<string>
  readonly mood: ReadonlyArray<string>
}

export const TemplateCatalog: ReadonlyArray<TemplateInfo> = [
  {
    id: "establishing-wide",
    name: "Establishing Wide",
    description: "Wide shot that establishes the scene, environment, or scale",
    bestFor: ["opening", "landscape", "cityscape", "battlefield", "space"],
    mood: ["epic", "grand", "contemplative", "lonely"],
  },
  {
    id: "subject-approach",
    name: "Subject Approach",
    description: "Camera moves toward a subject, revealing details progressively",
    bestFor: ["character reveal", "object focus", "discovery", "arrival"],
    mood: ["anticipation", "curiosity", "tension", "wonder"],
  },
  {
    id: "impact-action",
    name: "Impact & Action",
    description: "Dynamic tracking shot following fast movement or collision",
    bestFor: ["chase", "fight", "collision", "explosion", "speed"],
    mood: ["chaotic", "intense", "violent", "urgent"],
  },
  {
    id: "explosion-bloom",
    name: "Explosion & Bloom",
    description: "Static or slow-push shot capturing expansion, bloom, or diffusion",
    bestFor: ["explosion", "burst", "energy wave", "transformation", "bloom"],
    mood: ["chaotic", "awe", "destruction", "transcendent"],
  },
  {
    id: "reveal-pulback",
    name: "Reveal & Pullback",
    description: "Camera pulls back to reveal something previously hidden",
    bestFor: ["aftermath", "reveal", "twist", "overview", "consequence"],
    mood: ["ominous", "contemplative", "surreal", "epic"],
  },
  {
    id: "portrait-closeup",
    name: "Portrait Close-up",
    description: "Intimate close-up focusing on character expression or detail",
    bestFor: ["emotion", "dialogue", "detail", "portrait", "reaction"],
    mood: ["intimate", "tense", "vulnerable", "determined"],
  },
]
