# SeedDance API 调研报告

## 概览

Seedance 2.0 是字节跳动豆包团队推出的多模态 AI 视频生成模型，支持文本、图片、视频、音频四种输入模态。通过火山方舟（Model ARK）平台提供 API 服务。

**官方文档：**
- 火山引擎 API 参考：https://www.volcengine.com/docs/82379/1520757
- 第三方 API 文档（更详细）：https://seedance2api.app/zh/docs/

## 模型矩阵（6 个模型）

| 输入类型 | Standard | Fast |
|----------|----------|------|
| 纯文本 | `seedance-2.0-text-to-video` | `seedance-2.0-fast-text-to-video` |
| 1–2 张图片 | `seedance-2.0-image-to-video` | `seedance-2.0-fast-image-to-video` |
| 图+视频+音频多模态 | `seedance-2.0-reference-to-video` | `seedance-2.0-fast-reference-to-video` |

**Fast vs Standard 区别：**
- Fast 速度更快、成本更低，画质略低
- 参数结构完全一致，只需替换 `model` 字段
- 推荐：开发阶段用 Fast 迭代 prompt，交付阶段用 Standard

## 三种生成模式详解

### 模式 1：文生视频 (text-to-video)

纯文本输入，无参考素材。

```json
{
  "model": "seedance-2.0-text-to-video",
  "prompt": "科幻电影场景：深空中一支人类舰队列阵...",
  "duration": 8,
  "quality": "720p",
  "aspect_ratio": "16:9",
  "generate_audio": true
}
```

**独有参数：**
- `model_params.web_search: true` — 允许模型联网检索增强时效性

**限制：**
- 不接受任何媒体输入（传 `image_urls` 会报错）
- 中文 prompt ≤ 500 字符

### 模式 2：图生视频 (image-to-video)

1–2 张图片驱动：
- **1 张图** → 首帧驱动模式，图片作为视频第一帧，向后生成动态
- **2 张图** → 首帧 + 尾帧模式，模型生成两帧之间的过渡动画

```json
{
  "model": "seedance-2.0-image-to-video",
  "prompt": "镜头缓慢推进，画面逐渐鲜活起来",
  "image_urls": ["https://example.com/first-frame.jpg"],
  "duration": 5,
  "aspect_ratio": "adaptive"
}
```

**图片要求：**
- 格式：JPEG、PNG、WebP
- 单边像素：300–6000
- 宽高比：0.4–2.5
- 单张大小：≤ 30 MB
- **必须是公网可访问的 URL，不支持 Base64**
- **不支持真实人脸上传**

**限制：**
- 严格 1 或 2 张，3 张会返回 `invalid_request`

### 模式 3：参考生视频 (reference-to-video) — 最强大

同时提供最多 9 张参考图片 + 3 段参考视频 + 3 段参考音频。

```json
{
  "model": "seedance-2.0-reference-to-video",
  "prompt": "参考视频 1 的第一人称视角和镜头节奏；以音频 1 作为整段背景音乐。",
  "image_urls": ["https://example.com/style-ref.jpg"],
  "video_urls": ["https://example.com/pov-reference.mp4"],
  "audio_urls": ["https://example.com/bgm.mp3"],
  "duration": 10,
  "quality": "720p",
  "aspect_ratio": "16:9"
}
```

**素材限制：**

| 类型 | 数量 | 格式 | 时长 | 大小 |
|------|------|------|------|------|
| 图片 | 0–9 张 | JPEG/PNG/WebP | — | ≤ 30 MB/张 |
| 视频 | 0–3 段 | MP4/MOV | 2–15s/段，总计 ≤ 15s | ≤ 50 MB/段 |
| 音频 | 0–3 段 | WAV/MP3 | 2–15s/段，总计 ≤ 15s | ≤ 15 MB/段 |

**关键约束：**
- 所有素材可以全部不传（退化为文生视频）
- **不允许只传音频**，必须至少传 1 张图或 1 段视频作为视觉锚点
- 所有 URL 必须无需认证即可 GET
- 请求体合计 ≤ 64 MB（不支持 Base64 内联）

**Prompt 写法：**
- **没有 @语法**，用自然语言描述素材作用
- 素材按数组顺序对应"图 1 / 视频 1 / 音频 1"
- 推荐句式：
  - "以图片 1 作为视频的第一帧"
  - "参考视频 1 的镜头运动和节奏"
  - "以音频 1 作为整段视频的背景音乐"
  - "视频中的人物外观与图片 1 中的角色保持一致"
  - "整体美术风格参考图片 2 的用色与质感"

## 共享参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `duration` | integer | 5 | 4–15 秒 |
| `quality` | string | 720p | 480p / 720p / 1080p / 4k |
| `aspect_ratio` | string | 16:9 | 16:9 / 9:16 / 1:1 / 4:3 / 3:4 / 21:9 / adaptive |
| `generate_audio` | boolean | true | 是否生成同步音频 |
| `callback_url` | string | — | 任务完成回调 HTTPS URL |

## 工作流程

1. **提交任务** → POST 请求立即返回任务 ID（HTTP 200）
2. **查询结果** → 轮询 `GET /v1/tasks/{id}` 或 Webhook 回调
3. **下载视频** → 视频链接有效期 24 小时

**任务状态：** `pending` → `processing` → `completed` / `failed`

## 计费

- 按秒计费（`billing_rule: per_second`）
- reference-to-video 的参考视频输入时长也计入计费基数
- 音频生成不单独收费
- Fast 模型单价更低

## 火山方舟 API 接入

我们当前使用的是火山方舟平台：

```
Base URL: https://ark.cn-beijing.volces.com/api/v3
端点: /contents/generations/tasks
      /contents/generations/tasks/{task_id}
API Key: REDACTED_SEEDANCE_API_KEY
```

**注意：** 火山方舟的 API 参数与 seedance2api.app 文档略有不同：
- 方舟使用 `content` 数组（text/image_url/video_url/audio_url）
- 方舟的图片通过 `image_info` + `role` 字段指定用途（first_frame / last_frame / reference_image）
- 方舟支持 `return_last_frame: true` 返回尾帧图片

## 对 CreatorHelix 的启示

### 当前方案：结构化 Prompt 驱动纯文本生成

不使用参考图/视频，而是将 SceneConfig JSON 包含的结构信息翻译为高质量英文 prompt，直接调用 SeedDance text-to-video。

**为什么不用参考素材？**

| 方案 | 华丽度 | 结构可控性 | 问题 |
|------|--------|-----------|------|
| 纯文本（无结构） | ★★★★★ | ★☆☆☆☆ | 结构不可控 |
| 首帧图片参考 | ★★★★☆ | ★★★☆☆ | 渲染图本身简陋，限制了 SeedDance 发挥 |
| 首尾帧图片参考 | ★★★☆☆ | ★★★★☆ | 太死板，中间动画被锁定 |
| 视频参考 (v2v) | ★★☆☆☆ | ★★★★★ | 预览视频简陋，SeedDance 忠实复制了简陋感 |
| **结构化 prompt** | ★★★★☆ | ★★★★☆ | **最佳平衡** |

**核心发现：** HelixStructure 渲染的关键帧/预览视频画质有限（低精度 3D、简单几何体），作为参考图传给 SeedDance 会把"简陋感"也传过去。即使 prompt 要求华丽，SeedDance 仍被参考素材的画风锁定。

### 可用模式（备用）

| 模式 | 适用场景 | 需要公网 OSS |
|------|----------|-------------|
| text-to-video | 当前默认方案（结构化 prompt） | 否 |
| image-to-video (首帧) | 未来 multi-shot 衔接 | 是 |
| image-to-video (首尾帧) | 未来精确时序控制 | 是 |
| reference-to-video | 未来多模态参考 | 是 |

### TOS 存储（备用）

所有涉及参考素材的模式都需要**公网可访问的 URL**。已配置 TOS Bucket 备用：

1. **使用火山引擎的对象存储（TOS）** — 与 SeedDance 同属火山引擎生态
2. **使用 Cloudflare R2** — 免费额度足够，无出口流量费
