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
    { id: 'droplet', shape: 'sphere', color: '#ffffff', position: [20, 5, 12], scale: [1.2, 1.5, 1.2], material: { type: 'physical', metalness: 1, roughness: 0.01, emissive: '#aaddff', emissiveIntensity: 0.8 } },
  ],
  animation: {
    duration: 8, fps: FPS, loop: false,
    keyframes: [
      { time: 0, elements: [{ id: 'droplet', position: [20, 5, 12] }] },
      { time: 2, elements: [{ id: 'droplet', position: [10, 3.5, 6] }] },
      { time: 3.5, elements: [{ id: 'droplet', position: [0, 2.5, 0] }] },
      { time: 4.5, elements: [
        { id: 'droplet', position: [-3, 2, -1.5] },
        { id: 'ship-1', rotation: [8, 0, 0] },
      ]},
      { time: 6, elements: [
        { id: 'droplet', position: [-6, 1.5, -2.5] },
        { id: 'ship-1', position: [-1.5, 2.5, -1], rotation: [20, 10, 5] },
        { id: 'ship-2', rotation: [8, 5, 3] },
      ]},
      { time: 8, elements: [
        { id: 'droplet', position: [-10, 1, -4] },
        { id: 'ship-1', position: [-4, 4, -2], rotation: [35, 20, 12] },
        { id: 'ship-2', position: [-7, 3, -4], rotation: [25, 15, 8] },
        { id: 'ship-3', position: [6, 2.5, -3], rotation: [15, 8, 5] },
      ]},
    ],
    cameraKeyframes: [
      { time: 0, position: [35, 20, 35], target: [0, 0, 0], fov: 50 },
      { time: 2, position: [22, 14, 22], target: [5, 3, 3], fov: 48 },
      { time: 3.5, position: [12, 10, 15], target: [0, 2.5, 0], fov: 45 },
      { time: 4.5, position: [6, 8, 10], target: [-2, 2, -1], fov: 42 },
      { time: 6, position: [0, 10, 6], target: [-5, 2, -2], fov: 45 },
      { time: 8, position: [-5, 12, 2], target: [-8, 2, -3], fov: 50 },
    ],
  },
  postProcessing: {
    bloom: { enabled: true, intensity: 1.5, threshold: 0.7 },
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
  const frameDir = `${OUTPUT_DIR}/frames/seek`;
  mkdirSync(frameDir, { recursive: true });

  console.log(`Capturing ${totalFrames} frames with seek...`);

  for (let f = 0; f < totalFrames; f++) {
    const time = f / FPS;
    
    // 使用 seek 跳转到精确时间点
    await page.evaluate((t) => (window as any).helixControl?.seek(t), time);
    await new Promise(r => setTimeout(r, 200)); // 等待渲染
    
    const padded = String(f).padStart(4, '0');
    await page.screenshot({ path: `${frameDir}/frame-${padded}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }

  await browser.close();

  execSync(`ffmpeg -y -framerate ${FPS} -i ${frameDir}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:720' ${OUTPUT_DIR}/three-body-seek.mp4`, { stdio: 'ignore' });
  
  execSync(`ffmpeg -y -i ${OUTPUT_DIR}/three-body-seek.mp4 -vf "select=eq(n\\,0)+eq(n\\,15)+eq(n\\,30)+eq(n\\,45)+eq(n\\,60)+eq(n\\,75)+eq(n\\,119)" -vsync vfr ${OUTPUT_DIR}/seek-check-%02d.png`, { stdio: 'ignore' });
  
  console.log('Done: three-body-seek.mp4');
}

main().catch(console.error);
