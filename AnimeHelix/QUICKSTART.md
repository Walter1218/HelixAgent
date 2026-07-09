# 快速上手指南

## 方法1：使用Blender GUI

1. 安装Blender
   ```bash
   # 双击安装包
   open blender-5.1.2-macos-arm64.dmg
   ```

2. 打开Blender，进入Scripting工作区

3. 粘贴`blender_product_video.py`脚本到文本编辑器

4. 点击"运行脚本"按钮

5. 等待渲染完成（约30秒）

6. 视频帧将保存在`product_frames/`目录

7. 使用FFmpeg合成视频：
   ```bash
   ffmpeg -framerate 30 -i "product_frames/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p product_video.mp4
   ```

## 方法2：命令行渲染

```bash
# 直接运行脚本
/Applications/Blender.app/Contents/MacOS/Blender --background --python blender_product_video.py

# 合成视频
ffmpeg -framerate 30 -i "product_frames/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p product_video.mp4
```

## 方法3：查看已有视频

直接播放`product_video.mp4`查看效果。

## 自定义修改

### 修改产品颜色
在脚本中找到：
```python
bsdf.inputs['Base Color'].default_value = (0.8, 0.15, 0.15, 1)  # 红色
```
修改为其他颜色值（RGBA，范围0-1）。

### 修改旋转速度
在脚本中找到：
```python
scene.frame_end = 120  # 120帧 = 4秒
```
修改帧数来调整时长。

### 修改分辨率
在脚本中找到：
```python
scene.render.resolution_x = 512
scene.render.resolution_y = 512
```
修改为其他分辨率。

## 故障排除

### 问题：渲染全黑
**原因**：摄像机没有正确对准物体
**解决**：确保使用了`TRACK_TO`约束

### 问题：渲染太慢
**解决**：
- 降低分辨率（如256×256）
- 减少帧数（如60帧=2秒）
- 使用EEVEE引擎（比Cycles快）

### 问题：视频不流畅
**解决**：确保帧率设置为30fps
