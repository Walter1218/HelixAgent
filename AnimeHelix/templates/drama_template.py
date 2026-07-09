import bpy
import math
import os

print('=== 剧情短剧场景模板 ===')

# 配置参数
CONFIG = {
    'project_name': 'drama_scene',
    'output_dir': './output',
    'resolution': (1024, 576),  # 16:9比例
    'fps': 24,
    'frames': 240,  # 10秒
    'render_engine': 'BLENDER_EEVEE',
}

# 清除场景
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# ========== 场景设置 ==========

# 创建地面（室内地板）
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = 'Floor'

# 地板材质
mat_floor = bpy.data.materials.new(name='FloorMaterial')
mat_floor.use_nodes = True
bsdf = mat_floor.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.4, 0.25, 0.15, 1)  # 木色
floor.data.materials.append(mat_floor)

# 创建墙壁
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, -5, 2.5), rotation=(math.radians(90), 0, 0))
wall_back = bpy.context.active_object
wall_back.name = 'Wall_Back'

# 创建简单角色（用立方体代替）
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1))
character = bpy.context.active_object
character.name = 'Character'
character.scale = (0.4, 0.3, 1)

# 角色材质
mat_char = bpy.data.materials.new(name='CharacterMaterial')
mat_char.use_nodes = True
bsdf = mat_char.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.2, 0.4, 0.8, 1)  # 蓝色衣服
character.data.materials.append(mat_char)

# 创建对话对象（用另一个立方体代替）
bpy.ops.mesh.primitive_cube_add(size=1, location=(2, 0, 1))
character2 = bpy.context.active_object
character2.name = 'Character2'
character2.scale = (0.4, 0.3, 1)

# 对话对象材质
mat_char2 = bpy.data.materials.new(name='Character2Material')
mat_char2.use_nodes = True
bsdf = mat_char2.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.8, 0.2, 0.2, 1)  # 红色衣服
character2.data.materials.append(mat_char2)

# ========== 灯光设置 ==========

# 室内主灯（暖色调）
bpy.ops.object.light_add(type='POINT', location=(0, 0, 3))
indoor_light = bpy.context.active_object
indoor_light.name = 'IndoorLight'
indoor_light.data.energy = 800
indoor_light.data.color = (1, 0.9, 0.8)  # 暖色

# 窗户光（冷色调）
bpy.ops.object.light_add(type='AREA', location=(-4, -3, 2))
window_light = bpy.context.active_object
window_light.name = 'WindowLight'
window_light.data.energy = 300
window_light.data.color = (0.8, 0.9, 1)  # 冷色
window_light.data.size = 2

# ========== 摄像机设置 ==========

# 主摄像机（正反打用）
bpy.ops.object.camera_add(location=(3, -3, 1.5))
camera_main = bpy.context.active_object
camera_main.name = 'Camera_Main'

# 约束对准角色1
constraint = camera_main.constraints.new(type='TRACK_TO')
constraint.target = character
constraint.track_axis = 'TRACK_NEGATIVE_Z'
constraint.up_axis = 'UP_Y'

# 副摄像机（反打用）
bpy.ops.object.camera_add(location=(-1, 3, 1.5))
camera_reverse = bpy.context.active_object
camera_reverse.name = 'Camera_Reverse'

# 约束对准角色2
constraint = camera_reverse.constraints.new(type='TRACK_TO')
constraint.target = character2
constraint.track_axis = 'TRACK_NEGATIVE_Z'
constraint.up_axis = 'UP_Y'

# 设置主摄像机
bpy.context.scene.camera = camera_main

print('剧情场景创建完成')

# ========== 动画设置 ==========

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = CONFIG['frames']
scene.render.fps = CONFIG['fps']

# 角色1走路动画
for frame in range(1, 61):  # 前2.5秒
    t = frame / 60
    character.location.x = t * 2  # 走向角色2
    character.keyframe_insert(data_path='location', frame=frame)

# 角色1停下对话
for frame in range(61, 121):  # 2.5-5秒
    character.location.x = 2
    character.keyframe_insert(data_path='location', frame=frame)

# 角色2转身
for frame in range(61, 91):  # 2.5-3.75秒
    t = (frame - 61) / 30
    character2.rotation_euler.z = t * math.pi  # 转身面对角色1
    character2.keyframe_insert(data_path='rotation_euler', frame=frame)

# 摄像机切换（正反打）
for frame in range(1, CONFIG['frames'] + 1):
    if frame < 60:
        bpy.context.scene.camera = camera_main
    elif frame < 120:
        bpy.context.scene.camera = camera_reverse
    else:
        bpy.context.scene.camera = camera_main

print('动画设置完成')

# ========== 渲染设置 ==========

scene.render.engine = CONFIG['render_engine']
scene.render.resolution_x = CONFIG['resolution'][0]
scene.render.resolution_y = CONFIG['resolution'][1]
scene.render.image_settings.file_format = 'PNG'

# 创建输出目录
output_dir = os.path.join(CONFIG['output_dir'], CONFIG['project_name'])
os.makedirs(output_dir, exist_ok=True)

# 渲染动画
scene.render.filepath = os.path.join(output_dir, 'frame_')
bpy.ops.render.render(animation=True)

print(f'渲染完成: {output_dir}')
print('使用以下命令合成视频:')
print(f'ffmpeg -framerate {CONFIG["fps"]} -i "{output_dir}/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p {CONFIG["project_name"]}.mp4')
