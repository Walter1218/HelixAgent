# 模板使用指南

## 可用模板

### 1. 电商产品视频模板
**文件**：`templates/project_template.py`

**适用场景**：
- 产品展示
- 品牌宣传
- 广告素材

**特点**：
- 简单几何体产品
- 360度旋转展示
- 三点布光
- 4秒时长

**使用方法**：
```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python templates/project_template.py
```

### 2. 剧情短剧模板
**文件**：`templates/drama_template.py`

**适用场景**：
- 人物对话
- 情感叙事
- 微电影

**特点**：
- 双角色场景
- 室内环境
- 正反打镜头
- 10秒时长

**使用方法**：
```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python templates/drama_template.py
```

### 3. 科幻场景模板
**文件**：`templates/scifi_template.py`

**适用场景**：
- 未来科技
- 太空场景
- 特效展示

**特点**：
- 飞船载具
- 发光能量环
- 霓虹灯光
- 摄像机环绕
- 5秒时长

**使用方法**：
```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python templates/scifi_template.py
```

## 自定义模板

### 修改配置参数

每个模板都有`CONFIG`字典，可以修改以下参数：

```python
CONFIG = {
    'project_name': 'my_project',      # 项目名称
    'output_dir': './output',           # 输出目录
    'resolution': (512, 512),           # 分辨率
    'fps': 30,                          # 帧率
    'frames': 120,                      # 帧数（时长=帧数/帧率）
    'render_engine': 'BLENDER_EEVEE',   # 渲染引擎
}
```

### 修改产品外观

```python
# 修改颜色
bsdf.inputs['Base Color'].default_value = (R, G, B, A)  # RGBA，范围0-1

# 修改金属度
bsdf.inputs['Metallic'].default_value = 0.0  # 0=非金属，1=纯金属

# 修改粗糙度
bsdf.inputs['Roughness'].default_value = 0.5  # 0=光滑，1=粗糙
```

### 修改灯光

```python
# 修改灯光能量
light.data.energy = 1000  # 数值越大越亮

# 修改灯光颜色
light.data.color = (R, G, B)  # RGB，范围0-1

# 修改灯光类型
# 'POINT' - 点光源
# 'SUN' - 太阳光
# 'SPOT' - 聚光灯
# 'AREA' - 面光源
```

### 修改动画

```python
# 修改旋转速度
for frame in range(1, CONFIG['frames'] + 1):
    angle = (frame / CONFIG['frames']) * 2 * math.pi * 2  # 旋转2圈
    object.rotation_euler.z = angle
    object.keyframe_insert(data_path='rotation_euler', frame=frame)

# 修改移动路径
for frame in range(1, CONFIG['frames'] + 1):
    t = frame / CONFIG['frames']
    object.location.x = t * 5  # 从0移动到5
    object.keyframe_insert(data_path='location', frame=frame)
```

## 合成视频

渲染完成后，使用FFmpeg合成视频：

```bash
# 基本命令
ffmpeg -framerate 30 -i "output/project_name/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p output.mp4

# 高质量
ffmpeg -framerate 30 -i "output/project_name/frame_%04d.png" -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4

# 添加音频
ffmpeg -i output.mp4 -i audio.mp3 -c:v copy -c:a aac -shortest final.mp4
```

## 故障排除

### 问题：渲染全黑
**原因**：摄像机没有对准物体
**解决**：确保使用了`TRACK_TO`约束

### 问题：渲染太慢
**解决**：
- 降低分辨率（如256×256）
- 减少帧数（如60帧）
- 使用EEVEE引擎

### 问题：视频不流畅
**解决**：确保帧率设置为24/30fps

### 问题：文件太大
**解决**：降低分辨率或使用更高效的编码

## 进阶技巧

### 1. 使用真实模型
替换模板中的几何体为真实3D模型：
```python
bpy.ops.import_scene.obj(filepath="path/to/model.obj")
```

### 2. 添加纹理
```python
mat.texture_slots.add()
mat.texture_slots[0].texture.image = bpy.data.images.load("path/to/texture.png")
```

### 3. 使用粒子系统
```python
bpy.ops.object.particle_system_add()
particle = bpy.context.object.particle_systems[0]
particle.settings.count = 1000
```

### 4. 添加景深效果
```python
camera.data.dof.use_dof = True
camera.data.dof.focus_distance = 5
camera.data.dof.aperture_fstop = 2.8
```

## 获取帮助

- 查看`AGENTS.md`了解项目规范
- 查看`QUICKSTART.md`快速上手
- 查看`README.md`了解项目概述
