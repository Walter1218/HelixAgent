#!/usr/bin/env bun

import { mkdirSync, writeFileSync, existsSync } from "fs"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"
import { HeadlessRenderer } from "../src/renderer/headless-renderer"

const waterdropStoryboard = [
  { id: "shot-1", sequence: 1, templateId: "space-establishing", motion: "push-in", durationSeconds: 10,
    description: "地球舰队在木星轨道列阵", narration: "人类舰队在太空中列阵，庆祝自以为是的胜利。" },
  { id: "shot-2", sequence: 2, templateId: "teardrop-approach", motion: "slow-rotation", durationSeconds: 10,
    description: "水滴从三体方向驶来", narration: "一颗三体探测器——水滴——缓缓驶来。" },
  { id: "shot-3", sequence: 3, templateId: "impact-penetration", motion: "track", durationSeconds: 8,
    description: "水滴突然加速", narration: "它光滑如泪滴，反射着恒星冷光。然后它动了。" },
  { id: "shot-4", sequence: 4, templateId: "impact-penetration", motion: "follow", durationSeconds: 10,
    description: "水滴穿透战舰装甲", narration: "以人类无法反应的速度，它穿透一艘又一艘战舰。" },
  { id: "shot-5", sequence: 5, templateId: "nuclear-bloom", motion: "static", durationSeconds: 12,
    description: "核火在真空中无声绽放", narration: "核火在真空中无声绽放。" },
  { id: "shot-6", sequence: 6, templateId: "debris-reveal", motion: "pull-back", durationSeconds: 10,
    description: "残骸云中，水滴悬停", narration: "两千艘战舰，在几分钟内化为残骸。这不是战争，是屠杀。" },
]

const outputDir = "./output/report-demo"

async function renderAll() {
  for (const shot of waterdropStoryboard) {
    console.log(`Rendering shot ${shot.sequence}...`)

    const shotIntent = {
      templateId: shot.templateId,
      subject: shot.description,
      mood: "cinematic",
      motion: shot.motion,
      durationSeconds: shot.durationSeconds,
      narration: shot.narration,
    }

    const sceneConfig = HelixStructureAdapter.toSceneConfig(shotIntent, {
      keyframes: true, camera: true, depth: false,
      mask: false, flow: false, normals: false,
      width: 1280, height: 720, fps: 30,
    })

    const framesDir = `${outputDir}/frames/shot-${shot.sequence}`
    mkdirSync(framesDir, { recursive: true })

    const totalFrames = Math.min(5, Math.ceil(sceneConfig.animation.duration * 2))
    const fps = 2

    for (let i = 0; i < totalFrames; i++) {
      const t = i / totalFrames
      const scaledT = t * (sceneConfig.animation.cameraKeyframes.length - 1)
      const idx = Math.floor(scaledT)
      const frac = scaledT - idx
      const from = sceneConfig.animation.cameraKeyframes[Math.min(idx, sceneConfig.animation.cameraKeyframes.length - 1)]
      const to = sceneConfig.animation.cameraKeyframes[Math.min(idx + 1, sceneConfig.animation.cameraKeyframes.length - 1)]

      const position = from.position && to.position
        ? [
            from.position[0] + (to.position[0] - from.position[0]) * frac,
            from.position[1] + (to.position[1] - from.position[1]) * frac,
            from.position[2] + (to.position[2] - from.position[2]) * frac,
          ]
        : from.position

      const frameData = {
        frame: i,
        time: t * sceneConfig.animation.duration,
        width: sceneConfig.scene.width,
        height: sceneConfig.scene.height,
        background: sceneConfig.scene.background,
        camera: {
          position,
          fov: from.fov,
          target: from.target,
        },
        elements: sceneConfig.elements.map(e => ({
          id: e.id,
          shape: e.shape,
          color: e.color,
          position: e.position,
          scale: e.scale,
        })),
        lighting: sceneConfig.scene.lighting,
      }

      writeFileSync(`${framesDir}/frame-${String(i).padStart(3, "0")}.json`, JSON.stringify(frameData, null, 2))
    }

    console.log(`  ✓ ${totalFrames} frames written to ${framesDir}`)
  }

  console.log(`\n✅ Done! Generated ${waterdropStoryboard.length * 5} frame files`)
  console.log(`📁 Output: ${outputDir}/frames/`)
}

renderAll().catch(console.error)
