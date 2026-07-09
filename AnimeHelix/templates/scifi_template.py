import bpy
import math
import os

print('=== 科幻场景模板 ===')

# 配置参数
CONFIG = {
    'project_name': 'scifi_scene',
    'output_dir': './output',
    'resolution': (1024, 576),  # 16:9比例
    'fps': 30,
    'frames': 150,  # 5秒
    'render_engine': 'BLENDER_EEVEE',
}

# 清除场景
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# ========== 场景设置 ==========

# 创建地面（金属地板）
bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = 'MetalFloor'

# 金属地板材质
mat_floor = bpy.data.materials.new(name='MetalFloorMaterial')
mat_floor.use_nodes = True
bsdf = mat_floor.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.1, 0.1, 0.15, 1)  # 深色金属
bsdf.inputs['Metallic'].default_value = 0.9
bsdf.inputs['Roughness'].default_value = 0.3
floor.data.materials.append(mat_floor)

# 创建飞船/载具（简化版）
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=2, radius2=0.5, depth=4, location=(0, 0, 3))
spaceship = bpy.context.active_object
spaceship.name = 'Spaceship'
spaceship.rotation_euler.x = math.radians(90)  # 水平放置

# 飞船材质（金属+发光）
mat_ship = bpy.data.materials.new(name='SpaceshipMaterial')
mat_ship.use_nodes = True
bsdf = mat_ship.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.2, 0.2, 0.3, 1)  # 深色金属
bsdf.inputs['Metallic'].default_value = 0.95
bsdf.inputs['Roughness'].default_value = 0.2
spaceship.data.materials.append(mat_ship)

# 创建发光环（能量场）
bpy.ops.mesh.primitive_torus_add(major_radius=3, minor_radius=0.1, location=(0, 0, 3))
energy_ring = bpy.context.active_object
energy_ring.name = 'EnergyRing'

# 发光材质
mat_energy = bpy.data.materials.new(name='EnergyMaterial')
mat_energy.use_nodes = True
bsdf = mat_energy.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0, 0.8, 1, 1)  # 青色
bsdf.inputs['Emission'].default_value = (0, 0.8, 1, 1)
bsdf.inputs['Emission Strength'].default_value = 5
energy_ring.data.materials.append(mat_energy)

# 创建粒子柱（光束）
bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=6, location=(0, 0, 3))
beam = bpy.context.active_object
beam.name = 'LightBeam'

# 光束材质
mat_beam = bpy.data.materials.new(name='BeamMaterial')
mat_beam.use_nodes = True
bsdf = mat_beam.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.5, 0.8, 1, 1)
bsdf.inputs['Alpha'].default_value = 0.3  # 半透明
beam.data.materials.append(mat_beam)

# ========== 灯光设置 ==========

# 环境光（冷色调）
bpy.ops.object.light_add(type='SUN', location=(10, -10, 20))
sun = bpy.context.active_object
sun.name = 'AmbientLight'
sun.data.energy = 2
sun.data.color = (0.7, 0.8, 1)  # 冷色

# 霓虹灯1（粉色）
bpy.ops.object.light_add(type='POINT', location=(-5, 0, 2))
neon1 = bpy.context.active_object
neon1.name = 'Neon1'
neon1.data.energy = 500
neon1.data.color = (1, 0.2, 0.8)  # 粉色

# 霓虹灯2（青色）
bpy.ops.object.light_add(type='POINT', location=(5, 0, 2))
neon2 = bpy.context.active_object
neon2.name = 'Neon2'
neon2.data.energy = 500
neon2.data.color = (0.2, 0.8, 1)  # 青色

# 飞船底部光
bpy.ops.object.light_add(type='SPOT', location=(0, 0, 1))
ship_light = bpy.context.active_object
ship_light.name = 'ShipLight'
ship_light.data.energy = 1000
ship_light.data.color = (0.3, 0.6, 1)  # 蓝色

# ========== 摄像机设置 ==========

# 环绕摄像机
bpy.ops.object.camera_add(location=(8, -8, 4))
camera = bpy.context.active_object
camera.name = 'Camera'

# 约束对准飞船
constraint = camera.constraints.new(type='TRACK_TO')
constraint.target = spaceship
constraint.track_axis = 'TRACK_NEGATIVE_Z'
constraint.up_axis = 'UP_Y'

bpy.context.scene.camera = camera

print('科幻场景创建完成')

# ========== 动画设置 ==========

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = CONFIG['frames']
scene.render.fps = CONFIG['fps']

# 飞船悬浮动画
for frame in range(1, CONFIG['frames'] + 1):
    t = frame / CONFIG['frames']
    spaceship.location.z = 3 + 0.2 * math.sin(t * 4 * math.pi)  # 上下悬浮
    spaceship.keyframe_insert(data_path='location', frame=frame)

# 能量环旋转
for frame in range(1, CONFIG['frames'] + 1):
    t = frame / CONFIG['frames']
    energy_ring.rotation_euler.z = t * 4 * math.pi  # 快速旋转
    energy_ring.keyframe_insert(data_path='rotation_euler', frame=frame)

# 摄像机环绕
for frame in range(1, CONFIG['frames'] + 1):
    t = frame / CONFIG['frames']
    angle = t * 2 * math.pi
    camera.location.x = 8 * math.cos(angle)
    camera.location.y = 8 * math.sin(angle)
    camera.location.z = 4 + math.sin(t * 2 * math.pi)  # 高度变化
    camera.keyframe_insert(data_path='location', frame=frame)

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
