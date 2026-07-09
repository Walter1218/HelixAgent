#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "fs"
import { execSync } from "child_process"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"

const HELIX_STRUCTURE_URL = "http://localhost:5176"

const shots = [
  { templateId: "space-establishing", motion: "push-in", durationSeconds: 5, subject: "地球舰队在木星轨道列阵" },
  { templateId: "teardrop-approach", motion: "slow-rotation", durationSeconds: 5, subject: "水滴从三体方向驶来" },
  { templateId: "impact-penetration", motion: "track", durationSeconds: 4, subject: "水滴突然加速" },
  { templateId: "impact-penetration", motion: "follow", durationSeconds: 5, subject: "水滴穿透战舰装甲" },
  { templateId: "nuclear-bloom", motion: "static", durationSeconds: 5, subject: "核火在真空中无声绽放" },
  { templateId: "debris-reveal", motion: "pull-back", durationSeconds: 5, subject: "残骸云中，水滴悬停" },
]

mkdirSync("./output/helixstructure", { recursive: true })

async function generateShotVideo(shot: typeof shots[0], index: number) {
  console.log(`\nShot ${index + 1}: ${shot.subject}`)

  const sceneConfig = HelixStructureAdapter.toSceneConfig(
    { ...shot, mood: "cinematic", narration: "" },
    {
      keyframes: true, camera: true, depth: false,
      mask: false, flow: false, normals: false,
      width: 1280, height: 720, fps: 30,
    }
  )

  const sceneJson = JSON.stringify(sceneConfig)
  const sceneBase64 = Buffer.from(sceneJson).toString("base64")
  const outputName = `shot-${index + 1}`

  const url = `${HELIX_STRUCTURE_URL}?scene-b64=${encodeURIComponent(sceneBase64)}&auto-record=true&output=${outputName}&quality=high`

  console.log(`  URL length: ${url.length} chars`)
  console.log(`  Opening browser...`)

  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  execSync(`${openCmd} "${url}"`, { stdio: "ignore" })

  const waitTime = (sceneConfig.animation.duration + 3) * 1000
  console.log(`  Waiting ${waitTime/1000}s for recording...`)
  await new Promise(r => setTimeout(r, waitTime))

  console.log(`  ✓ Shot ${index + 1} recording triggered`)
}

async function main() {
  console.log("🎬 HelixStructure Video Renderer")
  console.log("================================")
  console.log(`Dev server: ${HELIX_STRUCTURE_URL}`)
  console.log(`Shots: ${shots.length}`)

  for (let i = 0; i < shots.length; i++) {
    await generateShotVideo(shots[i], i)
  }

  console.log("\n✅ All recordings triggered!")
  console.log("\n📁 Videos will be downloaded to your Downloads folder")
  console.log("   Look for: shot-1.webm, shot-2.webm, etc.")
  console.log("\n💡 To combine them into one video:")
  console.log("   ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4")
}

main().catch(console.error)
