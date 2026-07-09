import { describe, it, expect } from "bun:test"
import { Effect, ConfigProvider } from "effect"
import {
  LlmModelId,
  LlmBaseUrl,
  LlmMaxTokens,
  SeedDanceModelId,
  RenderWidth,
  QualityTiers,
  TemplateCatalog,
  CameraMotionThresholds,
  DepthNormalization,
} from "../config"

describe("V2 Config", () => {
  const envMap = new Map([
    ["LONGCAT_MODEL", "TestModel"],
    ["LONGCAT_BASE_URL", "https://test.example.com"],
    ["LONGCAT_MAX_TOKENS", "8192"],
    ["SEEDANCE_MODEL", "test-seedance"],
    ["RENDER_WIDTH", "2560"],
    ["RENDER_HEIGHT", "1440"],
  ])

  const testProvider = ConfigProvider.make((path) => {
    const key = Array.isArray(path) ? path.join(".") : String(path)
    const value = envMap.get(key)
    return Effect.succeed(value !== undefined ? ConfigProvider.makeValue(value) : undefined)
  })

  const emptyProvider = ConfigProvider.make((_path) => Effect.succeed(undefined))

  it("uses default when env not set", async () => {
    const result = await Effect.runPromise(
      LlmModelId.pipe(Effect.provide(ConfigProvider.layer(emptyProvider))),
    )
    expect(result).toBe("LongCat-2.0")
  })

  it("uses default for integer config when env not set", async () => {
    const result = await Effect.runPromise(
      LlmMaxTokens.pipe(Effect.provide(ConfigProvider.layer(emptyProvider))),
    )
    expect(result).toBe(4096)
  })

  it("has SeedDance model default", async () => {
    const result = await Effect.runPromise(
      SeedDanceModelId.pipe(Effect.provide(ConfigProvider.layer(emptyProvider))),
    )
    expect(result).toBe("doubao-seedance-2-0-mini-260615")
  })

  it("has render resolution defaults", async () => {
    const w = await Effect.runPromise(RenderWidth.pipe(Effect.provide(ConfigProvider.layer(emptyProvider))))
    expect(w).toBe(1920)
  })

  it("has quality tiers for all moods", () => {
    expect(QualityTiers.cinematic).toContain("8K")
    expect(QualityTiers.moody).toContain("atmospheric")
    expect(QualityTiers.epic).toContain("epic scale")
    expect(QualityTiers.chaotic).toContain("motion blur")
    expect(QualityTiers.minimal).toContain("clean")
  })

  it("has template catalog with all 6 templates", () => {
    expect(TemplateCatalog.length).toBe(6)
    const ids = TemplateCatalog.map(t => t.id)
    expect(ids).toContain("establishing-wide")
    expect(ids).toContain("subject-approach")
    expect(ids).toContain("impact-action")
    expect(ids).toContain("explosion-bloom")
    expect(ids).toContain("reveal-pulback")
    expect(ids).toContain("portrait-closeup")
  })

  it("templates have bestFor and mood arrays", () => {
    for (const t of TemplateCatalog) {
      expect(t.bestFor.length).toBeGreaterThan(0)
      expect(t.mood.length).toBeGreaterThan(0)
    }
  })

  it("has named camera thresholds", () => {
    expect(CameraMotionThresholds.zoomDistanceDelta).toBe(3)
    expect(CameraMotionThresholds.orbitPositionSum).toBe(3)
  })

  it("has depth normalization constants", () => {
    expect(DepthNormalization.nearPlane).toBe(-100)
    expect(DepthNormalization.farPlane).toBe(100)
  })
})
