import { mkdirSync } from 'fs';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';

const FPS = 15;
const OUTPUT_DIR = './output/helixstructure';
const PORT = 5173;

const scene = {
  scene: {
    width: 1920, height: 1080, depth: 1000,
    background: '#020208',
    showGrid: false,
    camera: { position: [35, 20, 35], fov: 50, target: [0, 0, 0] },
    lighting: {
      ambient: { intensity: 0.5, color: '#aabbcc' },
      main: { position: [20, 30, 20], intensity: 2.5 },
      fill: { position: [-15, 10, -15], intensity: 1 },
    },
  },
  elements: [
    // 舰队
    { id: 'ship-1', shape: 'box', color: '#2255aa', position: [0, 0, 0], scale: [4, 1.4, 2], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    { id: 'ship-2', shape: 'box', color: '#2255aa', position: [-3.5, 0, -1], scale: [3.5, 1.2, 1.8], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    { id: 'ship-3', shape: 'box', color: '#2255aa', position: [3.5, 0, -1], scale: [3.5, 1.2, 1.8], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    // 木星
    { id: 'planet', shape: 'sphere', color: '#cc8855', position: [0, -8, -45], scale: [30, 30, 30], material: { type: 'standard', roughness: 0.9 } },
    // 水滴
    { id: 'droplet', shape: 'sphere', color: '#ffffff', position: [25, 5, 15], scale: [1.2, 1.5, 1.2], material: { type: 'physical', metalness: 1, roughness: 0.01, emissive: '#aaddff', emissiveIntensity: 0.8 } },
    // 碰撞火花粒子
    { id: 'sparks-1', shape: 'particles', position: [0, 0, 0], particles: { count: 50, size: 0.1, color: '#ffaa00', opacity: 0.9, spread: 2, speed: 3, lifetime: 1, loop: false, emitterShape: 'sphere', emitterPosition: [0, 0, 0] } },
    { id: 'sparks-2', shape: 'particles', position: [-3.5, 0, -1], particles: { count: 40, size: 0.08, color: '#ff6600', opacity: 0.8, spread: 1.5, speed: 2.5, lifetime: 0.8, loop: false, emitterShape: 'sphere', emitterPosition: [-3.5, 0, -1] } },
    // 爆炸核心
    { id: 'explosion-1', shape: 'sphere', color: '#ff4400', position: [0, 0, 0], scale: [0.1, 0.1, 0.1], material: { type: 'basic', emissive: '#ff4400', emissiveIntensity: 2 } },
    { id: 'explosion-2', shape: 'sphere', color: '#ff6600', position: [-3.5, 0, -1], scale: [0.1, 0.1, 0.1], material: { type: 'basic', emissive: '#ff6600', emissiveIntensity: 2 } },
    // 残骸碎片
    { id: 'debris-1', shape: 'box', color: '#445566', position: [2, 1, 1], scale: [0.3, 0.2, 0.15], material: { type: 'standard', roughness: 0.8 } },
    { id: 'debris-2', shape: 'box', color: '#445566', position: [-2, 0.5, -2], scale: [0.25, 0.18, 0.12], material: { type: 'standard', roughness: 0.8 } },
    { id: 'debris-3', shape: 'box', color: '#445566', position: [1, -0.5, 2], scale: [0.2, 0.15, 0.1], material: { type: 'standard', roughness: 0.8 } },
  ],
  animation: {
    duration: 10, fps: FPS, loop: false,
    keyframes: [
      // 开场：舰队静止
      { time: 0, elements: [
        { id: 'droplet', position: [25, 5, 15] },
        { id: 'sparks-1', particles: { opacity: 0 } },
        { id: 'sparks-2', particles: { opacity: 0 } },
        { id: 'explosion-1', scale: [0.1, 0.1, 0.1] },
        { id: 'explosion-2', scale: [0.1, 0.1, 0.1] },
      ]},
      // 水滴接近
      { time: 2, elements: [
        { id: 'droplet', position: [12, 3.5, 8] },
      ]},
      // 水滴加速
      { time: 3.5, elements: [
        { id: 'droplet', position: [2, 2.5, 2] },
      ]},
      // 碰撞第一艘！
      { time: 4, elements: [
        { id: 'droplet', position: [0, 2, 0] },
        { id: 'ship-1', rotation: [5, 0, 0] },
        { id: 'sparks-1', particles: { opacity: 1, spread: 3, speed: 5 } },
        { id: 'explosion-1', scale: [2, 2, 2] },
      ]},
      // 穿透
      { time: 5, elements: [
        { id: 'droplet', position: [-4, 1.5, -2] },
        { id: 'ship-1', position: [-2, 3, -1], rotation: [25, 15, 8] },
        { id: 'sparks-1', particles: { opacity: 0.5, spread: 4, speed: 3 } },
        { id: 'explosion-1', scale: [3, 3, 3] },
        { id: 'debris-1', position: [3, 2, 2], rotation: [45, 30, 20] },
        { id: 'debris-2', position: [-3, 1.5, -3], rotation: [-30, -20, -15] },
      ]},
      // 碰撞第二艘！
      { time: 6, elements: [
        { id: 'droplet', position: [-6, 1.2, -3] },
        { id: 'ship-2', rotation: [15, 10, 5] },
        { id: 'sparks-2', particles: { opacity: 1, spread: 3, speed: 5 } },
        { id: 'explosion-2', scale: [2, 2, 2] },
        { id: 'sparks-1', particles: { opacity: 0.2, spread: 5, speed: 2 } },
        { id: 'explosion-1', scale: [4, 4, 4] },
        { id: 'debris-1', position: [5, 3, 3], rotation: [60, 45, 30] },
        { id: 'debris-2', position: [-5, 2.5, -4], rotation: [-45, -30, -20] },
        { id: 'debris-3', position: [2, -1, 3], rotation: [30, 20, 10] },
      ]},
      // 连锁爆炸
      { time: 7.5, elements: [
        { id: 'droplet', position: [-8, 1, -4] },
        { id: 'ship-1', position: [-4, 5, -2], rotation: [40, 25, 15] },
        { id: 'ship-2', position: [-7, 4, -5], rotation: [35, 20, 12] },
        { id: 'ship-3', position: [6, 3, -3], rotation: [20, 12, 8] },
        { id: 'sparks-1', particles: { opacity: 0.1, spread: 6, speed: 1 } },
        { id: 'sparks-2', particles: { opacity: 0.1, spread: 6, speed: 1 } },
        { id: 'explosion-1', scale: [5, 5, 5] },
        { id: 'explosion-2', scale: [4, 4, 4] },
        { id: 'debris-1', position: [8, 5, 5], rotation: [80, 60, 40] },
        { id: 'debris-2', position: [-8, 4, -6], rotation: [-60, -45, -30] },
        { id: 'debris-3', position: [4, -2, 5], rotation: [50, 35, 25] },
      ]},
      // 残骸散落
      { time: 10, elements: [
        { id: 'droplet', position: [0, 4, -2] },
        { id: 'ship-1', position: [-6, 8, -4], rotation: [60, 40, 25] },
        { id: 'ship-2', position: [-10, 7, -8], rotation: [50, 35, 20] },
        { id: 'ship-3', position: [8, 6, -5], rotation: [35, 25, 12] },
        { id: 'sparks-1', particles: { opacity: 0 } },
        { id: 'sparks-2', particles: { opacity: 0 } },
        { id: 'explosion-1', scale: [0.1, 0.1, 0.1] },
        { id: 'explosion-2', scale: [0.1, 0.1, 0.1] },
        { id: 'debris-1', position: [12, 8, 8], rotation: [120, 90, 60] },
        { id: 'debris-2', position: [-12, 6, -10], rotation: [-90, -70, -50] },
        { id: 'debris-3', position: [6, -3, 8], rotation: [70, 50, 35] },
      ]},
    ],
    cameraKeyframes: [
      { time: 0, position: [35, 20, 35], target: [0, 0, 0], fov: 50 },
      { time: 2, position: [22, 14, 22], target: [5, 3, 3], fov: 48 },
      { time: 3.5, position: [12, 10, 15], target: [0, 2.5, 0], fov: 45 },
      { time: 4, position: [5, 8, 10], target: [0, 2, 0], fov: 40 },
      { time: 5, position: [0, 7, 6], target: [-3, 1.5, -1], fov: 42 },
      { time: 6, position: [-3, 8, 4], target: [-6, 1.2, -3], fov: 40 },
      { time: 7.5, position: [-5, 12, 2], target: [-5, 3, -4], fov: 48 },
      { time: 10, position: [-8, 15, 0], target: [-3, 4, -3], fov: 55 },
    ],
  },
  postProcessing: {
    bloom: { enabled: true, intensity: 2, threshold: 0.5 },
    colorGrading: { enabled: true, brightness: 0.1, contrast: 0.2, saturation: 0.15 },
  },
};

async function main() {
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

  const totalFrames = scene.animation.duration * FPS;
  const frameDir = `${OUTPUT_DIR}/frames/effects`;
  mkdirSync(frameDir, { recursive: true });

  console.log(`捕获 ${totalFrames} 帧（含特效）...`);

  for (let f = 0; f < totalFrames; f++) {
    const time = f / FPS;
    await page.evaluate((t) => (window as any).helixControl?.seek(t), time);
    await new Promise(r => setTimeout(r, 150));
    
    const padded = String(f).padStart(4, '0');
    await page.screenshot({ path: `${frameDir}/frame-${padded}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }

  await browser.close();

  execSync(`ffmpeg -y -framerate ${FPS} -i ${frameDir}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:720' ${OUTPUT_DIR}/three-body-effects.mp4`, { stdio: 'ignore' });
  
  execSync(`ffmpeg -y -i ${OUTPUT_DIR}/three-body-effects.mp4 -vf "select=eq(n\\,0)+eq(n\\,45)+eq(n\\,60)+eq(n\\,90)+eq(n\\,120)+eq(n\\,149)" -vsync vfr ${OUTPUT_DIR}/effects-check-%02d.png`, { stdio: 'ignore' });
  
  console.log('Done: three-body-effects.mp4');
}

main().catch(console.error);
