import { describe, it, expect } from "bun:test"
import { Effect } from "effect"
import { buildShotPrompt } from "../prompt/builder"
import type { Studio } from "../../studio/schema/studio"
import type { Shot } from "../../project/schema/shot"
import type { ShotDecision } from "../llm/decisions"

const sampleImage = (id: string) => ({
  url: `https://example.com/${id}.png`,
  width: 1024,
  height: 1024,
})

const mockStudio: Studio = {
  id: "studio_001",
  name: "Test",
  characters: [
    {
      id: "char_001",
      baseIdentity: { name: "李毅", gender: "male", race: "人类", distinguishingMarks: ["疤痕"] },
      stateTimeline: [
        {
          stateId: "liyi_default",
          era: "现代",
          ageRange: [30, 35],
          appearance: { face: "方正", hair: "黑色短发", eyes: "深棕色", skin: "黄皮肤", bodyType: "健壮", typicalOutfit: "军装" },
          portrait: sampleImage("liyi"),
          personalityShift: "",
          relations: [],
        },
      ],
      expressionSheet: {
        neutral: sampleImage("n"), angry: sampleImage("a"), sad: sampleImage("s"),
        surprised: sampleImage("su"), happy: sampleImage("h"), determined: sampleImage("d"), fearful: sampleImage("f"),
      },
    },
  ],
  locations: [
    {
      id: "loc_001",
      baseDefinition: { name: "指挥中心", type: "interior", architecture: "金属结构", geography: "近地轨道", scale: "大型" },
      stateTimeline: [
        {
          stateId: "loc_default",
          era: "现代",
          condition: "崭新",
          atmosphere: { timeOfDay: "白天", weather: "无", season: "无", lighting: "冷白光", crowdDensity: "适中" },
          conceptImage: sampleImage("loc"),
          depthLayers: { foreground: "控制台", midground: "通道", background: "观察窗" },
          referenceAngles: [],
        },
      ],
    },
  ],
  props: [],
  crowdPresets: [],
  stylePresets: [],
  worldRules: [],
  audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
}

const mockShot: Shot = {
  id: "shot_001",
  order: 1,
  duration: 6,
  transitionIn: "cut",
  transitionOut: "cut",
  narrativePurpose: "建立场景",
  camera: { type: "push-in", framing: "wide", angle: "front", movementSpeed: "slow", lens: "wide" },
  continuity: { eyelineMatch: null, shotReverseShot: null, actionContinuation: null, costumeState: "default", propState: "default", timeOfDayLock: false, parallelMontage: [] },
  subjects: [{ characterId: "char_001", characterState: "liyi_default", expression: "determined", action: "指挥", position: "center", depthLayer: "foreground", outfitVariant: null, crowdPresetId: null }],
  environmentOverrides: {},
  audio: { dialogueRef: null, bgmId: null, sfx: [], ambientSound: null },
  references: {
    characters: [{ characterId: "char_001", stateRef: "liyi_default", expressionRef: "determined", outfitVariant: null }],
    location: { locationId: "loc_001", stateRef: "loc_default", angleRef: null },
    props: [],
    stylePresetId: "",
  },
  prompt: { subjectDesc: "", visualDesc: "", cameraDesc: "", lightingDesc: "", moodDesc: "" },
  output: { versions: [], selectedVersion: null, approvalStatus: "pending" },
}

const mockDecision: ShotDecision = {
  templateId: "establishing-wide",
  motion: "push-in",
  mood: "epic",
  colorPalette: ["#00ff88", "#ff0088"],
  lighting: "dramatic high-contrast",
  postProcessing: ["bloom", "vignette"],
  qualityTier: "epic",
  reasoning: "Test decision",
}

describe("V2 PromptBuilder", () => {
  it("builds prompt with character and location references", async () => {
    const result = await Effect.runPromise(buildShotPrompt(mockShot, mockStudio, mockDecision))

    expect(result.text).toContain("李毅")
    expect(result.text).toContain("指挥中心")
    expect(result.text).toContain("dramatic high-contrast")
    expect(result.references.length).toBe(2)
  })

  it("uses LLM decision for lighting instead of hardcoded fallback", async () => {
    const result = await Effect.runPromise(buildShotPrompt(mockShot, mockStudio, mockDecision))
    expect(result.text).toContain("dramatic high-contrast")
    expect(result.text).not.toContain("cinematic, natural")
  })

  it("uses quality tier from decision, not hardcoded suffix", async () => {
    const result = await Effect.runPromise(buildShotPrompt(mockShot, mockStudio, mockDecision))
    expect(result.text).toContain("epic scale")
    expect(result.text).toContain("volumetric fog")
  })

  it("adapts quality text for different tiers", async () => {
    const moodyDecision = { ...mockDecision, qualityTier: "moody" }
    const result = await Effect.runPromise(buildShotPrompt(mockShot, mockStudio, moodyDecision))
    expect(result.text).toContain("atmospheric")
    expect(result.text).toContain("cinematic color grading")
  })

  it("includes camera description from shot schema", async () => {
    const result = await Effect.runPromise(buildShotPrompt(mockShot, mockStudio, mockDecision))
    expect(result.text).toContain("pushes forward")
    expect(result.text).toContain("wide establishing shot")
  })

  it("includes color palette from LLM decision", async () => {
    const result = await Effect.runPromise(buildShotPrompt(mockShot, mockStudio, mockDecision))
    expect(result.text).toContain("#00ff88")
    expect(result.text).toContain("#ff0088")
  })
})
