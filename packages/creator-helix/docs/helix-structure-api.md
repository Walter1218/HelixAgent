# HelixStructure API 参考（外部 3D 渲染工具）

> 此文档描述外部 HelixStructure 工具的 API。CreatorHelix 使用其 SceneConfig JSON 格式作为中间表示，但最终视频生成不依赖其渲染输出，而是将 SceneConfig 翻译为 prompt 后交给 SeedDance 等视频生成模型。

## 场景配置 (SceneConfig)

```typescript
{
  scene: {
    width: number,        // 场景宽度（渲染分辨率）
    height: number,       // 场景高度
    depth: number,        // 场景深度（影响透视）
    background?: string,  // 背景颜色，默认 '#1a1a2e'
    showGrid?: boolean,   // 显示网格，默认 true
    showAxes?: boolean,   // 显示坐标轴，默认 true
    camera: {
      position: [x, y, z],  // 相机位置
      fov?: number,         // 视场角，默认 60
      target?: [x, y, z],   // lookAt 目标点
    },
    lighting?: {
      ambient?: { intensity?: number; color?: string },
      main?: { position?: [x,y,z]; intensity?: number; castShadow?: boolean },
      fill?: { position?: [x,y,z]; intensity?: number },
    },
  },
  elements: SceneElement[],
  animation: {
    duration: number,     // 总时长（秒）
    fps?: number,         // 帧率，默认 30
    loop?: boolean,       // 循环播放，默认 false
    keyframes: Keyframe[],
    cameraKeyframes?: CameraKeyframe[],
  },
  postProcessing?: {
    bloom?: { enabled?: boolean; intensity?: number; threshold?: number },
    colorGrading?: { enabled?: boolean; brightness?: number; contrast?: number; saturation?: number },
    depthOfField?: { enabled?: boolean; focusDistance?: number; focalLength?: number },
    vignette?: { enabled?: boolean; offset?: number; darkness?: number },
  },
}
```

## 元素类型 (SceneElement)

### 内置形状

| shape | 说明 | 关键参数 |
|-------|------|----------|
| `box` | 立方体 | `scale: [w, h, d]` |
| `sphere` | 球体 | `scale: [r, r, r]` 或 `size` |
| `cylinder` | 圆柱体 | `scale: [r, h, r]` |
| `plane` | 平面 | `scale: [w, 1, d]` |
| `particles` | 粒子系统 | `particles: ParticleConfig` |
| `model` | 外部模型 | `url: string` (GLTF/GLB) |

### 元素通用属性

```typescript
{
  id: string,           // 唯一标识（必填）
  shape: string,        // 形状类型（必填）
  color: string,        // 颜色（必填）
  position: [x, y, z],  // 位置（必填）
  scale?: [x, y, z],    // 缩放
  size?: number,        // 基础尺寸（sphere/cylinder）
  rotation?: [rx, ry, rz],  // 旋转角度（度）
  opacity?: number,     // 透明度 0-1
  wireframe?: boolean,  // 线框模式
  material?: MaterialConfig,
  particles?: ParticleConfig,  // shape='particles' 时必填
  url?: string,         // shape='model' 时必填
}
```

### 材质配置 (MaterialConfig)

```typescript
{
  type?: 'standard' | 'physical' | 'toon' | 'basic',
  metalness?: number,       // 金属度 0-1
  roughness?: number,       // 粗糙度 0-1
  emissive?: string,        // 自发光颜色
  emissiveIntensity?: number,  // 自发光强度
  map?: string,             // 漫反射贴图 URL
  normalMap?: string,       // 法线贴图 URL
  roughnessMap?: string,    // 粗糙度贴图 URL
  metalnessMap?: string,    // 金属度贴图 URL
}
```

### 粒子系统配置 (ParticleConfig)

```typescript
{
  count: number,            // 粒子数量
  size?: number,            // 粒子大小，默认 0.05
  color?: string,           // 粒子颜色，默认 '#ffffff'
  opacity?: number,         // 透明度，默认 0.8
  spread?: number,          // 散布范围，默认 1
  speed?: number,           // 运动速度，默认 0.5
  lifetime?: number,        // 生命周期（秒），默认 3
  gravity?: [x, y, z],      // 重力方向，默认 [0, -0.5, 0]
  emitterShape?: 'point' | 'sphere' | 'box',
  emitterPosition?: [x, y, z],
  loop?: boolean,           // 循环发射，默认 true
}
```

## 关键帧 (Keyframe)

### 元素关键帧

```typescript
{
  time: number,             // 时间点（秒）
  elements: [
    {
      id: string,           // 元素 ID
      position?: [x, y, z], // 位置
      rotation?: [rx, ry, rz],  // 旋转（度）
      scale?: [x, y, z],    // 缩放
      opacity?: number,     // 透明度
    }
  ],
  easing?: EasingType,      // 缓动函数
}
```

### 相机关键帧 (CameraKeyframe)

```typescript
{
  time: number,             // 时间点（秒）
  position?: [x, y, z],     // 相机位置
  target?: [x, y, z],       // lookAt 目标点
  fov?: number,             // 视场角
  easing?: EasingType,      // 缓动函数
}
```

## 自定义元素注册

```typescript
import { ElementRegistry } from './engine/elements/ElementRegistry';

// 注册自定义元素类型
ElementRegistry.register('cone', ({ element, computedScale }) => {
  return (
    <mesh>
      <coneGeometry args={[computedScale[0]/2, computedScale[1], 32]} />
      <meshStandardMaterial color={element.color} />
    </mesh>
  );
});

// 检查是否已注册
ElementRegistry.has('cone');  // true

// 获取所有已注册类型
ElementRegistry.getRegisteredTypes();  // ['cone', ...]

// 注销
ElementRegistry.unregister('cone');
```

## 场景大小建议

| 场景类型 | width | height | depth | 说明 |
|----------|-------|--------|-------|------|
| 远景/全景 | 1920 | 1080 | 1000+ | 大场景，相机远 |
| 中景 | 1280 | 720 | 500 | 标准场景 |
| 特写 | 1920 | 1080 | 300 | 小场景，相机近 |
| 微观 | 800 | 600 | 200 | 精细物体 |

## 元素尺寸参考

| 元素类型 | 推荐 scale | 说明 |
|----------|-----------|------|
| 战舰 | [4-8, 1.5-3, 2-4] | 长条形 |
| 水滴探测器 | [0.8-1.5, 1-2, 0.8-1.5] | 小而精致 |
| 行星 | [20-50, 20-50, 20-50] | 巨大球体 |
| 爆炸光球 | [2-6, 2-6, 2-6] | 动态变化 |
| 碎片 | [0.2-0.5, 0.1-0.3, 0.1-0.3] | 小方块 |

## 相机位置参考

| 镜头类型 | position | target | fov | 效果 |
|----------|----------|--------|-----|------|
| 远景 | [40, 25, 40] | [0,0,0] | 55 | 展示全景 |
| 中景 | [20, 12, 20] | [0,0,0] | 45 | 标准视角 |
| 近景 | [10, 8, 12] | [0,2,0] | 40 | 聚焦主体 |
| 特写 | [5, 6, 8] | [0,2,0] | 35 | 细节展示 |
| 俯视 | [0, 30, 0.1] | [0,0,0] | 45 | 鸟瞰 |
| 侧面 | [20, 5, 0] | [0,0,0] | 40 | 侧面轮廓 |

## 灯光设置参考

| 灯光类型 | 推荐设置 | 效果 |
|----------|----------|------|
| ambient | intensity: 0.3-0.6 | 基础照明 |
| main | intensity: 2-3, position: [15,25,15] | 主光源 |
| fill | intensity: 0.5-1, position: [-10,8,-10] | 补光 |
| rim | intensity: 0.8-1, color: '#ffaa66' | 边缘光 |

## 全局控制 API

```typescript
// 暴露到 window.helixControl
window.helixControl = {
  play(): void,           // 播放动画
  pause(): void,          // 暂停
  reset(): void,          // 重置到起点
  seek(time: number): void,  // 跳转到指定时间（秒）
  getState(): {           // 获取动画状态
    currentTime: number,
    isPlaying: boolean,
    duration: number,
    progress: number,     // 0-1
  },
};
```

## 渲染输出格式

```typescript
{
  output: {
    width: 1280,          // 输出宽度
    height: 720,          // 输出高度
    format: 'webm' | 'mp4' | 'gif' | 'png-sequence',
    quality: 'low' | 'medium' | 'high',
    fps: 30,              // 输出帧率
  }
}
```

## 注意事项

1. **粒子系统** — 大量粒子可能导致软件渲染崩溃，建议 count < 100
2. **场景深度** — depth 影响透视效果，大场景用大 depth
3. **相机 fov** — 小 fov = 长焦（压缩感），大 fov = 广角（夸张透视）
4. **自发光** — emissive 不受光照影响，适合做光源效果
5. **关键帧插值** — 系统在关键帧之间自动插值，无需每帧都定义
