# 资产管理与知识图谱系统

## 概述

AnimeHelix集成了资产管理和知识图谱系统，用于：
- 管理各类素材（角色、道具、场景、风格）
- 建立资产之间的关系
- 自动生成视频提示词
- 支持智能视频生成

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    知识图谱 (graph.json)                 │
├─────────────────────────────────────────────────────────┤
│  节点 (Nodes)                                          │
│  ├── characters: 角色资产                               │
│  ├── props: 道具资产                                    │
│  ├── scenes: 场景资产                                   │
│  └── styles: 风格资产                                   │
│                                                         │
│  关系 (Relations)                                       │
│  ├── appears_in: 出现在场景中                           │
│  ├── interacts_with: 与其他资产交互                     │
│  ├── placed_in: 放置在场景中                            │
│  └── applied_to: 应用风格                               │
│                                                         │
│  模板 (Templates)                                       │
│  ├── ecommerce_product: 电商产品模板                    │
│  ├── drama_dialogue: 剧情对话模板                       │
│  └── scifi_action: 科幻动作模板                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              资产管理器 (AssetManager)                   │
├─────────────────────────────────────────────────────────┤
│  功能:                                                  │
│  ├── 搜索资产 (search_assets)                           │
│  ├── 获取资产 (get_asset)                               │
│  ├── 获取相关资产 (get_related_assets)                  │
│  ├── 生成提示词 (generate_prompt)                       │
│  ├── 添加资产 (add_asset)                               │
│  └── 添加关系 (add_relation)                            │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              视频生成流程                                │
├─────────────────────────────────────────────────────────┤
│  1. 选择项目模板                                         │
│  2. 获取所需资产                                         │
│  3. 生成AI提示词                                         │
│  4. 运行Blender脚本                                     │
│  5. AI增强（Seedance/可灵）                              │
│  6. 后期处理                                             │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 查看现有资产

```python
from scripts.asset_manager import AssetManager

manager = AssetManager("knowledge")

# 列出所有角色
characters = manager.get_all_assets("characters")
for char_id, char in characters.items():
    print(f"{char_id}: {char['name']} - {char['description']}")
```

### 2. 搜索资产

```python
# 搜索红色资产
results = manager.search_assets("red")
for r in results:
    print(f"{r['type']}/{r['id']}: {r['name']}")
```

### 3. 生成视频

```bash
# 运行智能视频生成脚本
python scripts/generate_video.py
```

## 资产类型详解

### 角色 (characters)

```json
{
  "char_001": {
    "name": "主角A",
    "type": "character",
    "description": "年轻男性，短发，蓝色服装",
    "images": ["characters/char_001_front.png", "characters/char_001_side.png"],
    "tags": ["male", "young", "blue"],
    "style": "anime",
    "emotions": ["happy", "sad", "angry", "neutral"],
    "poses": ["standing", "walking", "running", "sitting"]
  }
}
```

### 道具 (props)

```json
{
  "prop_001": {
    "name": "产品盒子",
    "type": "prop",
    "description": "红色金属质感的产品包装盒",
    "images": ["props/product_box_red.png"],
    "tags": ["product", "box", "red", "metallic"],
    "material": "metallic",
    "color": "red",
    "usage": ["ecommerce", "product_showcase"]
  }
}
```

### 场景 (scenes)

```json
{
  "scene_001": {
    "name": "室内房间",
    "type": "scene",
    "description": "现代风格的室内房间",
    "images": ["scenes/room_modern.png"],
    "tags": ["indoor", "room", "modern"],
    "lighting": "warm",
    "time": "day",
    "usage": ["drama", "dialogue"]
  }
}
```

### 风格 (styles)

```json
{
  "style_001": {
    "name": "电影级",
    "type": "style",
    "description": "电影级画质，专业色彩分级",
    "prompt_keywords": ["cinematic", "film look", "color grading", "8K"],
    "usage": ["drama", "ecommerce"]
  }
}
```

## 关系类型

| 关系 | 说明 | 示例 |
|------|------|------|
| appears_in | 出现在场景中 | 角色A出现在房间中 |
| interacts_with | 与其他资产交互 | 角色A与角色B对话 |
| placed_in | 放置在场景中 | 产品放在摄影棚 |
| flies_in | 在场景中飞行 | 飞船在城市中飞行 |
| applied_to | 应用风格 | 电影级风格应用于场景 |
| conflicts_with | 冲突关系 | 反派与主角有冲突 |

## 模板系统

### 电商产品模板

```python
template = {
    "name": "电商产品展示",
    "description": "标准电商产品视频模板",
    "required_assets": ["prop_001", "scene_003", "style_001"],
    "prompt_template": "专业产品摄影，{prop.name}在{scene.name}中展示，{style.keywords}，8K画质",
    "blender_template": "templates/project_template.py"
}
```

### 剧情对话模板

```python
template = {
    "name": "剧情对话场景",
    "description": "双人对话场景模板",
    "required_assets": ["char_001", "char_002", "scene_001", "style_001"],
    "prompt_template": "电影级画质，{char1.name}和{char2.name}在{scene.name}中对话，{style.keywords}",
    "blender_template": "templates/drama_template.py"
}
```

### 科幻动作模板

```python
template = {
    "name": "科幻动作场景",
    "description": "未来科技动作场景模板",
    "required_assets": ["prop_002", "scene_002", "style_002"],
    "prompt_template": "赛博朋克风格，{prop.name}在{scene.name}中飞行，{style.keywords}，特效华丽",
    "blender_template": "templates/scifi_template.py"
}
```

## 扩展指南

### 添加新资产

```python
# 添加新角色
manager.add_asset("characters", "char_003", {
    "name": "反派角色",
    "type": "character",
    "description": "中年男性，西装，严肃表情",
    "images": ["characters/char_003_front.png"],
    "tags": ["male", "middle-aged", "suit"],
    "style": "realistic"
})

# 添加关系
manager.add_relation("char_003", "char_001", "conflicts_with", "反派与主角有冲突")
```

### 添加新模板

在`knowledge/graph.json`的`templates`部分添加新模板。

## 文件结构

```
AnimeHelix/
├── knowledge/                      # 知识图谱
│   └── graph.json                 # 核心图谱数据
├── assets/                         # 资产文件
│   ├── characters/                # 角色资产
│   ├── props/                     # 道具资产
│   ├── scenes/                    # 场景资产
│   ├── styles/                    # 风格资产
│   └── metadata/                  # 元数据
├── scripts/
│   ├── asset_manager.py           # 资产管理器
│   └── generate_video.py          # 智能视频生成
└── docs/
    └── asset_management.md        # 资产管理文档
```
