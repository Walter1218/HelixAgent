# 资产管理系统使用指南

## 系统架构

```
AnimeHelix/
├── knowledge/                      # 知识图谱
│   ├── graph.json                 # 核心图谱数据
│   └── ...
├── assets/                         # 资产文件
│   ├── characters/                # 角色资产
│   ├── props/                     # 道具资产
│   ├── scenes/                    # 场景资产
│   ├── styles/                    # 风格资产
│   └── metadata/                  # 元数据
└── scripts/
    └── asset_manager.py           # 资产管理器
```

## 核心概念

### 1. 资产类型

| 类型 | 说明 | 示例 |
|------|------|------|
| characters | 角色（人物、动物） | 主角A、配角B |
| props | 道具（物体、产品） | 产品盒子、飞船 |
| scenes | 场景（环境、背景） | 室内房间、未来城市 |
| styles | 风格（视觉风格） | 电影级、赛博朋克 |

### 2. 关系类型

| 关系 | 说明 | 示例 |
|------|------|------|
| appears_in | 出现在场景中 | 角色A出现在房间中 |
| interacts_with | 与其他资产交互 | 角色A与角色B对话 |
| placed_in | 放置在场景中 | 产品放在摄影棚 |
| flies_in | 在场景中飞行 | 飞船在城市中飞行 |
| applied_to | 应用风格 | 电影级风格应用于场景 |

### 3. 模板系统

模板定义了视频制作的标准流程，包含：
- 所需资产列表
- 提示词模板
- Blender脚本模板

## 使用方法

### 1. 搜索资产

```python
from scripts.asset_manager import AssetManager

manager = AssetManager("knowledge")

# 搜索红色资产
results = manager.search_assets("red")

# 搜索动漫风格角色
results = manager.search_assets("anime", asset_type="characters")
```

### 2. 获取资产信息

```python
# 获取指定资产
product = manager.get_asset("props", "prop_001")
print(product["name"])  # 产品盒子

# 获取所有道具
all_props = manager.get_all_assets("props")
```

### 3. 获取相关资产

```python
# 获取与角色A相关的资产
related = manager.get_related_assets("char_001")
for r in related:
    print(f"{r['relation']}: {r['asset']['name']}")
```

### 4. 生成提示词

```python
# 使用模板生成提示词
prompt = manager.generate_prompt(
    "ecommerce_product",
    prop={"name": "红色产品盒子"},
    scene={"name": "专业摄影棚"},
    style={"keywords": "电影级画质，专业光影"}
)
# 输出: 专业产品摄影，红色产品盒子在专业摄影棚中展示，电影级画质，专业光影，8K画质
```

### 5. 添加新资产

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

## 工作流程

### 1. 项目规划

```
1. 确定项目类型（电商/剧情/科幻）
2. 从模板获取所需资产
3. 检查资产库是否完整
4. 补充缺失资产
```

### 2. 资产准备

```
1. 创建或获取3D模型
2. 渲染多角度参考图
3. 添加到资产库
4. 建立资产关系
```

### 3. 视频生成

```
1. 选择项目模板
2. 生成提示词
3. 运行Blender脚本
4. AI增强
5. 后期处理
```

## 示例项目

### 电商产品视频

```python
# 1. 获取模板
template = manager.get_template("ecommerce_product")

# 2. 获取所需资产
assets = manager.get_project_assets("ecommerce")

# 3. 生成提示词
prompt = manager.generate_prompt(
    "ecommerce_product",
    prop={"name": assets["prop_001"]["name"]},
    scene={"name": assets["scene_003"]["name"]},
    style={"keywords": "电影级画质，专业光影"}
)

# 4. 运行Blender脚本
os.system("blender --background --python templates/project_template.py")
```

### 剧情短剧

```python
# 1. 获取模板
template = manager.get_template("drama_dialogue")

# 2. 生成提示词
prompt = manager.generate_prompt(
    "drama_dialogue",
    char1={"name": "主角A"},
    char2={"name": "主角B"},
    scene={"name": "现代客厅"},
    style={"keywords": "电影级，暖色调"}
)

# 3. 运行Blender脚本
os.system("blender --background --python templates/drama_template.py")
```

## 扩展指南

### 添加新资产类型

1. 在`knowledge/graph.json`中添加新节点类型
2. 更新`AssetManager`类以支持新类型
3. 创建对应的资产目录
4. 更新模板以使用新资产

### 添加新模板

1. 在`knowledge/graph.json`中添加新模板
2. 创建对应的Blender脚本
3. 更新文档说明

### 自定义提示词模板

在`knowledge/graph.json`的`templates`部分添加新模板：

```json
{
  "my_template": {
    "name": "我的模板",
    "description": "自定义视频模板",
    "required_assets": ["prop_001", "scene_001"],
    "prompt_template": "自定义描述：{prop.name}在{scene.name}中",
    "blender_template": "templates/my_template.py"
  }
}
```

## 最佳实践

### 1. 资产命名规范

- 使用描述性名称
- 添加标签便于搜索
- 包含多角度参考图

### 2. 关系建立

- 建立清晰的资产关系
- 使用有意义的关系类型
- 添加关系描述

### 3. 模板设计

- 保持模板简洁
- 使用通用变量
- 提供默认值

### 4. 版本控制

- 定期备份知识图谱
- 使用Git管理资产
- 记录变更历史

## 故障排除

### 问题：找不到资产

**解决**：
- 检查资产ID是否正确
- 确认资产类型是否存在
- 搜索相关标签

### 问题：提示词生成失败

**解决**：
- 检查模板变量是否正确
- 确认所有必需参数已提供
- 查看模板格式

### 问题：关系查询无结果

**解决**：
- 确认资产ID存在
- 检查关系是否已建立
- 尝试不同的关系类型
