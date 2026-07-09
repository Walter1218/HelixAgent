/**
 * Fair comparison: structured prompt vs structured prompt + HelixStructure reference
 *
 * Uses the SAME optimized prompt for all 3 groups:
 * - A: text-only (no reference)
 * - B: text + HelixStructure keyframe as reference_image (TOS URL)
 * - C: text + HelixStructure preview video as reference_video (TOS URL)
 */

import { Effect } from "effect"
import { uploadFile } from "../src/services/tos-upload"

const runEffect = <E, A>(effect: Effect.Effect<A, E>): Promise<A> =>
  new Promise((resolve, reject) => {
    Effect.runFork(effect).addObserver(exit => {
      if (exit._tag === "Success") resolve(exit.value)
      else reject(exit.cause)
    })
  })

const apiKey = process.env.SEEDANCE_API_KEY ?? ""
const apiBase = process.env.SEEDANCE_API_BASE ?? "https://ark.cn-beijing.volces.com/api/v3"

const PROMPT = `科幻电影场景：深空中，一颗巨大的红色恒星占据画面三分之二的面积，火舌从表面喷涌而出。十几艘人类战舰排列成楔形编队，以剪影形式从左下角飞向恒星。镜头缓慢推进，战舰逐渐变大。深红色与黑色的对比，史诗感，电影级光照，8K细节。`

const HS_KEYFRAME_PATH = "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/creator-helix/output/helixstructure/v2-preview-01.png"
const HS_VIDEO_PATH = "/Users/onetwo/Documents/trae_projects/HelixAgent/packages/creator-helix/output/helixstructure/anim-v2.mp4"

const submitRaw = async (content: unknown[], duration: number) => {
  const body = {
    model: "doubao-seedance-2-0-mini-260615",
    content,
    generate_audio: false,
    ratio: "16:9",
    duration,
    watermark: false,
  }
  const res = await fetch(`${apiBase}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Submit failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { id: string }
  return data.id
}

const pollTask = async (taskId: string): Promise<string> => {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${apiBase}/contents/generations/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    const data = await res.json() as {
      status: string
      content?: { video_url?: string }
      error?: { message: string }
    }
    if (data.status === "succeeded") return data.content!.video_url!
    if (data.status === "failed") throw new Error(data.error?.message ?? "unknown")
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error("timeout")
}

const downloadVideo = async (url: string, outputPath: string) => {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  await Bun.write(outputPath, buf)
  console.log(`  → Saved: ${outputPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
}

const extractFrame = async (videoPath: string, outputPath: string, timeSeconds: number) => {
  const proc = Bun.spawn([
    "ffmpeg", "-y", "-i", videoPath,
    "-ss", String(timeSeconds),
    "-frames:v", "1",
    outputPath,
  ], { stdout: "pipe", stderr: "pipe" })
  await proc.exited
}

const main = async () => {
  const outputDir = "output/helixstructure/fair-comparison-v2"
  await Bun.write(`${outputDir}/.gitkeep`, "")

  const results: Record<string, { taskId: string; videoUrl?: string; videoPath?: string }> = {}

  // Upload reference assets to TOS
  console.log("Uploading reference assets to TOS...")
  const keyframeTosUrl = await runEffect(uploadFile("fair-comparison/keyframe.png", HS_KEYFRAME_PATH))
  console.log(`  Keyframe TOS URL: ${keyframeTosUrl}`)
  const videoTosUrl = await runEffect(uploadFile("fair-comparison/hs-video.mp4", HS_VIDEO_PATH))
  console.log(`  Video TOS URL: ${videoTosUrl}`)

  // === Group A: text-only ===
  console.log("\n[Group A] Text-only (no reference)...")
  const taskA = await submitRaw(
    [{ type: "text", text: PROMPT }],
    6,
  )
  console.log(`  Task ID: ${taskA}`)
  const urlA = await pollTask(taskA)
  await downloadVideo(urlA, `${outputDir}/A-text-only.mp4`)
  results.A = { taskId: taskA, videoUrl: urlA, videoPath: `${outputDir}/A-text-only.mp4` }

  // === Group B: text + HS keyframe as reference_image ===
  console.log("\n[Group B] Text + HelixStructure keyframe (reference_image)...")
  const taskB = await submitRaw([
    { type: "text", text: PROMPT },
    { type: "image_url", image_url: { url: keyframeTosUrl }, role: "reference_image" },
  ], 6)
  console.log(`  Task ID: ${taskB}`)
  const urlB = await pollTask(taskB)
  await downloadVideo(urlB, `${outputDir}/B-text-plus-hs-keyframe.mp4`)
  results.B = { taskId: taskB, videoUrl: urlB, videoPath: `${outputDir}/B-text-plus-hs-keyframe.mp4` }

  // === Group C: text + HS preview video as reference_video ===
  console.log("\n[Group C] Text + HelixStructure preview video (reference_video)...")
  const taskC = await submitRaw([
    { type: "text", text: PROMPT },
    { type: "video_url", video_url: { url: videoTosUrl }, role: "reference_video" },
  ], 6)
  console.log(`  Task ID: ${taskC}`)
  const urlC = await pollTask(taskC)
  await downloadVideo(urlC, `${outputDir}/C-text-plus-hs-video.mp4`)
  results.C = { taskId: taskC, videoUrl: urlC, videoPath: `${outputDir}/C-text-plus-hs-video.mp4` }

  // Extract frames from each result for comparison
  console.log("\nExtracting comparison frames...")
  for (const [label, r] of Object.entries(results)) {
    if (!r.videoPath) continue
    for (const [sec, fname] of [[1, "f1"], [3, "f2"], [5, "f3"]] as const) {
      await extractFrame(r.videoPath, `${outputDir}/${label}-${fname}.png`, sec)
    }
  }

  console.log("\n=== Results ===")
  for (const [label, r] of Object.entries(results)) {
    console.log(`  ${label}: ${r.taskId} → ${r.videoUrl}`)
  }
  console.log("\nDone! Check output/helixstructure/fair-comparison-v2/ for comparison frames.")
}

main().catch(e => { console.error(e); process.exit(1) })
