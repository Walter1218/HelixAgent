#!/usr/bin/env bun

import { mkdirSync, writeFileSync, readFileSync } from "fs"
import { execSync } from "child_process"
import sharp from "sharp"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"

const shots = [
  { templateId: "space-establishing", motion: "push-in", durationSeconds: 4, subject: "地球舰队在木星轨道列阵" },
  { templateId: "teardrop-approach", motion: "slow-rotation", durationSeconds: 4, subject: "水滴从三体方向驶来" },
  { templateId: "impact-penetration", motion: "track", durationSeconds: 3, subject: "水滴突然加速" },
  { templateId: "impact-penetration", motion: "follow", durationSeconds: 4, subject: "水滴穿透战舰装甲" },
  { templateId: "nuclear-bloom", motion: "static", durationSeconds: 4, subject: "核火在真空中无声绽放" },
  { templateId: "debris-reveal", motion: "pull-back", durationSeconds: 4, subject: "残骸云中，水滴悬停" },
]

const FPS = 10
const WIDTH = 640
const HEIGHT = 360

mkdirSync("./output/video/frames", { recursive: true })

function generateFrameSVG(
  scene: ReturnType<typeof HelixStructureAdapter.toSceneConfig>,
  time: number,
  totalDuration: number,
  subject: string
): string {
  const t = time / totalDuration
  const kf = scene.animation.cameraKeyframes

  let camX = 20, camY = 8, camZ = 20
  if (kf.length > 1) {
    const scaledT = t * (kf.length - 1)
    const idx = Math.floor(scaledT)
    const frac = scaledT - idx
    const from = kf[Math.min(idx, kf.length - 1)]
    const to = kf[Math.min(idx + 1, kf.length - 1)]
    if (from.position && to.position) {
      camX = from.position[0] + (to.position[0] - from.position[0]) * frac
      camY = from.position[1] + (to.position[1] - from.position[1]) * frac
      camZ = from.position[2] + (to.position[2] - from.position[2]) * frac
    }
  }

  const project = (x: number, y: number, z: number) => {
    const scale = 200 / (z + 50)
    return { px: 320 + x * scale, py: 180 - y * scale, s: scale }
  }

  const elements = scene.elements.map(el => {
    const relX = el.position[0] - camX
    const relY = el.position[1] - camY
    const relZ = el.position[2] - camZ + 50
    const { px, py, s } = project(relX, relY, relZ)
    const size = (el.scale?.[0] ?? 1) * s * 0.8

    if (el.shape === "sphere") {
      return `<circle cx="${px}" cy="${py}" r="${size}" fill="${el.color}" opacity="0.9"/>`
    }
    return `<rect x="${px - size/2}" y="${py - size/2}" width="${size}" height="${size * (el.scale?.[2] ?? 1)}" fill="${el.color}" rx="2"/>`
  }).join("\n    ")

  const gridLines = [
    ...Array.from({length: 17}, (_, j) => `<line x1="${j*40}" y1="0" x2="${j*40}" y2="360"/>`),
    ...Array.from({length: 10}, (_, j) => `<line x1="0" y1="${j*40}" x2="640" y2="${j*40}"/>`),
  ].join("\n    ")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${scene.scene.background}"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <g stroke="#1a3a5a" stroke-width="0.5" opacity="0.3">
    ${gridLines}
  </g>
  <g>
    ${elements}
  </g>
  <text x="20" y="28" fill="#00d4ff" font-family="monospace" font-size="14" font-weight="bold">${subject}</text>
  <text x="20" y="48" fill="#888" font-family="monospace" font-size="11">Cam: [${camX.toFixed(1)}, ${camY.toFixed(1)}, ${camZ.toFixed(1)}]</text>
  <text x="20" y="65" fill="#555" font-family="monospace" font-size="10">Time: ${time.toFixed(2)}s / ${totalDuration}s</text>
</svg>`
}

async function renderAll() {
  let frameIndex = 0

  for (let shotIdx = 0; shotIdx < shots.length; shotIdx++) {
    const shot = shots[shotIdx]
    console.log(`Shot ${shotIdx + 1}: ${shot.subject} (${shot.durationSeconds}s)`)

    const scene = HelixStructureAdapter.toSceneConfig(
      { ...shot, mood: "cinematic", narration: "" },
      { keyframes: true, camera: true, depth: false, mask: false, flow: false, normals: false, width: WIDTH, height: HEIGHT, fps: FPS }
    )

    const totalFrames = shot.durationSeconds * FPS

    for (let f = 0; f < totalFrames; f++) {
      const time = f / FPS
      const svg = generateFrameSVG(scene, time, shot.durationSeconds, shot.subject)
      const padded = String(frameIndex).padStart(5, "0")

      await sharp(Buffer.from(svg)).png().toFile(`./output/video/frames/frame-${padded}.png`)
      frameIndex++
    }

    console.log(`  ✓ ${totalFrames} frames`)
  }

  console.log(`\nTotal frames: ${frameIndex}`)
  console.log("Combining to video with ffmpeg...")

  execSync(`ffmpeg -y -framerate ${FPS} -i ./output/video/frames/frame-%05d.png -c:v libx264 -pix_fmt yuv420p ./output/video/helix-structure.mp4`, {
    stdio: "inherit",
  })

  console.log(`\n✅ Video: ./output/video/helix-structure.mp4`)
}

renderAll().catch(console.error)
