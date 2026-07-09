# AnimeHelix - Blender + AI视频生成项目

## 项目概述

AnimeHelix是一个基于Blender + AI视频生成的创意视频制作项目，专注于高质量视频内容创作，包括电商产品视频、剧情短剧、科幻视频等。

## 目录结构

```
AnimeHelix/
├── AGENTS.md                      # 项目行为准则
├── README.md                      # 项目说明
├── QUICKSTART.md                  # 快速上手指南
├── blender-5.1.2-macos-arm64.dmg # Blender安装包
│
├── projects/                      # 项目目录
│   ├── ecommerce/                # 电商产品视频
│   │   ├── product_final_v3/     # 渲染帧序列
│   │   └── product_video.mp4     # 最终视频
│   ├── drama/                    # 剧情类短剧
│   ├── scifi/                    # 科幻类视频
│   └── other/                    # 其他类型
│
├── assets/                       # 素材资源
│   ├── models/                   # 3D模型
│   ├── textures/                 # 材质贴图
│   ├── audio/                    # 音频文件
│   └── reference/                # 参考图片
│
├── scripts/                      # 脚本工具
│   └── blender_product_video.py  # 电商视频脚本
│
├── templates/                    # 模板文件
└── docs/                         # 文档资料
```

## 支持的视频类型

### 1. 电商产品视频
- 产品展示、品牌宣传、广告素材
- 特点：高质量渲染、光影效果、产品旋转

### 2. 剧情类短剧
- 人物故事、情感叙事、微电影
- 特点：角色一致性、表情动作、环境氛围

### 3. 科幻类视频
- 未来场景、特效展示、概念动画
- 特点：光效粒子、未来科技、视觉奇观

### 4. 其他类型
- MV、教程、纪录片等

## 快速开始

### 查看已有视频
```bash
open projects/ecommerce/product_video.mp4
```

### 运行Blender脚本
```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender_product_video.py
```

### 合成视频
```bash
ffmpeg -framerate 30 -i "projects/ecommerce/product_final_v3/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p output.mp4
```

## 工作流程

```
需求分析 → 脚本/分镜 → Blender预制作 → AI增强 → 后期处理 → 输出交付
```

详细工作流程请参考 `AGENTS.md`。

## 技术栈

- **3D建模/动画**：Blender 5.1.2
- **AI视频生成**：Seedance、可灵、Runway
- **视频处理**：FFmpeg
- **脚本语言**：Python 3.x

## 文档

- `AGENTS.md` - 项目行为准则和工作流程
- `QUICKSTART.md` - 快速上手指南
- `docs/` - 详细文档目录

## 许可

本项目仅供学习和研究使用。
