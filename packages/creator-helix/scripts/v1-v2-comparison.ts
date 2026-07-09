/**
 * V1 vs V2 pipeline comparison
 *
 * Runs the same test input through both pipelines and outputs a side-by-side comparison.
 */

import { Effect } from "effect"
import { StoryboardIntentPlanner } from "../src/planner/storyboard-intent-planner"
import { ScenePromptTranslator } from "../src/renderer/scene-prompt-translator"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"
import { decideShotBatch, decideGlobalStyle } from "../src/v2/llm/decisions"
import { buildShotPrompt } from "../src/v2/prompt/builder"
import type { VideoProject } from "../src/schema/project"
import type { Studio } from "../src/studio/schema/studio"
import type { Shot } from "../src/project/schema/shot"

// ─── Test Input (same for both) ───

const testRequirement: VideoProject.Requirement = {
  style: "cold, dramatic sci-fi, desperate last stand",
  genre: "sci-fi",
  era: "危机纪元",
  overallMood: "desperate hope against overwhelming odds",
}

const testStoryboard: VideoProject.Storyboard = {
  shots: [
    {
      id: "shot_01",
      description: "深空中，一颗巨大的红色恒星占据画面三分之二的面积，火舌从表面喷涌而出",
      visualPrompt: "十几艘人类战舰排列成楔形编队，以剪影形式从左下角飞向恒星",
      motionPrompt: "缓慢推近",
      narration: "人类舰队发起最后的冲锋",
      durationSeconds: 6,
      characters: ["char_admiral"],
    },
    {
      id: "shot_02",
      description: "旗舰指挥室内，舰队司令凝视着舷窗外越来越近的恒星",
      visualPrompt: "司令的侧脸被恒星的红光照亮，眼中倒映着火焰",
      motionPrompt: "特写推近",
      narration: null,
      durationSeconds: 4,
      characters: ["char_admiral"],
    },
    {
      id: "shot_03",
      description: "战舰编队冲入恒星日冕，护盾在高温中闪烁、破裂",
      visualPrompt: "金属外壳被烧成白热色，碎片在真空中无声飞散",
      motionPrompt: "跟随爆炸",
      narration: "人类从未如此接近太阳",
      durationSeconds: 5,
      characters: [],
    },
    {
      id: "shot_04",
      description: "拉远镜头，十几艘战舰的残骸在恒星背景中缓缓飘散",
      visualPrompt: "从残骸的缝隙中望向巨大的红色恒星，渺小与宏大对比",
      motionPrompt: "拉远揭示全景",
      narration: null,
      durationSeconds: 8,
      characters: [],
    },
  ],
}

const sampleImage = (id: string) => ({
  url: `https://example.com/${id}.png`,
  width: 720,
  height: 1280,
})

const testStudio: Studio = {
  id: "studio_test",
  name: "三体测试",
  characters: [
    {
      id: "char_admiral",
      baseIdentity: {
        name: "舰队司令",
        gender: "male",
        race: "人类",
        distinguishingMarks: ["花白鬓角", "左脸战伤疤痕"],
      },
      stateTimeline: [
        {
          stateId: "admiral_desperate",
          era: "危机纪元",
          ageRange: [55, 60],
          appearance: {
            face: "刚毅的面容，深邃的眼窝",
            hair: "花白短发",
            eyes: "深陷的蓝眼睛",
            skin: "饱经风霜的白皮肤",
            bodyType: "瘦削但挺拔",
            typicalOutfit: "旧式海军制服，肩章磨损",
          },
          portrait: sampleImage("admiral"),
          personalityShift: "疲惫但坚定",
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
      id: "loc_space",
      baseDefinition: {
        name: "深空战场",
        type: "exterior",
        architecture: "开放空间",
        geography: "近恒星轨道",
        scale: "超大规模",
      },
      stateTimeline: [
        {
          stateId: "space_battle",
          era: "危机纪元",
          condition: "战区",
          atmosphere: {
            timeOfDay: "永恒的深空黑暗",
            weather: "恒星风暴",
            season: "无",
            lighting: "恒星的红色主导光照，强烈的明暗对比",
            crowdDensity: "稀疏",
          },
          conceptImage: sampleImage("space_concept"),
          depthLayers: {
            foreground: "战舰残骸剪影",
            midground: "楔形编队",
            background: "巨大的红色恒星",
          },
          referenceAngles: [],
        },
      ],
    },
    {
      id: "loc_bridge",
      baseDefinition: {
        name: "旗舰指挥室",
        type: "interior",
        architecture: "金属结构，仪表盘密布",
        geography: "旗舰内部",
        scale: "中等",
      },
      stateTimeline: [
        {
          stateId: "bridge_active",
          era: "危机纪元",
          condition: "战时状态",
          atmosphere: {
            timeOfDay: "人工照明",
            weather: "无",
            season: "无",
            lighting: "红色警报灯与舷窗透入的恒星光混合",
            crowdDensity: "适中",
          },
          conceptImage: sampleImage("bridge_concept"),
          depthLayers: {
            foreground: "司令的侧脸",
            midground: "指挥台和仪表盘",
            background: "舷窗外的红色恒星",
          },
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

// ─── V1 Pipeline ───

const runV1 = async () => {
  console.log("═══ V1 Pipeline (keyword matching + hardcoded) ═══\n")

  const intent = await Effect.runPromise(
    StoryboardIntentPlanner.plan(testStoryboard, testRequirement),
  )

  console.log("--- Template Selection ---")
  for (const shot of intent.shots) {
    console.log(`  ${shot.templateId} | motion: ${shot.motion} | mood: ${shot.mood}`)
  }

  console.log("\n--- Global Style ---")
  console.log(`  colorPalette: ${intent.globalStyle.colorPalette}`)
  console.log(`  lighting: ${intent.globalStyle.lighting}`)
  console.log(`  postProcessing: ${intent.globalStyle.postProcessing}`)

  console.log("\n--- Generated Prompts ---")
  for (let i = 0; i < intent.shots.length; i++) {
    const shotIntent = intent.shots[i]
    const sceneConfig = HelixStructureAdapter.toSceneConfig(shotIntent, {
      width: 1280,
      height: 720,
      fps: 30,
      duration: shotIntent.durationSeconds,
    })
    const prompt = ScenePromptTranslator.translate(sceneConfig, shotIntent, intent.globalStyle)
    console.log(`\n[Shot ${i + 1}] ${shotIntent.templateId} | mood: ${shotIntent.mood}`)
    console.log(`  ${prompt}`)
  }

  return intent
}

// ─── V2 Pipeline ───

const runV2 = async () => {
  console.log("\n\n═══ V2 Pipeline (LLM-driven decisions) ═══\n")

  const shotContexts = testStoryboard.shots.map((shot, i) => ({
    description: shot.description,
    visualPrompt: shot.visualPrompt,
    motionPrompt: shot.motionPrompt,
    narration: shot.narration ?? undefined,
    sequenceContext: `Shot ${i + 1} of ${testStoryboard.shots.length}. ${i > 0 ? "Previous: " + testStoryboard.shots[i - 1].description : ""} ${i < testStoryboard.shots.length - 1 ? "Next: " + testStoryboard.shots[i + 1].description : ""}`,
    charactersPresent: shot.characters,
  }))

  console.log("--- LLM Global Style Decision ---")
  const globalStyle = await Effect.runPromise(
    decideGlobalStyle({
      requirementStyle: testRequirement.style,
      genre: testRequirement.genre,
      era: testRequirement.era,
      overallMood: testRequirement.overallMood,
    }),
  )
  console.log(`  colorPalette: ${globalStyle.colorPalette.join(", ")}`)
  console.log(`  lighting: ${globalStyle.lighting}`)
  console.log(`  postProcessing: ${globalStyle.postProcessing.join(", ")}`)
  console.log(`  moodKeywords: ${globalStyle.moodKeywords.join(", ")}`)
  console.log(`  qualityTier: ${globalStyle.qualityTier}`)
  console.log(`  reasoning: ${globalStyle.reasoning}`)

  console.log("\n--- LLM Shot Decisions ---")
  const decisions = await Effect.runPromise(decideShotBatch(shotContexts))
  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i]
    console.log(`\n[Shot ${i + 1}]`)
    console.log(`  template: ${d.templateId} | motion: ${d.motion} | mood: ${d.mood}`)
    console.log(`  palette: ${d.colorPalette.join(", ")}`)
    console.log(`  lighting: ${d.lighting}`)
    console.log(`  postProcessing: ${d.postProcessing.join(", ")}`)
    console.log(`  qualityTier: ${d.qualityTier}`)
    console.log(`  reasoning: ${d.reasoning}`)
  }

  console.log("\n--- Generated Prompts ---")
  for (let i = 0; i < testStoryboard.shots.length; i++) {
    const shot = testStoryboard.shots[i]
    const decision = decisions[i]
    if (!decision) continue

    const shotSchema: Shot = {
      id: shot.id,
      order: i,
      duration: shot.durationSeconds,
      transitionIn: "cut",
      transitionOut: "cut",
      narrativePurpose: shot.description,
      camera: { type: mapMotionToCamera(decision.motion), framing: "medium", angle: "front", movementSpeed: "slow", lens: "standard" },
      continuity: { eyelineMatch: null, shotReverseShot: null, actionContinuation: null, costumeState: "default", propState: "default", timeOfDayLock: false, parallelMontage: [] },
      subjects: shot.characters.map(charId => ({
        characterId: charId,
        characterState: "admiral_desperate",
        expression: "determined",
        action: "",
        position: "center",
        depthLayer: "foreground",
        outfitVariant: null,
        crowdPresetId: null,
      })),
      environmentOverrides: {},
      audio: { dialogueRef: null, bgmId: null, sfx: [], ambientSound: null },
      references: {
        characters: shot.characters.map(charId => ({
          characterId: charId,
          stateRef: "admiral_desperate",
          expressionRef: "determined",
          outfitVariant: null,
        })),
        location: {
          locationId: i === 1 ? "loc_bridge" : "loc_space",
          stateRef: i === 1 ? "bridge_active" : "space_battle",
          angleRef: null,
        },
        props: [],
        stylePresetId: "",
      },
      prompt: { subjectDesc: shot.description, visualDesc: shot.visualPrompt ?? "", cameraDesc: shot.motionPrompt ?? "", lightingDesc: "", moodDesc: "" },
      output: { versions: [], selectedVersion: null, approvalStatus: "pending" },
    }

    const built = await Effect.runPromise(buildShotPrompt(shotSchema, testStudio, decision))
    console.log(`\n[Shot ${i + 1}] ${decision.templateId} | mood: ${decision.mood} | quality: ${decision.qualityTier}`)
    console.log(`  ${built.text}`)
  }
}

function mapMotionToCamera(motion: string): Shot["camera"]["type"] {
  const map: Record<string, Shot["camera"]["type"]> = {
    "push-in": "push-in",
    "pull-back": "pull-back",
    track: "track",
    orbit: "orbit",
    pan: "pan",
    tilt: "tilt",
    dolly: "dolly",
    "slow-rotation": "orbit",
    static: "static",
  }
  return map[motion] ?? "static"
}

// ─── Main ───

const main = async () => {
  await runV1()
  await runV2()

  console.log("\n\n═══ Comparison Summary ═══")
  console.log(`
V1 (keyword matching):
- Template: hardcoded if/else on English keywords (fails on Chinese input)
- Mood: 4 keyword checks → always defaults to "cinematic"
- Color: includes("cold") ? "cool-blue-silver" : "warm-amber-grey"
- Quality: ALWAYS "photorealism, 8K, film grain, volumetric lighting"
- Post-processing: ALWAYS "cinematic-bloom-vignette"

V2 (LLM-driven):
- Template: LLM reads full context + template catalog → reasoned choice
- Mood: LLM infers from narrative arc and character state
- Color: LLM generates hex palette matching emotional tone
- Quality: 5 tiers (cinematic/moody/epic/chaotic/minimal) → context-aware
- Post-processing: LLM chooses specific effects per shot
`)
}

main().catch(e => { console.error(e); process.exit(1) })
