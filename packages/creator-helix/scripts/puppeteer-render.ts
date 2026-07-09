#!/usr/bin/env bun

import { mkdirSync, writeFileSync, existsSync } from "fs"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"

const HELIX_STRUCTURE_URL = "http://localhost:5176"
const OUTPUT_DIR = "./output/helixstructure"

const shots = [
  { templateId: "space-establishing", motion: "push-in", durationSeconds: 4, subject: "地球舰队在木星轨道列阵" },
  { templateId: "teardrop-approach", motion: "slow-rotation", durationSeconds: 4, subject: "水滴从三体方向驶来" },
  { templateId: "impact-penetration", motion: "track", durationSeconds: 3, subject: "水滴突然加速" },
  { templateId: "impact-penetration", motion: "follow", durationSeconds: 4, subject: "水滴穿透战舰装甲" },
  { templateId: "nuclear-bloom", motion: "static", durationSeconds: 4, subject: "核火在真空中无声绽放" },
  { templateId: "debris-reveal", motion: "pull-back", durationSeconds: 4, subject: "残骸云中，水滴悬停" },
]

mkdirSync(OUTPUT_DIR, { recursive: true })

async function findChromePath(): Promise<string> {
  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error("Chrome not found")
}

async function renderShot(shot: typeof shots[0], index: number) {
  const puppeteer = await import("puppeteer-core")
  const chromePath = await findChromePath()

  console.log(`\nShot ${index + 1}: ${shot.subject}`)

  const sceneConfig = HelixStructureAdapter.toSceneConfig(
    { ...shot, mood: "cinematic", narration: "" },
    {
      keyframes: true, camera: true, depth: false,
      mask: false, flow: false, normals: false,
      width: 1280, height: 720, fps: 30,
    }
  )

  const sceneBase64 = Buffer.from(JSON.stringify(sceneConfig)).toString("base64")
  const url = `${HELIX_STRUCTURE_URL}?scene-b64=${encodeURIComponent(sceneBase64)}&auto-record=true&output=shot-${index + 1}&quality=high`

  const browser = await puppeteer.default.launch({
    executablePath: chromePath,
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })

  console.log(`  Opening ${url.substring(0, 80)}...`)
  await page.goto(url, { waitUntil: "networkidle0" })

  const waitTime = (sceneConfig.animation.duration + 5) * 1000
  console.log(`  Waiting ${waitTime / 1000}s for recording...`)
  await new Promise(r => setTimeout(r, waitTime))

  await browser.close()
  console.log(`  ✓ Shot ${index + 1} done`)
}

async function main() {
  console.log("🎬 HelixStructure Puppeteer Renderer")
  console.log("=====================================")

  for (let i = 0; i < shots.length; i++) {
    await renderShot(shots[i], i)
  }

  console.log("\n✅ All shots rendered!")
  console.log(`📁 Videos: ~/Downloads/shot-*.webm`)
}

main().catch(console.error)
