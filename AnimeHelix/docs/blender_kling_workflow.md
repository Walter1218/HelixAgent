# Blender + 可灵 工作流

## 三种工作流

### 工作流1：单帧增强（最简单）
```
Blender渲染视频
     ↓
提取首帧
     ↓
可灵图生视频
     ↓
输出高质量视频
```
**适用**：产品展示、简单动画

### 工作流2：多帧控制（推荐）
```
Blender渲染视频
     ↓
提取首帧 + 尾帧
     ↓
可灵图生视频（image + image_tail）
     ↓
输出高质量视频
```
**适用**：需要控制首尾状态的场景

### 工作流3：分段生成（复杂场景）
```
Blender渲染多段视频
     ↓
可灵逐段生成
     ↓
FFmpeg拼接
     ↓
输出完整视频
```
**适用**：长视频、多场景

## 快速开始

```python
from scripts.blender_kling_workflow import BlenderKlingWorkflow
from scripts.config import get_config

# 初始化
config = get_config()
workflow = BlenderKlingWorkflow(config.get_api_key("kling"))

# 运行工作流
workflow.workflow_single_frame(
    blender_script="scripts/blender_product_video.py",
    prompt="电影级画质，产品旋转展示"
)
```

## Blender渲染配置

### 电商产品
```python
# 分辨率
resolution_x = 512
resolution_y = 512

# 帧数
frames = 120  # 4秒@30fps

# 渲染引擎
engine = 'BLENDER_EEVEE'
```

### 剧情短剧
```python
# 分辨率
resolution_x = 1024
resolution_y = 576  # 16:9

# 帧数
frames = 240  # 10秒@24fps
```

## 可灵API参数

### 图生视频
```python
{
    "model_name": "kling-v2-6",
    "image": "base64编码的首帧",
    "image_tail": "base64编码的尾帧",  # 可选
    "prompt": "电影级画质，专业产品摄影",
    "mode": "pro",  # std/pro
    "duration": "5"  # 5/10
}
```

### Prompt建议

**产品展示：**
```
电影级画质，专业产品摄影，{产品}在{场景}中展示，
光影效果华丽，8K分辨率，专业广告品质
```

**剧情短剧：**
```
电影级画质，{角色1}和{角色2}在{场景}中，
{动作描述}，{氛围描述}，电影色彩分级
```

**科幻场景：**
```
赛博朋克风格，{物体}在{场景}中，
霓虹灯光效果，未来科技感，粒子特效
```

## 文件结构

```
AnimeHelix/
├── scripts/
│   ├── blender_kling_workflow.py  # 完整工作流
│   ├── blender_product_video.py   # Blender电商模板
│   └── kling_client.py           # 可灵API客户端
├── output/                        # 输出目录
│   ├── workflow1/                # 工作流1输出
│   ├── workflow2/                # 工作流2输出
│   └── workflow3/                # 工作流3输出
└── docs/
    └── blender_kling_workflow.md  # 本文档
```

## 常见问题

### Q: Blender渲染太慢？
A: 使用EEVEE引擎，降低分辨率到256x256

### Q: 可灵生成效果不好？
A: 优化Prompt，提供更多细节描述

### Q: 如何保持角色一致性？
A: 使用多帧控制（工作流2），提供首尾帧

### Q: 视频太长怎么办？
A: 使用分段生成（工作流3），逐段生成后拼接

## 下一步

1. 测试工作流1（单帧增强）
2. 测试工作流2（多帧控制）
3. 优化Prompt模板
4. 建立资产库
