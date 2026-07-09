import { mkdirSync } from 'fs';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';

const FPS = 24;
const OUTPUT_DIR = './output/helixstructure';
const PORT = 5173;

const scene = {
  scene: {
    width: 1920, height: 1080, depth: 1000,
    background: '#010108',
    showGrid: false,
    camera: { position: [40, 25, 40], fov: 45, target: [0, 0, 0] },
    lighting: {
      ambient: { intensity: 0.4, color: '#8899bb' },
      main: { position: [25, 40, 25], intensity: 3, castShadow: true },
      fill: { position: [-20, 15, -20], intensity: 1.2 },
      rim: { position: [0, -10, -30], intensity: 0.8, color: '#ffaa66' },
    },
  },
  elements: [
    // 主舰队 - 三艘主力舰呈三角阵型
    { id: 'flagship', shape: 'box', color: '#1a3366', position: [0, 0, 0], scale: [6, 2, 3], material: { type: 'physical', metalness: 0.85, roughness: 0.15, emissive: '#0a1530', emissiveIntensity: 0.2 } },
    { id: 'cruiser-1', shape: 'box', color: '#1a3366', position: [-5, 0, -2], scale: [4.5, 1.5, 2.5], material: { type: 'physical', metalness: 0.85, roughness: 0.15, emissive: '#0a1530', emissiveIntensity: 0.2 } },
    { id: 'cruiser-2', shape: 'box', color: '#1a3366', position: [5, 0, -2], scale: [4.5, 1.5, 2.5], material: { type: 'physical', metalness: 0.85, roughness: 0.15, emissive: '#0a1530', emissiveIntensity: 0.2 } },
    // 护卫舰
    { id: 'escort-1', shape: 'box', color: '#2a4477', position: [-3, 0.5, -4], scale: [3, 1, 1.5], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    { id: 'escort-2', shape: 'box', color: '#2a4477', position: [3, 0.5, -4], scale: [3, 1, 1.5], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    // 木星 - 巨大背景
    { id: 'jupiter', shape: 'sphere', color: '#cc8855', position: [0, -15, -60], scale: [50, 50, 50], material: { type: 'standard', roughness: 0.85, metalness: 0.1 } },
    // 水滴探测器 - 小而致命
    { id: 'droplet', shape: 'sphere', color: '#ffffff', position: [30, 8, 20], scale: [1, 1.3, 1], material: { type: 'physical', metalness: 1, roughness: 0.01, emissive: '#aaddff', emissiveIntensity: 1 } },
    // 爆炸效果 - 碰撞时出现
    { id: 'explosion-1', shape: 'sphere', color: '#ff6600', position: [0, 0, 0], scale: [0.1, 0.1, 0.1], material: { type: 'basic', emissive: '#ff4400', emissiveIntensity: 4 } },
    { id: 'explosion-2', shape: 'sphere', color: '#ff8800', position: [-5, 0, -2], scale: [0.1, 0.1, 0.1], material: { type: 'basic', emissive: '#ff6600', emissiveIntensity: 4 } },
    // 残骸碎片
    { id: 'debris-1', shape: 'box', color: '#334455', position: [2, 1, 1], scale: [0.4, 0.25, 0.2], material: { type: 'standard', roughness: 0.9 } },
    { id: 'debris-2', shape: 'box', color: '#334455', position: [-2, 0.8, -2], scale: [0.35, 0.2, 0.15], material: { type: 'standard', roughness: 0.9 } },
    { id: 'debris-3', shape: 'box', color: '#334455', position: [1, -0.3, 2], scale: [0.3, 0.18, 0.12], material: { type: 'standard', roughness: 0.9 } },
    // 星光背景
    { id: 'star-1', shape: 'sphere', color: '#ffffff', position: [60, 40, -40], scale: [0.6, 0.6, 0.6], material: { type: 'basic' } },
    { id: 'star-2', shape: 'sphere', color: '#ffffff', position: [-50, 35, -35], scale: [0.4, 0.4, 0.4], material: { type: 'basic' } },
    { id: 'star-3', shape: 'sphere', color: '#ffffff', position: [40, 50, -50], scale: [0.5, 0.5, 0.5], material: { type: 'basic' } },
  ],
  animation: {
    duration: 12, fps: FPS, loop: false,
    keyframes: [
      // 开场：舰队静止，水滴在远处
      { time: 0, elements: [
        { id: 'droplet', position: [30, 8, 20] },
        { id: 'explosion-1', scale: [0.1, 0.1, 0.1] },
        { id: 'explosion-2', scale: [0.1, 0.1, 0.1] },
      ]},
      // 水滴接近
      { time: 2.5, elements: [
        { id: 'droplet', position: [15, 5, 10] },
      ]},
      // 水滴加速
      { time: 4, elements: [
        { id: 'droplet', position: [5, 3, 3] },
      ]},
      // 碰撞旗舰！
      { time: 5, elements: [
        { id: 'droplet', position: [0, 2, 0] },
        { id: 'flagship', rotation: [8, 0, 0] },
        { id: 'explosion-1', scale: [3, 3, 3] },
        { id: 'debris-1', position: [3, 2, 2], rotation: [45, 30, 20] },
      ]},
      // 穿透
      { time: 6, elements: [
        { id: 'droplet', position: [-4, 1.5, -2] },
        { id: 'flagship', position: [-2, 4, -1], rotation: [30, 18, 10] },
        { id: 'explosion-1', scale: [5, 5, 5] },
        { id: 'debris-1', position: [5, 4, 4], rotation: [70, 50, 30] },
        { id: 'debris-2', position: [-4, 3, -3], rotation: [-50, -35, -20] },
      ]},
      // 碰撞巡洋舰！
      { time: 7.5, elements: [
        { id: 'droplet', position: [-6, 1, -3] },
        { id: 'cruiser-1', rotation: [20, 12, 8] },
        { id: 'explosion-2', scale: [3, 3, 3] },
        { id: 'debris-2', position: [-7, 5, -5], rotation: [-70, -50, -30] },
        { id: 'debris-3', position: [4, 2, 3], rotation: [40, 25, 15] },
      ]},
      // 连锁爆炸
      { time: 9, elements: [
        { id: 'droplet', position: [-10, 0.5, -5] },
        { id: 'flagship', position: [-5, 7, -3], rotation: [50, 35, 20] },
        { id: 'cruiser-1', position: [-9, 6, -7], rotation: [45, 30, 15] },
        { id: 'cruiser-2', position: [8, 5, -4], rotation: [25, 15, 10] },
        { id: 'escort-1', position: [-5, 4, -6], rotation: [20, 12, 8] },
        { id: 'escort-2', position: [5, 4, -6], rotation: [-20, -12, -8] },
        { id: 'explosion-1', scale: [6, 6, 6] },
        { id: 'explosion-2', scale: [5, 5, 5] },
        { id: 'debris-1', position: [10, 8, 8], rotation: [100, 80, 50] },
        { id: 'debris-2', position: [-12, 7, -10], rotation: [-80, -60, -40] },
        { id: 'debris-3', position: [6, 3, 6], rotation: [60, 40, 25] },
      ]},
      // 残骸散落，水滴悬停
      { time: 12, elements: [
        { id: 'droplet', position: [0, 5, -2] },
        { id: 'flagship', position: [-8, 12, -6], rotation: [70, 50, 30] },
        { id: 'cruiser-1', position: [-15, 10, -12], rotation: [60, 45, 25] },
        { id: 'cruiser-2', position: [12, 9, -8], rotation: [45, 30, 18] },
        { id: 'escort-1', position: [-8, 7, -10], rotation: [35, 25, 12] },
        { id: 'escort-2', position: [8, 7, -10], rotation: [-35, -25, -12] },
        { id: 'explosion-1', scale: [0.1, 0.1, 0.1] },
        { id: 'explosion-2', scale: [0.1, 0.1, 0.1] },
        { id: 'debris-1', position: [15, 12, 12], rotation: [150, 120, 80] },
        { id: 'debris-2', position: [-18, 10, -15], rotation: [-120, -90, -60] },
        { id: 'debris-3', position: [8, 5, 10], rotation: [90, 60, 40] },
      ]},
    ],
    cameraKeyframes: [
      // 开场：远景俯视舰队
      { time: 0, position: [40, 25, 40], target: [0, 0, 0], fov: 45 },
      // 水滴接近：跟随
      { time: 2.5, position: [25, 18, 25], target: [10, 5, 5], fov: 42 },
      // 加速：拉近
      { time: 4, position: [12, 12, 15], target: [0, 3, 0], fov: 38 },
      // 碰撞：特写
      { time: 5, position: [5, 8, 10], target: [0, 2, 0], fov: 35 },
      // 穿透：侧面跟随
      { time: 6, position: [-2, 7, 6], target: [-4, 1.5, -2], fov: 38 },
      // 碰撞第二艘：拉远
      { time: 7.5, position: [-5, 10, 4], target: [-6, 1, -3], fov: 42 },
      // 连锁爆炸：全景
      { time: 9, position: [-8, 15, 2], target: [-5, 3, -4], fov: 50 },
      // 残骸：环绕展示
      { time: 12, position: [5, 18, 10], target: [0, 5, -3], fov: 55 },
    ],
  },
  postProcessing: {
    bloom: { enabled: true, intensity: 2.5, threshold: 0.4 },
    colorGrading: { enabled: true, brightness: 0.15, contrast: 0.3, saturation: 0.2 },
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
  const frameDir = `${OUTPUT_DIR}/frames/optimized`;
  mkdirSync(frameDir, { recursive: true });

  console.log(`捕获 ${totalFrames} 帧（优化版）...`);

  for (let f = 0; f < totalFrames; f++) {
    const time = f / FPS;
    await page.evaluate((t) => (window as any).helixControl?.seek(t), time);
    await new Promise(r => setTimeout(r, 100));
    
    const padded = String(f).padStart(4, '0');
    await page.screenshot({ path: `${frameDir}/frame-${padded}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }

  await browser.close();

  execSync(`ffmpeg -y -framerate ${FPS} -i ${frameDir}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:720' ${OUTPUT_DIR}/three-body-optimized.mp4`, { stdio: 'ignore' });
  
  execSync(`ffmpeg -y -i ${OUTPUT_DIR}/three-body-optimized.mp4 -vf "select=eq(n\\,0)+eq(n\\,60)+eq(n\\,120)+eq(n\\,180)+eq(n\\,240)+eq(n\\,287)" -vsync vfr ${OUTPUT_DIR}/opt-%02d.png`, { stdio: 'ignore' });
  
  console.log('Done: three-body-optimized.mp4');
}

main().catch(console.error);
