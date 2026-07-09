#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "fs"
import { HelixStructureAdapter } from "../src/renderer/helix-structure-adapter"

const waterdropStoryboard = [
  {
    id: "shot-1", sequence: 1,
    description: "地球舰队在木星轨道列阵，上千艘战舰铺展成庄严的矩阵",
    visualPrompt: "massive human starship fleet in formation near Jupiter, epic scale, cold sci-fi lighting",
    motionPrompt: "slow push-in across the fleet",
    narration: "人类舰队在太空中列阵，庆祝自以为是的胜利。",
    durationSeconds: 10,
  },
  {
    id: "shot-2", sequence: 2,
    description: "水滴从三体方向驶来，完美镜面反射星光",
    visualPrompt: "perfect mirrored teardrop probe floating in deep space, reflection of distant stars, minimalist hard sci-fi",
    motionPrompt: "slow rotation, subtle approach",
    narration: "一颗三体探测器——水滴——缓缓驶来。",
    durationSeconds: 10,
  },
  {
    id: "shot-3", sequence: 3,
    description: "水滴突然加速，冲向最近的一艘战舰",
    visualPrompt: "mirrored probe accelerating impossibly fast toward a futuristic warship, motion blur, silent violence",
    motionPrompt: "high velocity impact trajectory",
    narration: "它光滑如泪滴，反射着恒星冷光。然后它动了。",
    durationSeconds: 8,
  },
  {
    id: "shot-4", sequence: 4,
    description: "水滴穿透战舰装甲，金属如纸般撕裂",
    visualPrompt: "teardrop probe piercing through starship armor, metal tearing like paper, sparks and debris in vacuum",
    motionPrompt: "continuous penetration, camera follows",
    narration: "以人类无法反应的速度，它穿透一艘又一艘战舰。",
    durationSeconds: 10,
  },
  {
    id: "shot-5", sequence: 5,
    description: "核火在真空中无声绽放，多艘战舰连锁爆炸",
    visualPrompt: "nuclear fireballs blooming silently in vacuum, chain reaction of exploding warships, dark space background",
    motionPrompt: "wide shot, slow expansion",
    narration: "核火在真空中无声绽放。",
    durationSeconds: 12,
  },
  {
    id: "shot-6", sequence: 6,
    description: "残骸云中，水滴悬停，表面完好如初",
    visualPrompt: "mirrored teardrop probe hovering untouched amidst debris field of destroyed fleet, serene and terrifying",
    motionPrompt: "slow rotation, pull back to reveal scale",
    narration: "两千艘战舰，在几分钟内化为残骸。这不是战争，是屠杀。",
    durationSeconds: 10,
  },
]

const outputDir = "./output/report-demo"
mkdirSync(`${outputDir}/scene`, { recursive: true })

const motionMap: Record<string, string> = {
  "slow push-in across the fleet": "push-in",
  "slow rotation, subtle approach": "slow-rotation",
  "high velocity impact trajectory": "track",
  "continuous penetration, camera follows": "follow",
  "wide shot, slow expansion": "static",
  "slow rotation, pull back to reveal scale": "pull-back",
}

const sceneConfigs = waterdropStoryboard.map((shot) => {
  const templateId = shot.sequence === 1 ? "space-establishing" :
                    shot.sequence === 2 ? "teardrop-approach" :
                    shot.sequence <= 4 ? "impact-penetration" :
                    shot.sequence === 5 ? "nuclear-bloom" : "debris-reveal"

  const motion = motionMap[shot.motionPrompt] ?? "static"

  const shotIntent = {
    templateId,
    subject: shot.description,
    mood: "cinematic",
    motion,
    durationSeconds: shot.durationSeconds,
    narration: shot.narration,
  }

  const scene = HelixStructureAdapter.toSceneConfig(shotIntent, {
    keyframes: true, camera: true, depth: false,
    mask: false, flow: false, normals: false,
    width: 1280, height: 720, fps: 30,
  })

  writeFileSync(`${outputDir}/scene/shot-${shot.sequence}.json`, JSON.stringify(scene, null, 2))
  return { shot, scene, templateId }
})

const assets = waterdropStoryboard.map((shot) => ({
  id: `asset-${shot.id}`,
  shotId: shot.id,
  controlSignals: {
    shotId: `mock-${shot.id}`,
    prompt: `A cinematic ${shot.durationSeconds}-second shot.`,
    camera: {
      fps: 30,
      durationSeconds: shot.durationSeconds,
      keyframes: sceneConfigs[shot.sequence - 1].scene.animation.cameraKeyframes,
    },
  },
}))

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>CreatorHelix Report - 三体水滴</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e0e0e0; padding: 40px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #00d4ff; margin-bottom: 10px; font-size: 2.5em; }
    h2 { color: #00d4ff; margin: 40px 0 20px; border-bottom: 1px solid #333; padding-bottom: 10px; }
    h3 { color: #88ccff; margin: 20px 0 10px; }
    .meta { color: #888; margin-bottom: 30px; }
    .card { background: #1a1a2e; border-radius: 12px; padding: 24px; margin: 16px 0; border: 1px solid #333; }
    .shot-card { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .scene-preview { background: #000; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 11px; color: #0f0; white-space: pre-wrap; max-height: 350px; overflow-y: auto; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .info-item { background: #0d1117; padding: 12px; border-radius: 8px; }
    .info-label { color: #888; font-size: 0.85em; }
    .info-value { color: #fff; font-size: 1.1em; margin-top: 4px; }
    .keyframe { display: inline-block; background: #1e3a5f; padding: 6px 10px; margin: 3px; border-radius: 6px; font-size: 0.85em; }
    .narration { font-style: italic; color: #aaa; border-left: 3px solid #00d4ff; padding-left: 16px; margin: 12px 0; }
    pre { background: #0d1117; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 0.85em; max-height: 400px; overflow-y: auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 三体水滴袭击地球舰队</h1>
    <div class="meta">
      <span>Project ID: report-demo</span> · 
      <span>Status: ASSET_GENERATION</span> · 
      <span>${assets.length} shots</span>
    </div>

    <h2>📋 Script</h2>
    <div class="card">
      <h3>水滴</h3>
      <p>三体探测器"水滴"以不可思议的速度和硬度，瞬间摧毁地球联合舰队。</p>
      <div class="narration">人类舰队在太空中列阵，庆祝自以为是的胜利。一颗三体探测器——水滴——缓缓驶来。它光滑如泪滴，反射着恒星冷光。然后它动了。以人类无法反应的速度，它穿透一艘又一艘战舰。核火在真空中无声绽放。两千艘战舰，在几分钟内化为残骸。这不是战争，是屠杀。</div>
    </div>

    <h2>🎬 Storyboard (${sceneConfigs.length} shots)</h2>
    ${sceneConfigs.map(({ shot, scene, templateId }) => `
    <div class="card shot-card">
      <div>
        <h3>Shot ${shot.sequence}: ${shot.id}</h3>
        <p style="margin: 8px 0; color: #ccc;">${shot.description}</p>
        <div class="narration">${shot.narration}</div>
        <div class="info-grid" style="margin-top: 16px;">
          <div class="info-item">
            <div class="info-label">Template</div>
            <div class="info-value">${templateId}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Duration</div>
            <div class="info-value">${shot.durationSeconds}s</div>
          </div>
          <div class="info-item">
            <div class="info-label">Elements</div>
            <div class="info-value">${scene.elements.length}</div>
          </div>
        </div>
        <div style="margin-top: 12px;">
          <div class="info-label">Camera Keyframes</div>
          <div style="margin-top: 6px;">
            ${scene.animation.cameraKeyframes.map(kf => `
              <span class="keyframe">t=${kf.time}s [${kf.position?.join(", ")}] fov=${kf.fov}</span>
            `).join('')}
          </div>
        </div>
        <div style="margin-top: 12px;">
          <div class="info-label">Visual Prompt</div>
          <div style="color: #888; font-size: 0.9em;">${shot.visualPrompt}</div>
        </div>
      </div>
      <div class="scene-preview">${JSON.stringify({
        scene: { width: scene.scene.width, height: scene.scene.height, background: scene.scene.background },
        camera: scene.scene.camera,
        elements: scene.elements.map(e => ({ id: e.id, shape: e.shape, color: e.color, pos: e.position })),
        animation: { duration: scene.animation.duration, fps: scene.animation.fps, keyframes: scene.animation.cameraKeyframes }
      }, null, 2)}</div>
    </div>
    `).join('')}

    <h2>🎯 Control Signals (per shot)</h2>
    ${assets.map(a => `
    <div class="card">
      <h3>${a.id}</h3>
      <pre>${JSON.stringify(a.controlSignals, null, 2)}</pre>
    </div>
    `).join('')}

    <h2>📁 Output Files</h2>
    <div class="card">
      <pre>output/report-demo/
├── scene/
${waterdropStoryboard.map(s => `│   ├── shot-${s.sequence}.json`).join('\n')}
├── frames/          (PNG when rendered)
└── report.html      (this file)</pre>
    </div>
  </div>
</body>
</html>`

writeFileSync(`${outputDir}/report.html`, html)
console.log(`✅ Report generated: ${outputDir}/report.html`)
console.log(`📁 Scene files: ${outputDir}/scene/`)
