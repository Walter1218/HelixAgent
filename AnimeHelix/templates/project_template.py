import bpy
import math
import os

print('=== AnimeHelix 项目模板 ===')

# 配置参数
CONFIG = {
    'project_name': 'template_project',
    'output_dir': './output',
    'resolution': (512, 512),
    'fps': 30,
    'frames': 120,  # 4秒
    'render_engine': 'BLENDER_EEVEE',
}

# 清除场景
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 创建主体（可替换为实际模型）
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
subject = bpy.context.active_object
subject.name = 'Subject'

# 添加材质
mat = bpy.data.materials.new(name='SubjectMaterial')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.8, 0.2, 0.2, 1)
subject.data.materials.append(mat)

# 创建底座
bpy.ops.mesh.primitive_cylinder_add(radius=2, depth=0.2, location=(0, 0, 0))
base = bpy.context.active_object
base.name = 'Base'

# 底座材质
mat_base = bpy.data.materials.new(name='BaseMaterial')
mat_base.use_nodes = True
bsdf = mat_base.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.1, 0.1, 0.1, 1)
bsdf.inputs['Metallic'].default_value = 0.9
base.data.materials.append(mat_base)

# 添加灯光
bpy.ops.object.light_add(type='SUN', location=(5, -5, 10))
sun = bpy.context.active_object
sun.name = 'Sun'
sun.data.energy = 5

bpy.ops.object.light_add(type='POINT', location=(3, -3, 4))
key_light = bpy.context.active_object
key_light.name = 'KeyLight'
key_light.data.energy = 1500

bpy.ops.object.light_add(type='POINT', location=(-3, -2, 3))
fill_light = bpy.context.active_object
fill_light.name = 'FillLight'
fill_light.data.energy = 800

# 添加摄像机
bpy.ops.object.camera_add(location=(5, -5, 4))
camera = bpy.context.active_object
camera.name = 'Camera'

# 使用Track To约束
constraint = camera.constraints.new(type='TRACK_TO')
constraint.target = subject
constraint.track_axis = 'TRACK_NEGATIVE_Z'
constraint.up_axis = 'UP_Y'

bpy.context.scene.camera = camera

print('场景创建完成')

# 设置动画
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = CONFIG['frames']
scene.render.fps = CONFIG['fps']

for frame in range(1, CONFIG['frames'] + 1):
    angle = (frame / CONFIG['frames']) * 2 * math.pi
    subject.rotation_euler.z = angle
    subject.keyframe_insert(data_path='rotation_euler', frame=frame)
    base.rotation_euler.z = angle
    base.keyframe_insert(data_path='rotation_euler', frame=frame)

print('动画设置完成')

# 渲染设置
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
