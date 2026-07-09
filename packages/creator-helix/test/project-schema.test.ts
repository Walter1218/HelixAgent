import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { ShotSchema } from "../src/project/schema/shot"
import { SequenceSchema } from "../src/project/schema/sequence"
import { ScriptSchema } from "../src/project/schema/script"
import { ProjectSchema } from "../src/project/schema/project"

describe("Project Schema", () => {
  it("validates Shot with all fields", () => {
    const shot = {
      id: "shot_001",
      order: 1,
      duration: 6,
      transitionIn: "cut",
      transitionOut: "fade",
      narrativePurpose: "建立场景",
      camera: {
        type: "push-in" as const,
        framing: "wide" as const,
        angle: "front" as const,
        movementSpeed: "slow" as const,
        lens: "wide" as const,
      },
      continuity: {
        eyelineMatch: null,
        shotReverseShot: null,
        actionContinuation: null,
        costumeState: "崭新",
        propState: "完整",
        timeOfDayLock: true,
        parallelMontage: [],
      },
      subjects: [
        {
          characterId: "char_001",
          characterState: "liyi_young",
          expression: "determined",
          action: "指挥舰队",
          position: "画面中央",
          depthLayer: "foreground" as const,
          outfitVariant: null,
          crowdPresetId: null,
        },
      ],
      environmentOverrides: {},
      audio: {
        dialogueRef: null,
        bgmId: null,
        sfx: [],
        ambientSound: null,
      },
      references: {
        characters: [
          {
            characterId: "char_001",
            stateRef: "liyi_young",
            expressionRef: "determined",
            outfitVariant: null,
          },
        ],
        location: {
          locationId: "loc_001",
          stateRef: "station_new",
          angleRef: null,
        },
        props: [],
        stylePresetId: "style_001",
      },
      prompt: {
        subjectDesc: "李毅指挥舰队",
        visualDesc: "太空站指挥中心",
        cameraDesc: "缓慢推进",
        lightingDesc: "冷白色LED",
        moodDesc: "紧张、史诗",
      },
      output: {
        versions: [],
        selectedVersion: null,
        approvalStatus: "pending" as const,
      },
    }
    const result = Schema.decodeUnknownSync(ShotSchema)(shot)
    expect(result.id).toBe("shot_001")
    expect(result.subjects.length).toBe(1)
  })

  it("validates Sequence with shots", () => {
    const seq = {
      id: "seq_001",
      scriptActRef: "act_1",
      narrativeBeat: {
        setup: "发现敌人",
        conflict: "交战",
        climax: "旗舰被毁",
        resolution: "撤退",
      },
      emotionalArc: "紧张到绝望",
      locationId: "loc_001",
      locationStateRef: "station_new",
      timeOfDay: "人工白天",
      weather: "无",
      charactersPresent: ["char_001"],
      dialogue: [
        {
          characterId: "char_001",
          text: "全舰撤退！",
          tone: "急迫",
          timing: "on-shot" as const,
        },
      ],
      shots: [],
    }
    const result = Schema.decodeUnknownSync(SequenceSchema)(seq)
    expect(result.narrativeBeat.climax).toBe("旗舰被毁")
  })

  it("validates Script with usages", () => {
    const script = {
      id: "script_001",
      title: "三体反击战",
      narrativeStructure: { acts: [] },
      timeline: {
        storyStart: "危机纪元205年",
        narrativeOrder: ["act_1", "act_2"],
      },
      characterUsages: [
        {
          characterId: "char_001",
          stateRef: "liyi_young",
          arc: ["liyi_young", "liyi_veteran"],
          overrides: {
            personality: "变得更加沉稳",
          },
        },
      ],
      locationUsages: [],
      propUsages: [],
      sequences: [],
    }
    const result = Schema.decodeUnknownSync(ScriptSchema)(script)
    expect(result.characterUsages[0].arc.length).toBe(2)
  })

  it("validates full Project", () => {
    const project = {
      id: "proj_001",
      meta: {
        title: "三体反击战",
        logline: "人类舰队反击三体文明",
        theme: "勇气与牺牲",
        targetDuration: 120,
      },
      stylePresetId: "style_001",
      worldRules: ["rule_001"],
      scripts: [],
    }
    const result = Schema.decodeUnknownSync(ProjectSchema)(project)
    expect(result.meta.title).toBe("三体反击战")
  })
})
