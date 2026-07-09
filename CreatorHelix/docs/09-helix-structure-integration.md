# HelixStructure 与 CreatorHelix 结合方案（控制信号版）

## 一、关系定位

CreatorHelix 负责**创意编排**（脚本、分镜、prompts、剪辑计划）。
HelixStructure 负责**生成结构化控制信号**（关键帧、深度图、相机轨迹、mask 等），用来控制视频生成模型。
视频生成模型（SeedDance / HunyuanVideo / Wan 等）负责**生成真实视频片段**。
CreatorHelix 最后**合成成片**。

```
CreatorHelix            HelixStructure              Video Generation Model
    |                         |                              |
 脚本/分镜                   SceneConfig                     真实视频片段
    ↓                         ↓                              ↓
 ShotIntent      →     结构化控制信号       →         每个 shot 的视频
    ↓                    （关键帧/深度/相机）                    ↓
 EditingPlan                                                最终成片
    ↓                                                            ↓
 合成服务 ←──────────────────────────────────────────────────────┘
```

**一句话：HelixStructure 不是最终渲染器，而是视频生成模型的"上游控制层"。**

## 二、为什么用结构化控制信号

视频生成模型的问题：
- 随机性强，同 prompt 每次结果不同
- 多镜头之间风格/物体/构图漂移
- camera 运动、物体位置难以精确控制

结构化控制信号解决：
- 确定性：3D 场景精确控制构图和运动
- 一致性：同一 SceneConfig 渲染的关键帧保证视觉一致
- 可编辑：改 camera 轨迹比重新抽卡视频成本低
- Few-shot：关键帧序列给模型明确的视觉参考

## 三、控制信号类型

| 信号 | 用途 | 输出形式 |
|---|---|---|
| Keyframe sequence | 每 shot 的开始/结束/中间构图参考 | PNG 序列 |
| Depth map sequence | 空间结构、遮挡关系 | PNG/EXR 序列 |
| Camera trajectory | 镜头运动（推/拉/摇/移/轨道） | JSON （position/target/fov per frame） |
| Object mask sequence | 哪些区域变化、哪些不变 | PNG 序列 |
| Optical flow sequence | 运动方向和速度 | PNG/FLO 序列 |
| 3D bounding box trajectory | 多物体时空关系 | JSON |
| Normal map sequence | 表面朝向、光照一致性 | PNG 序列 |

不同视频生成模型支持不同的条件输入。Generator 可以按需输出组合。

## 四、核心类型设计

### 4.1 ShotIntent

LLM 为每个 shot 输出高层意图，不直接生成底层 3D 参数：

```ts
interface ShotIntent {
  templateId: string          // 模板ID
  subject: string             // 主体描述
  mood: string                // 情绪/风格
  motion: string              // 镜头运动类型
  durationSeconds: number
  narration?: string
}
```

### 4.2 ControlSignalConfig

定义要为某个 shot 生成哪些控制信号：

```ts
interface ControlSignalConfig {
  keyframes: boolean
  depth: boolean
  camera: boolean
  mask: boolean
  flow: boolean
  normals: boolean
  resolution: { width: number; height: number }
  fps: number
}
```

### 4.3 ControlSignalBundle

一个 shot 的完整控制信号：

```ts
interface ControlSignalBundle {
  shotId: string
  prompt: string              // 给视频生成模型的 text prompt
  keyframes?: string[]        // PNG file URLs
  depth?: string[]
  camera?: CameraTrajectory
  masks?: string[]
  flow?: string[]
  normals?: string[]
}
```

## 五、生成流程

1. **StoryboardIntent Generation**
   - 输入：VideoProject.Requirement + Script + Storyboard
   - 输出：`StoryboardIntent { shots: ShotIntent[], globalStyle }`
   - 由 LLM 一次生成，保证整体一致性

2. **SceneConfig Generation**
   - 输入：`ShotIntent` + `globalStyle`
   - 输出：HelixStructure `SceneConfig`
   - 由代码根据模板填充，不依赖 LLM

3. **Control Signal Rendering**
   - 输入：`SceneConfig` + `ControlSignalConfig`
   - 输出：`ControlSignalBundle`
   - 由 HelixStructure 渲染器（headless 浏览器 / 离屏 canvas）产出

4. **Video Generation**
   - 输入：`ControlSignalBundle` + text prompt
   - 输出：真实视频片段
   - 调用 SeedDance / HunyuanVideo / Wan API

5. **Composition**
   - 输入：多个视频片段 + EditingPlan
   - 输出：最终成片

## 六、模板库设计

复用并扩展 HelixStructure 的 TemplateRegistry：

| 模板ID | 场景 | 默认元素 | 默认运动 |
|---|---|---|---|
| `space-establishing` | 太空远景/舰队矩阵 | 星空、舰队、行星 | 缓慢推近 |
| `teardrop-approach` | 水滴探测器接近 | 镜面水滴、星光反射 | 缓慢自转 + 轨道 |
| `impact-penetration` | 高速穿刺 | 水滴、战舰、碎片 | 追踪镜头 |
| `nuclear-bloom` | 真空核爆 | 爆炸光球、残骸 | 固定广角 |
| `debris-reveal` | 残骸云揭示 | 碎片场、远景行星 | 缓慢拉远 |

每个模板内置：
- 默认 camera position/target/fov
- 默认 lighting（冷色主光、补光）
- 默认 elements
- 默认 keyframes（按 motion 类型变化）
- 默认 postProcessing

## 七、与 CreatorHelix 现有链路结合

替换 mock 服务：

| 当前服务 | 新行为 |
|---|---|
| `services/asset-generation.ts` | 为每个 shot 生成 `ControlSignalBundle`，调用视频生成模型产出真实片段 |
| `services/editing.ts` | 按 `EditingPlan` 合成多个片段为 draft |
| `services/export.ts` | 最终压缩/转码为 mp4 |

`services/asset-generation.ts` 内部流程：

```
shot (visualPrompt + motionPrompt)
  ↓
ShotIntent（LLM 或规则）
  ↓
SceneConfig（模板 + 代码填充）
  ↓
HelixStructure 渲染 → ControlSignalBundle
  ↓
Video Generation API → shot-video.webm
```

## 八、下一步

1. 定义 `ShotIntent`、`ControlSignalConfig`、`ControlSignalBundle` schema
2. 创建 `HelixStructureAdapter`，把 `ShotIntent` 转成 `SceneConfig`
3. 用水滴剧本跑通第一个 shot 的 `ShotIntent → SceneConfig` 转换
4. 设计 headless 渲染接口，让 HelixStructure 输出关键帧/深度/相机轨迹
5. 接入一个视频生成模型 API（先 mock，再真实）
