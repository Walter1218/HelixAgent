/**
 * V1 vs V2 End-to-End Video Comparison
 *
 * Same script → V1 prompts vs V2 prompts → SeedDance → side-by-side videos
 */

import { Effect } from "effect"
import { StoryboardIntentPlanner } from "../src/planner/storyboard-intent-planner"
import { ScenePromptTranslator } from "../src/renderer/scene-prompt-translator"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"
import { decideShotBatch, decideGlobalStyle } from "../src/v2/llm/decisions"
import { buildShotPrompt } from "../src/v2/prompt/builder"
import { SeedDanceClient } from "../src/services/seeddance-client"
import type { VideoProject } from "../src/schema/project"
import type { Studio } from "../src/studio/schema/studio"
import type { Shot } from "../src/project/schema/shot"

// ─── Shared Test Input ───

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
      description: "深空中，一颗巨大的红色恒星占据画面，十几艘人类战舰以剪影形式飞向恒星",
      visualPrompt: "战舰排列成楔形编队，缓慢推向巨大的红色恒星",
      motionPrompt: "缓慢推近",
      narration: null,
      durationSeconds: 5,
      characters: [],
    },
    {
      id: "shot_02",
      description: "战舰冲入恒星日冕，护盾在高温中闪烁、破裂，金属外壳被烧成白热色",
      visualPrompt: "碎片在真空中无声飞散，强烈的红光照亮一切",
      motionPrompt: "动态跟随",
      narration: null,
      durationSeconds: 5,
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
  name: "对比测试",
  characters: [],
  locations: [{
    id: "loc_space",
    baseDefinition: { name: "深空战场", type: "exterior", architecture: "开放空间", geography: "近恒星轨道", scale: "超大规模" },
    stateTimeline: [{
      stateId: "space_battle",
      era: "危机纪元",
      condition: "战区",
      atmosphere: { timeOfDay: "深空黑暗", weather: "恒星风暴", season: "无", lighting: "恒星的红色主导光照", crowdDensity: "稀疏" },
      conceptImage: sampleImage("space_concept"),
      depthLayers: { foreground: "战舰剪影", midground: "楔形编队", background: "巨大的红色恒星" },
      referenceAngles: [],
    }],
  }],
  props: [],
  crowdPresets: [],
  stylePresets: [],
  worldRules: [],
  audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
}

// ─── Generate V1 Prompts ───

const generateV1Prompts = async (): Promise<string[]> => {
  const intent = await Effect.runPromise(
    StoryboardIntentPlanner.plan(testStoryboard, testRequirement),
  )

  const prompts: string[] = []
  for (const shotIntent of intent.shots) {
    const sceneConfig = HelixStructureAdapter.toSceneConfig(shotIntent, {
      width: 1280, height: 720, fps: 30, duration: shotIntent.durationSeconds,
    })
    const prompt = ScenePromptTranslator.translate(sceneConfig, shotIntent, intent.globalStyle)
    prompts.push(prompt)
  }
  return prompts
}

// ─── Generate V2 Prompts ───

const generateV2Prompts = async (): Promise<string[]> => {
  const shotContexts = testStoryboard.shots.map((shot, i) => ({
    description: shot.description,
    visualPrompt: shot.visualPrompt,
    motionPrompt: shot.motionPrompt,
    narration: shot.narration ?? undefined,
    sequenceContext: `Shot ${i + 1} of ${testStoryboard.shots.length}`,
    charactersPresent: shot.characters,
  }))

  const decisions = await Effect.runPromise(decideShotBatch(shotContexts))

  const prompts: string[] = []
  for (let i = 0; i < testStoryboard.shots.length; i++) {
    const shot = testStoryboard.shots[i]
    const decision = decisions[i]
    if (!decision) continue

    const shotSchema: Shot = {
      id: shot.id, order: i, duration: shot.durationSeconds,
      transitionIn: "cut", transitionOut: "cut",
      narrativePurpose: shot.description,
      camera: { type: "static", framing: "medium", angle: "front", movementSpeed: "slow", lens: "standard" },
      continuity: { eyelineMatch: null, shotReverseShot: null, actionContinuation: null, costumeState: "default", propState: "default", timeOfDayLock: false, parallelMontage: [] },
      subjects: [],
      environmentOverrides: {},
      audio: { dialogueRef: null, bgmId: null, sfx: [], ambientSound: null },
      references: {
        characters: [],
        location: { locationId: "loc_space", stateRef: "space_battle", angleRef: null },
        props: [], stylePresetId: "",
      },
      prompt: { subjectDesc: shot.description, visualDesc: shot.visualPrompt ?? "", cameraDesc: "", lightingDesc: "", moodDesc: "" },
      output: { versions: [], selectedVersion: null, approvalStatus: "pending" },
    }

    const built = await Effect.runPromise(buildShotPrompt(shotSchema, testStudio, decision))
    prompts.push(built.text)
  }
  return prompts
}

// ─── Submit to SeedDance ───

const submitToSeedDance = async (prompt: string, duration: number, label: string): Promise<string> => {
  console.log(`  Submitting ${label}...`)
  const result = await Effect.runPromise(
    SeedDanceClient.generateVideo({
      content: [{ type: "text", text: prompt }],
      duration,
      ratio: "16:9",
      generateAudio: false,
      watermark: false,
    }).pipe(Effect.catch((e) => Effect.fail(e))),
  )

  if (result.status === "succeeded" && result.videoUrl) {
    console.log(`  ✅ ${label} done: ${result.videoUrl.slice(0, 60)}...`)
    return result.videoUrl
  }
  throw new Error(`SeedDance failed for ${label}: ${result.error}`)
}

const downloadVideo = async (url: string, outputPath: string) => {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  await Bun.write(outputPath, buf)
  console.log(`  → Saved: ${outputPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
}

// ─── Main ───

const main = async () => {
  const outputDir = "output/helixstructure/v1-v2-comparison"
  await Bun.write(`${outputDir}/.gitkeep`, "")

  console.log("═══ Generating V1 Prompts ═══")
  const v1Prompts = await generateV1Prompts()
  for (let i = 0; i < v1Prompts.length; i++) {
    console.log(`\n[V1 Shot ${i + 1}]`)
    console.log(`  ${v1Prompts[i]}`)
  }

  console.log("\n\n═══ Generating V2 Prompts ═══")
  const v2Prompts = await generateV2Prompts()
  for (let i = 0; i < v2Prompts.length; i++) {
    console.log(`\n[V2 Shot ${i + 1}]`)
    console.log(`  ${v2Prompts[i]}`)
  }

  console.log("\n\n═══ Submitting to SeedDance ═══")

  const results: Array<{ label: string; videoUrl: string; prompt: string }> = []

  for (let i = 0; i < v1Prompts.length; i++) {
    const url = await submitToSeedDance(v1Prompts[i], testStoryboard.shots[i].durationSeconds, `V1-Shot${i + 1}`)
    results.push({ label: `V1-Shot${i + 1}`, videoUrl: url, prompt: v1Prompts[i] })
  }

  for (let i = 0; i < v2Prompts.length; i++) {
    const url = await submitToSeedDance(v2Prompts[i], testStoryboard.shots[i].durationSeconds, `V2-Shot${i + 1}`)
    results.push({ label: `V2-Shot${i + 1}`, videoUrl: url, prompt: v2Prompts[i] })
  }

  console.log("\n\n═══ Downloading Videos ═══")
  for (const r of results) {
    await downloadVideo(r.videoUrl, `${outputDir}/${r.label}.mp4`)
  }

  console.log("\n\n═══ Comparison Summary ═══")
  console.log(`\nOutput: ${outputDir}/`)
  for (const r of results) {
    console.log(`  ${r.label}: ${r.label}.mp4`)
  }

  console.log("\nPrompts used:")
  for (const r of results) {
    console.log(`\n--- ${r.label} ---`)
    console.log(`  ${r.prompt}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
