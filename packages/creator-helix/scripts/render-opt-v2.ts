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
      main: { position: [25, 40, 25], intensity: 3 },
      fill: { position: [-20, 15, -20], intensity: 1.2 },
    },
  },
  elements: [
    { id: 'flagship', shape: 'box', color: '#1a3366', position: [0, 0, 0], scale: [6, 2, 3], material: { type: 'physical', metalness: 0.85, roughness: 0.15 } },
    { id: 'cruiser-1', shape: 'box', color: '#1a3366', position: [-5, 0, -2], scale: [4.5, 1.5, 2.5], material: { type: 'physical', metalness: 0.85, roughness: 0.15 } },
    { id: 'cruiser-2', shape: 'box', color: '#1a3366', position: [5, 0, -2], scale: [4.5, 1.5, 2.5], material: { type: 'physical', metalness: 0.85, roughness: 0.15 } },
    { id: 'jupiter', shape: 'sphere', color: '#cc8855', position: [0, -15, -60], scale: [50, 50, 50], material: { type: 'standard', roughness: 0.85 } },
    { id: 'droplet', shape: 'sphere', color: '#ffffff', position: [30, 8, 20], scale: [1, 1.3, 1], material: { type: 'physical', metalness: 1, roughness: 0.01, emissive: '#aaddff', emissiveIntensity: 1 } },
    { id: 'explosion-1', shape: 'sphere', color: '#ff6600', position: [0, 0, 0], scale: [0.1, 0.1, 0.1], material: { type: 'basic', emissive: '#ff4400', emissiveIntensity: 4 } },
    { id: 'explosion-2', shape: 'sphere', color: '#ff8800', position: [-5, 0, -2], scale: [0.1, 0.1, 0.1], material: { type: 'basic', emissive: '#ff6600', emissiveIntensity: 4 } },
  ],
  animation: {
    duration: 10, fps: FPS, loop: false,
    keyframes: [
      { time: 0, elements: [
        { id: 'droplet', position: [30, 8, 20] },
        { id: 'explosion-1', scale: [0.1, 0.1, 0.1] },
        { id: 'explosion-2', scale: [0.1, 0.1, 0.1] },
      ]},
      { time: 2.5, elements: [{ id: 'droplet', position: [15, 5, 10] }] },
      { time: 4, elements: [{ id: 'droplet', position: [5, 3, 3] }] },
      { time: 5, elements: [
        { id: 'droplet', position: [0, 2, 0] },
        { id: 'flagship', rotation: [8, 0, 0] },
        { id: 'explosion-1', scale: [3, 3, 3] },
      ]},
      { time: 6, elements: [
        { id: 'droplet', position: [-4, 1.5, -2] },
        { id: 'flagship', position: [-2, 4, -1], rotation: [30, 18, 10] },
        { id: 'explosion-1', scale: [5, 5, 5] },
      ]},
      { time: 7.5, elements: [
        { id: 'droplet', position: [-6, 1, -3] },
        { id: 'cruiser-1', rotation: [20, 12, 8] },
        { id: 'explosion-2', scale: [3, 3, 3] },
      ]},
      { time: 10, elements: [
        { id: 'droplet', position: [0, 5, -2] },
        { id: 'flagship', position: [-8, 12, -6], rotation: [70, 50, 30] },
        { id: 'cruiser-1', position: [-15, 10, -12], rotation: [60, 45, 25] },
        { id: 'cruiser-2', position: [12, 9, -8], rotation: [45, 30, 18] },
        { id: 'explosion-1', scale: [0.1, 0.1, 0.1] },
        { id: 'explosion-2', scale: [0.1, 0.1, 0.1] },
      ]},
    ],
    cameraKeyframes: [
      { time: 0, position: [40, 25, 40], target: [0, 0, 0], fov: 45 },
      { time: 2.5, position: [25, 18, 25], target: [10, 5, 5], fov: 42 },
      { time: 4, position: [12, 12, 15], target: [0, 3, 0], fov: 38 },
      { time: 5, position: [5, 8, 10], target: [0, 2, 0], fov: 35 },
      { time: 6, position: [-2, 7, 6], target: [-4, 1.5, -2], fov: 38 },
      { time: 7.5, position: [-5, 10, 4], target: [-6, 1, -3], fov: 42 },
      { time: 10, position: [5, 18, 10], target: [0, 5, -3], fov: 55 },
    ],
  },
  postProcessing: {
    bloom: { enabled: true, intensity: 2.5, threshold: 0.4 },
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
  const frameDir = `${OUTPUT_DIR}/frames/opt-v2`;
  mkdirSync(frameDir, { recursive: true });

  console.log(`捕获 ${totalFrames} 帧...`);

  for (let f = 0; f < totalFrames; f++) {
    const time = f / FPS;
    await page.evaluate((t) => (window as any).helixControl?.seek(t), time);
    await new Promise(r => setTimeout(r, 80));
    
    const padded = String(f).padStart(4, '0');
    await page.screenshot({ path: `${frameDir}/frame-${padded}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }

  await browser.close();

  execSync(`ffmpeg -y -framerate ${FPS} -i ${frameDir}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:720' ${OUTPUT_DIR}/three-body-opt-v2.mp4`, { stdio: 'ignore' });
  
  execSync(`ffmpeg -y -i ${OUTPUT_DIR}/three-body-opt-v2.mp4 -vf "select=eq(n\\,0)+eq(n\\,60)+eq(n\\,120)+eq(n\\,180)+eq(n\\,239)" -vsync vfr ${OUTPUT_DIR}/optv2-%02d.png`, { stdio: 'ignore' });
  
  console.log('Done: three-body-opt-v2.mp4');
}

main().catch(console.error);
