# 可灵API集成指南

## 概述

AnimeHelix集成了可灵AI (KlingAI) 的视频生成API，支持：
- 文生视频 (Text-to-Video)
- 图生视频 (Image-to-Video)
- 视频生视频 (Video-to-Video)

## 配置

### 1. API密钥配置

编辑 `config/providers.json` 文件：

```json
{
  "providers": {
    "kling": {
      "name": "KlingAI",
      "api_key": "your-api-key",
      "base_url": "https://api.klingai.com/v1",
      "enabled": true
    }
  }
}
```

### 2. 环境变量（可选）

```bash
export KLING_API_KEY="your-api-key"
```

## 使用方法

### 1. 命令行使用

```bash
# 运行视频生成脚本
python scripts/generate_with_kling.py
```

### 2. Python代码使用

```python
from scripts.kling_client import KlingAPI
from scripts.config import get_config

# 初始化API客户端
config = get_config()
api_key = config.get_api_key("kling")
api = KlingAPI(api_key)

# 文生视频
result = api.text_to_video(
    prompt="电影级画质，一个红色产品盒子在摄影棚中360度旋转",
    mode="std",
    duration="5"
)

# 等待完成并下载
if result.get("data", {}).get("task_id"):
    task_id = result["data"]["task_id"]
    final_result = api.wait_for_task(task_id)
    
    if final_result["data"]["task_status"] == "succeed":
        video_url = final_result["data"]["task_result"]["videos"][0]["url"]
        api.download_video(video_url, "output.mp4")
```

### 3. 使用资产管理系统

```python
from scripts.generate_with_kling import VideoGenerator

generator = VideoGenerator()

# 生成电商视频
result = generator.generate_ecommerce_video()

# 等待并下载
video_path = generator.wait_and_download(result)
```

## API参数说明

### 文生视频 (text_to_video)

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| prompt | str | 文本提示词 | 必填 |
| model_name | str | 模型名称 | kling-v1 |
| cfg_scale | float | 创意度 (0-1) | 0.5 |
| mode | str | 模式 (std/pro) | std |
| duration | str | 时长 (5/10) | 5 |
| aspect_ratio | str | 宽高比 | 16:9 |
| negative_prompt | str | 反向提示词 | "" |

### 图生视频 (image_to_video)

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| image_path | str | 图片路径 | 必填 |
| prompt | str | 文本提示词 | "" |
| model_name | str | 模型名称 | kling-v1 |
| cfg_scale | float | 创意度 (0-1) | 0.5 |
| mode | str | 模式 (std/pro) | std |
| duration | str | 时长 (5/10) | 5 |
| aspect_ratio | str | 宽高比 | 16:9 |
| negative_prompt | str | 反向提示词 | "" |

### 视频生视频 (video_to_video)

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| video_path | str | 视频路径 | 必填 |
| prompt | str | 文本提示词 | "" |
| model_name | str | 模型名称 | kling-v1 |
| cfg_scale | float | 创意度 (0-1) | 0.5 |
| mode | str | 模式 (std/pro) | std |
| duration | str | 时长 (5/10) | 5 |
| aspect_ratio | str | 宽高比 | 16:9 |

## 视频类型配置

### 电商视频

```python
{
  "mode": "pro",
  "duration": "10",
  "aspect_ratio": "16:9",
  "cfg_scale": 0.6
}
```

### 剧情视频

```python
{
  "mode": "pro",
  "duration": "15",
  "aspect_ratio": "16:9",
  "cfg_scale": 0.5
}
```

### 科幻视频

```python
{
  "mode": "pro",
  "duration": "10",
  "aspect_ratio": "16:9",
  "cfg_scale": 0.7
}
```

## 提示词工程

### 基本结构

```
风格描述 + 主体描述 + 动作描述 + 环境描述 + 镜头语言 + 质量修饰词
```

### 示例

```
电影级画质，一个红色产品盒子在黑色旋转台上360度旋转，
柔和的轮廓光勾勒出产品边缘，背景是渐变色摄影棚，
镜头缓慢环绕，浅景深效果，8K分辨率
```

## 错误处理

### 常见错误

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 401 | 认证失败 | 检查API密钥 |
| 400 | 参数错误 | 检查请求参数 |
| 429 | 请求过多 | 稍后重试 |
| 500 | 服务器错误 | 联系技术支持 |

### 错误处理示例

```python
try:
    result = api.text_to_video(prompt="...")
    if result.get("code") != 0:
        print(f"API错误: {result.get('message')}")
except Exception as e:
    print(f"请求异常: {e}")
```

## 文件结构

```
AnimeHelix/
├── config/
│   ├── providers.json      # Provider配置
│   └── kling.json         # 可灵专用配置
├── scripts/
│   ├── kling_client.py    # 可灵API客户端
│   ├── config.py          # 配置管理器
│   └── generate_with_kling.py  # 视频生成脚本
└── docs/
    └── kling_integration.md  # 本文档
```

## 下一步

1. 测试API连接
2. 生成第一个视频
3. 自定义提示词模板
4. 集成到工作流程
