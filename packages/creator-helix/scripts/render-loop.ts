import { mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';

const FPS = 15;
const OUTPUT_DIR = './output/helixstructure';
const PORT = 5173;

async function renderScene(scene: any, name: string) {
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

  await page.evaluate(() => (window as any).helixControl?.play());
  await new Promise(r => setTimeout(r, 300));

  const totalFrames = scene.animation.duration * FPS;
  const frameDir = `${OUTPUT_DIR}/frames/${name}`;
  mkdirSync(frameDir, { recursive: true });

  for (let f = 0; f < totalFrames; f++) {
    await new Promise(r => setTimeout(r, 1000 / FPS));
    const padded = String(f).padStart(4, '0');
    await page.screenshot({ path: `${frameDir}/frame-${padded}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }

  await browser.close();

  execSync(`ffmpeg -y -framerate ${FPS} -i ${frameDir}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:720' ${OUTPUT_DIR}/${name}.mp4`, { stdio: 'ignore' });
  
  // 抽帧验证
  execSync(`ffmpeg -y -i ${OUTPUT_DIR}/${name}.mp4 -vf "select=eq(n\\,0)+eq(n\\,30)+eq(n\\,60)+eq(n\\,${totalFrames-1})" -vsync vfr ${OUTPUT_DIR}/${name}-check-%02d.png`, { stdio: 'ignore' });
  
  return `${OUTPUT_DIR}/${name}.mp4`;
}

// 迭代1：基础场景
const scene1 = {
  scene: {
    width: 1920, height: 1080, depth: 1000,
    background: '#020208',
    showGrid: false,
    camera: { position: [25, 12, 25], fov: 50, target: [0, 0, 0] },
    lighting: {
      ambient: { intensity: 0.5, color: '#aabbcc' },
      main: { position: [15, 25, 15], intensity: 2.5 },
      fill: { position: [-10, 8, -10], intensity: 0.8 },
    },
  },
  elements: [
    { id: 'ship-1', shape: 'box', color: '#2255aa', position: [0, 0, 0], scale: [6, 2, 3], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    { id: 'ship-2', shape: 'box', color: '#2255aa', position: [-5, 0, -2], scale: [5, 1.5, 2.5], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    { id: 'ship-3', shape: 'box', color: '#2255aa', position: [5, 0, -2], scale: [5, 1.5, 2.5], material: { type: 'physical', metalness: 0.8, roughness: 0.2 } },
    { id: 'planet', shape: 'sphere', color: '#cc8855', position: [0, -8, -35], scale: [20, 20, 20], material: { type: 'standard', roughness: 0.9 } },
    { id: 'droplet', shape: 'sphere', color: '#ffffff', position: [20, 4, 12], scale: [1, 1.2, 1], material: { type: 'physical', metalness: 1, roughness: 0.01, emissive: '#aaddff', emissiveIntensity: 0.6 } },
  ],
  animation: {
    duration: 8, fps: FPS, loop: false,
    keyframes: [
      { time: 0, elements: [{ id: 'droplet', position: [20, 4, 12] }] },
      { time: 2, elements: [{ id: 'droplet', position: [10, 3, 6] }] },
      { time: 3.5, elements: [{ id: 'droplet', position: [0, 2, 0] }] },
      { time: 4.5, elements: [
        { id: 'droplet', position: [-4, 1.5, -2] },
        { id: 'ship-1', position: [0, 0, 0], rotation: [10, 0, 0] },
      ]},
      { time: 6, elements: [
        { id: 'droplet', position: [-8, 1, -3] },
        { id: 'ship-1', position: [-2, 3, -1], rotation: [25, 12, 8] },
        { id: 'ship-2', position: [-7, 2, -3], rotation: [12, 8, 4] },
      ]},
      { time: 8, elements: [
        { id: 'droplet', position: [-12, 0.5, -5] },
        { id: 'ship-1', position: [-5, 5, -3], rotation: [40, 25, 15] },
        { id: 'ship-2', position: [-10, 4, -6], rotation: [30, 18, 10] },
        { id: 'ship-3', position: [8, 3, -4], rotation: [18, 10, 6] },
      ]},
    ],
    cameraKeyframes: [
      { time: 0, position: [25, 12, 25], target: [0, 0, 0], fov: 50 },
      { time: 2, position: [15, 8, 15], target: [5, 2, 3], fov: 45 },
      { time: 3.5, position: [8, 6, 10], target: [0, 2, 0], fov: 40 },
      { time: 4.5, position: [3, 5, 6], target: [-3, 1.5, -1], fov: 38 },
      { time: 6, position: [-2, 6, 4], target: [-6, 2, -2], fov: 42 },
      { time: 8, position: [-6, 8, 2], target: [-8, 2, -4], fov: 48 },
    ],
  },
  postProcessing: {
    bloom: { enabled: true, intensity: 1.5, threshold: 0.7 },
  },
};

async function main() {
  console.log('Rendering iteration 1...');
  await renderScene(scene1, 'three-body-v4');
  console.log('Done!');
}

main().catch(console.error);
