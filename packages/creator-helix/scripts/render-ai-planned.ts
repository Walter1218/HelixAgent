import { mkdirSync } from 'fs';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';
import { Effect } from 'effect';
import { AnimationPlanner } from '../src/renderer/animation-planner';

const FPS = 15;
const OUTPUT_DIR = './output/helixstructure';
const PORT = 5173;

// 分镜定义
const storyboard = [
  { templateId: 'space-establishing', durationSeconds: 3, subject: '地球舰队在木星轨道列阵' },
  { templateId: 'teardrop-approach', durationSeconds: 2, subject: '水滴从远处接近舰队' },
  { templateId: 'impact-penetration', durationSeconds: 2, subject: '水滴高速穿透战舰' },
  { templateId: 'debris-reveal', durationSeconds: 2, subject: '水滴悬停在残骸中' },
];

async function main() {
  console.log('规划动画轨迹...');
  
  // 使用 LLM 规划动画（简化版本，直接生成）
  const animationPlan = {
    cameraKeyframes: [
      { time: 0, position: [35, 20, 35], target: [0, 0, 0], fov: 50 },
      { time: 3, position: [20, 12, 20], target: [0, 0, 0], fov: 45 },
      { time: 5, position: [10, 8, 12], target: [0, 2, 0], fov: 40 },
      { time: 7, position: [0, 6, 8], target: [-3, 1.5, -1], fov: 38 },
      { time: 9, position: [-5, 10, 5], target: [-5, 2, -2], fov: 45 },
    ],
    elementKeyframes: [
      { time: 0, elements: [{ id: 'droplet', position: [25, 5, 15] }] },
      { time: 2, elements: [{ id: 'droplet', position: [15, 4, 10] }] },
      { time: 3, elements: [{ id: 'droplet', position: [5, 3, 5] }] },
      { time: 4, elements: [{ id: 'droplet', position: [0, 2.5, 0] }] },
      { time: 5, elements: [
        { id: 'droplet', position: [-3, 2, -1.5] },
        { id: 'ship-1', rotation: [10, 0, 0] },
      ]},
      { time: 6, elements: [
        { id: 'droplet', position: [-6, 1.5, -3] },
        { id: 'ship-1', position: [-2, 3, -1], rotation: [25, 15, 8] },
        { id: 'ship-2', rotation: [10, 8, 4] },
      ]},
      { time: 7, elements: [
        { id: 'droplet', position: [-8, 1, -4] },
        { id: 'ship-1', position: [-4, 5, -2], rotation: [40, 25, 15] },
        { id: 'ship-2', position: [-7, 4, -5], rotation: [30, 20, 10] },
      ]},
      { time: 9, elements: [
        { id: 'droplet', position: [-5, 3, -2] },
        { id: 'ship-1', position: [-6, 8, -4], rotation: [60, 40, 25] },
        { id: 'ship-2', position: [-10, 7, -8], rotation: [50, 35, 20] },
        { id: 'ship-3', position: [8, 6, -5], rotation: [35, 25, 12] },
      ]},
    ],
  };

  const totalDuration = storyboard.reduce((sum, s) => sum + s.durationSeconds, 0);

  // 构建场景配置
  const scene = {
    scene: {
      width: 1920, height: 1080, depth: 1000,
      background: '#020208',
      showGrid: false,
      camera: { position: [35, 20, 35], fov: 50, target: [0, 0, 0] },
      lighting: {
        ambient: { intensity: 0.6, color: '#aabbcc' },
        main: { position: [20, 30, 20], intensity: 2.5 },
        fill: { position: [-15, 10, -15], intensity: 1 },
      },
    },
    elements: [
      { id: 'ship-1', shape: 'box', color: '#2255aa', position: [0, 0, 0], scale: [4, 1.4, 2], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
      { id: 'ship-2', shape: 'box', color: '#2255aa', position: [-3.5, 0, -1], scale: [3.5, 1.2, 1.8], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
      { id: 'ship-3', shape: 'box', color: '#2255aa', position: [3.5, 0, -1], scale: [3.5, 1.2, 1.8], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
      { id: 'planet', shape: 'sphere', color: '#cc8855', position: [0, -8, -45], scale: [30, 30, 30], material: { type: 'standard', roughness: 0.9 } },
      { id: 'droplet', shape: 'sphere', color: '#ffffff', position: [25, 5, 15], scale: [1.2, 1.5, 1.2], material: { type: 'physical', metalness: 1, roughness: 0.01, emissive: '#aaddff', emissiveIntensity: 0.8 } },
    ],
    animation: {
      duration: totalDuration,
      fps: FPS,
      loop: false,
      keyframes: animationPlan.elementKeyframes,
      cameraKeyframes: animationPlan.cameraKeyframes,
    },
    postProcessing: {
      bloom: { enabled: true, intensity: 1.5, threshold: 0.7 },
    },
  };

  console.log('渲染中...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const b64 = Buffer.from(JSON.stringify(scene)).toString('base64');
  const url = `http://localhost:${PORT}?scene-b64=${encodeURIComponent(b64)}&hide-ui=true`;

  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));

  const totalFrames = totalDuration * FPS;
  const frameDir = `${OUTPUT_DIR}/frames/ai-planned`;
  mkdirSync(frameDir, { recursive: true });

  console.log(`捕获 ${totalFrames} 帧...`);

  for (let f = 0; f < totalFrames; f++) {
    const time = f / FPS;
    await page.evaluate((t) => (window as any).helixControl?.seek(t), time);
    await new Promise(r => setTimeout(r, 150));
    
    const padded = String(f).padStart(4, '0');
    await page.screenshot({ path: `${frameDir}/frame-${padded}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }

  await browser.close();

  execSync(`ffmpeg -y -framerate ${FPS} -i ${frameDir}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:720' ${OUTPUT_DIR}/three-body-ai-planned.mp4`, { stdio: 'ignore' });
  
  execSync(`ffmpeg -y -i ${OUTPUT_DIR}/three-body-ai-planned.mp4 -vf "select=eq(n\\,0)+eq(n\\,30)+eq(n\\,60)+eq(n\\,90)+eq(n\\,120)" -vsync vfr ${OUTPUT_DIR}/ai-check-%02d.png`, { stdio: 'ignore' });
  
  console.log('Done: three-body-ai-planned.mp4');
}

main().catch(console.error);
