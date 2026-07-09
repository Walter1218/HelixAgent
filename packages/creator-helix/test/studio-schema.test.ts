import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { CharacterSchema, CharacterStateSchema } from "../src/studio/schema/character"
import { LocationSchema } from "../src/studio/schema/location"
import { PropSchema } from "../src/studio/schema/prop"
import { StylePresetSchema } from "../src/studio/schema/style-preset"
import { WorldRuleSchema } from "../src/studio/schema/world-rule"
import { CrowdPresetSchema } from "../src/studio/schema/crowd-preset"
import { AudioLibrarySchema } from "../src/studio/schema/audio"
import { StudioSchema } from "../src/studio/schema/studio"

const sampleImage = {
  url: "https://example.com/image.png",
  width: 1024,
  height: 1024,
}

describe("Studio Schema", () => {
  it("validates Character with stateTimeline", () => {
    const char = {
      id: "char_001",
      baseIdentity: {
        name: "李毅",
        gender: "male",
        race: "人类",
        distinguishingMarks: ["左脸疤痕"],
      },
      stateTimeline: [
        {
          stateId: "liyi_young",
          era: "地球时期",
          ageRange: [18, 22] as [number, number],
          appearance: {
            face: "方正脸庞",
            hair: "黑色短发",
            eyes: "深棕色眼睛",
            skin: "黄皮肤",
            bodyType: "健壮",
            typicalOutfit: "蓝色军装",
          },
          portrait: sampleImage,
          personalityShift: "冲动、理想主义",
          relations: [],
        },
      ],
      expressionSheet: {
        neutral: sampleImage,
        angry: sampleImage,
        sad: sampleImage,
        surprised: sampleImage,
        happy: sampleImage,
        determined: sampleImage,
        fearful: sampleImage,
      },
    }
    const result = Schema.decodeUnknownSync(CharacterSchema)(char)
    expect(result.id).toBe("char_001")
    expect(result.stateTimeline.length).toBe(1)
  })

  it("validates Location with stateTimeline", () => {
    const loc = {
      id: "loc_001",
      baseDefinition: {
        name: "太空站",
        type: "interior" as const,
        architecture: "金属结构",
        geography: "近地轨道",
        scale: "大型",
      },
      stateTimeline: [
        {
          stateId: "station_new",
          era: "建造初期",
          condition: "崭新",
          atmosphere: {
            timeOfDay: "人工白天",
            weather: "无",
            season: "无",
            lighting: "冷白色LED",
            crowdDensity: "适中",
          },
          conceptImage: sampleImage,
          depthLayers: {
            foreground: "控制台",
            midground: "主通道",
            background: "观察窗",
          },
          referenceAngles: [],
        },
      ],
    }
    const result = Schema.decodeUnknownSync(LocationSchema)(loc)
    expect(result.baseDefinition.type).toBe("interior")
  })

  it("validates StylePreset", () => {
    const style = {
      id: "style_001",
      name: "赛博朋克",
      colorPalette: ["#00ff88", "#ff0088", "#0044ff"],
      lightingStyle: "霓虹灯光",
      postProcessing: ["bloom", "chromatic aberration"],
      cameraStyle: {
        preferredMovements: ["dolly", "orbit"],
        pacing: "moderate",
        framingBias: "wide",
      },
      moodKeywords: ["阴郁", "高科技", "反乌托邦"],
      referenceImages: [sampleImage],
    }
    const result = Schema.decodeUnknownSync(StylePresetSchema)(style)
    expect(result.name).toBe("赛博朋克")
  })

  it("validates WorldRule", () => {
    const rule = {
      id: "rule_001",
      category: "physics" as const,
      rule: "低重力环境",
      visualConstraint: "所有跳跃动作缓慢飘浮",
    }
    const result = Schema.decodeUnknownSync(WorldRuleSchema)(rule)
    expect(result.category).toBe("physics")
  })

  it("validates CrowdPreset", () => {
    const crowd = {
      id: "crowd_001",
      category: "士兵",
      density: "dense" as const,
      styleReference: sampleImage,
      description: "全副武装的太空士兵",
    }
    const result = Schema.decodeUnknownSync(CrowdPresetSchema)(crowd)
    expect(result.density).toBe("dense")
  })

  it("validates AudioLibrary", () => {
    const audio = {
      soundEffects: [],
      bgm: [],
      voicePresets: [],
    }
    const result = Schema.decodeUnknownSync(AudioLibrarySchema)(audio)
    expect(result.soundEffects.length).toBe(0)
  })

  it("validates full Studio", () => {
    const studio = {
      id: "studio_001",
      name: "测试工作室",
      characters: [],
      locations: [],
      props: [],
      crowdPresets: [],
      stylePresets: [],
      worldRules: [],
      audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
    }
    const result = Schema.decodeUnknownSync(StudioSchema)(studio)
    expect(result.name).toBe("测试工作室")
  })
})
