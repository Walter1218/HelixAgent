#!/usr/bin/env bun

import { mkdirSync, existsSync } from "fs"
import { execSync } from "child_process"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"

const HELIX_STRUCTURE_URL = "http://localhost:5176"
const OUTPUT_DIR = "./output/helixstructure"
const FPS = 10

const shots = [
  { templateId: "space-establishing", motion: "push-in", durationSeconds: 4, subject: "地球舰队在木星轨道列阵" },
  { templateId: "teardrop-approach", motion: "slow-rotation", durationSeconds: 4, subject: "水滴从三体方向驶来" },
  { templateId: "impact-penetration", motion: "track", durationSeconds: 3, subject: "水滴突然加速" },
  { templateId: "impact-penetration", motion: "follow", durationSeconds: 4, subject: "水滴穿透战舰装甲" },
  { templateId: "nuclear-bloom", motion: "static", durationSeconds: 4, subject: "核火在真空中无声绽放" },
  { templateId: "debris-reveal", motion: "pull-back", durationSeconds: 4, subject: "残骸云中，水滴悬停" },
]

mkdirSync(`${OUTPUT_DIR}/frames`, { recursive: true })

async function findChromePath(): Promise<string> {
  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error("Chrome not found")
}

async function renderShotFrames(shot: typeof shots[0], index: number) {
  const puppeteer = await import("puppeteer-core")
  const chromePath = await findChromePath()

  console.log(`\nShot ${index + 1}: ${shot.subject}`)

  const sceneConfig = HelixStructureAdapter.toSceneConfig(
    { ...shot, mood: "cinematic", narration: "" },
    {
      keyframes: true, camera: true, depth: false,
      mask: false, flow: false, normals: false,
      width: 1280, height: 720, fps: FPS,
    }
  )

  const sceneBase64 = Buffer.from(JSON.stringify(sceneConfig)).toString("base64")
  const url = `${HELIX_STRUCTURE_URL}?scene-b64=${encodeURIComponent(sceneBase64)}`

  const browser = await puppeteer.default.launch({
    executablePath: chromePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=swiftshader"],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })

  console.log(`  Loading scene...`)
  await page.goto(url, { waitUntil: "networkidle0" })

  await new Promise(r => setTimeout(r, 2000))

  const totalFrames = shot.durationSeconds * FPS
  const frameDir = `${OUTPUT_DIR}/frames/shot-${index + 1}`
  mkdirSync(frameDir, { recursive: true })

  console.log(`  Capturing ${totalFrames} frames...`)

  await page.evaluate(() => {
    const canvas = document.querySelector("canvas")
    if (canvas) {
      (canvas as any).__video_recorder_capture = true
    }
  })

  for (let f = 0; f < totalFrames; f++) {
    const time = f / FPS
    await page.evaluate((t: number) => {
      const event = new CustomEvent("helix-seek", { detail: { time: t } })
      window.dispatchEvent(event)
    }, time)

    await new Promise(r => setTimeout(r, 100))

    const padded = String(f).padStart(4, "0")
    await page.screenshot({
      path: `${frameDir}/frame-${padded}.png`,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    })
  }

  await browser.close()
  console.log(`  ✓ ${totalFrames} frames captured`)

  return frameDir
}

async function combineFramesToVideo(frameDir: string, shotIndex: number) {
  const outputPath = `${OUTPUT_DIR}/shot-${shotIndex + 1}.mp4`
  execSync(
    `ffmpeg -y -framerate ${FPS} -i ${frameDir}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -vf "scale=640:360" ${outputPath}`,
    { stdio: "ignore" }
  )
  console.log(`  ✓ Video: ${outputPath}`)
  return outputPath
}

async function main() {
  console.log("🎬 HelixStructure Frame Capture")
  console.log("================================")

  const videoFiles: string[] = []

  for (let i = 0; i < shots.length; i++) {
    const frameDir = await renderShotFrames(shots[i], i)
    const videoPath = await combineFramesToVideo(frameDir, i)
    videoFiles.push(videoPath)
  }

  console.log("\nCombining all shots...")
  const concatFile = `${OUTPUT_DIR}/concat.txt`
  const concatContent = videoFiles.map(f => `file '${f.replace(/^\.\//, "")}'`).join("\n")
  require("fs").writeFileSync(concatFile, concatContent)

  const finalOutput = `${OUTPUT_DIR}/helixstructure-complete.mp4`
  execSync(
    `ffmpeg -y -f concat -safe 0 -i ${concatFile} -c copy ${finalOutput}`,
    { stdio: "inherit" }
  )

  console.log(`\n✅ Complete video: ${finalOutput}`)
}

main().catch(console.error)
