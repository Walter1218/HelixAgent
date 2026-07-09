#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "fs"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"

const shots = [
  { templateId: "space-establishing", motion: "push-in", durationSeconds: 10, subject: "地球舰队在木星轨道列阵" },
  { templateId: "teardrop-approach", motion: "slow-rotation", durationSeconds: 10, subject: "水滴从三体方向驶来" },
  { templateId: "impact-penetration", motion: "track", durationSeconds: 8, subject: "水滴突然加速" },
  { templateId: "impact-penetration", motion: "follow", durationSeconds: 10, subject: "水滴穿透战舰装甲" },
  { templateId: "nuclear-bloom", motion: "static", durationSeconds: 12, subject: "核火在真空中无声绽放" },
  { templateId: "debris-reveal", motion: "pull-back", durationSeconds: 10, subject: "残骸云中，水滴悬停" },
]

mkdirSync("./output/report-demo/rendered", { recursive: true })

shots.forEach((shot, i) => {
  const scene = HelixStructureAdapter.toSceneConfig(
    { ...shot, mood: "cinematic", narration: "" },
    { keyframes: true, camera: true, depth: false, mask: false, flow: false, normals: false, width: 640, height: 360, fps: 30 }
  )

  const elements = scene.elements.map(el => {
    const x = 320 + el.position[0] * 15
    const y = 180 - el.position[1] * 15
    const size = (el.scale?.[0] ?? 1) * 20
    if (el.shape === "sphere") {
      return `<circle cx="${x}" cy="${y}" r="${size}" fill="${el.color}" opacity="0.9"/>`
    }
    return `<rect x="${x - size/2}" y="${y - size/2}" width="${size}" height="${size * (el.scale?.[2] ?? 1)}" fill="${el.color}" rx="2"/>`
  }).join("\n    ")

  const kf = scene.animation.cameraKeyframes
  const camInfo = kf.length > 0
    ? `Camera: [${kf[0].position?.join(", ")}] → [${kf[kf.length-1].position?.join(", ")}] | FOV: ${kf[0].fov}`
    : ""

  const gridLines = [
    ...Array.from({length: 17}, (_, j) => `<line x1="${j*40}" y1="0" x2="${j*40}" y2="360"/>`),
    ...Array.from({length: 10}, (_, j) => `<line x1="0" y1="${j*40}" x2="640" y2="${j*40}"/>`),
  ].join("\n    ")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${scene.scene.background}"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <g stroke="#1a3a5a" stroke-width="0.5" opacity="0.3">
    ${gridLines}
  </g>
  <g>
    ${elements}
  </g>
  <text x="20" y="28" fill="#00d4ff" font-family="monospace" font-size="13">${shot.subject}</text>
  <text x="20" y="48" fill="#666" font-family="monospace" font-size="11">${camInfo}</text>
  <text x="20" y="65" fill="#444" font-family="monospace" font-size="10">Duration: ${shot.durationSeconds}s | Template: ${shot.templateId}</text>
</svg>`

  writeFileSync(`./output/report-demo/rendered/shot-${i+1}.svg`, svg)
  console.log(`✅ shot-${i+1}.svg`)
})

console.log(`\n📁 Output: ./output/report-demo/rendered/`)
