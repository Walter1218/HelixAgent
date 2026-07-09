import bpy
import math
import os

print('=== 电商产品宣传视频 - Blender脚本 ===')

# 阶段1：清除场景
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 阶段2：创建产品（红色盒子）
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1.2))
product = bpy.context.active_object
product.name = 'Product'
product.scale = (1.5, 1, 0.8)

# 产品材质：红色金属
mat_product = bpy.data.materials.new(name='ProductMaterial')
mat_product.use_nodes = True
bsdf = mat_product.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.8, 0.15, 0.15, 1)
bsdf.inputs['Metallic'].default_value = 0.8
bsdf.inputs['Roughness'].default_value = 0.2
product.data.materials.append(mat_product)

# 阶段3：创建旋转台
bpy.ops.mesh.primitive_cylinder_add(radius=2, depth=0.2, location=(0, 0, 0))
platform = bpy.context.active_object
platform.name = 'Platform'

# 旋转台材质：黑色镜面
mat_platform = bpy.data.materials.new(name='PlatformMaterial')
mat_platform.use_nodes = True
bsdf = mat_platform.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.05, 0.05, 0.05, 1)
bsdf.inputs['Metallic'].default_value = 0.9
bsdf.inputs['Roughness'].default_value = 0.05
platform.data.materials.append(mat_platform)

# 阶段4：创建地面
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.1))
ground = bpy.context.active_object
ground.name = 'Ground'
mat_ground = bpy.data.materials.new(name='GroundMaterial')
mat_ground.use_nodes = True
bsdf = mat_ground.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.15, 0.15, 0.15, 1)
ground.data.materials.append(mat_ground)

# 阶段5：添加灯光（三点布光）
bpy.ops.object.light_add(type='SUN', location=(5, -5, 10))
sun = bpy.context.active_object
sun.name = 'Sun'
sun.data.energy = 5

bpy.ops.object.light_add(type='POINT', location=(3, -3, 4))
point1 = bpy.context.active_object
point1.name = 'KeyLight'
point1.data.energy = 1500

bpy.ops.object.light_add(type='POINT', location=(-3, -2, 3))
point2 = bpy.context.active_object
point2.name = 'FillLight'
point2.data.energy = 800

# 阶段6：添加摄像机并用Track To约束对准产品
bpy.ops.object.camera_add(location=(5, -5, 4))
camera = bpy.context.active_object
camera.name = 'Camera'

constraint = camera.constraints.new(type='TRACK_TO')
constraint.target = product
constraint.track_axis = 'TRACK_NEGATIVE_Z'
constraint.up_axis = 'UP_Y'

bpy.context.scene.camera = camera

print('场景创建完成')

# 阶段7：设置旋转动画
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 120
scene.render.fps = 30

for frame in range(1, 121):
    angle = (frame / 120) * 2 * math.pi
    product.rotation_euler.z = angle
    product.keyframe_insert(data_path='rotation_euler', frame=frame)
    platform.rotation_euler.z = angle
    platform.keyframe_insert(data_path='rotation_euler', frame=frame)

print('动画设置完成')

# 阶段8：渲染设置
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.image_settings.file_format = 'PNG'

# 阶段9：渲染动画
output_dir = os.path.join(os.path.dirname(bpy.data.filepath) or '.', 'product_frames')
os.makedirs(output_dir, exist_ok=True)

scene.render.filepath = os.path.join(output_dir, 'frame_')
bpy.ops.render.render(animation=True)

print(f'动画渲染完成: {output_dir}')
print('使用以下命令合成视频:')
print(f'ffmpeg -framerate 30 -i "{output_dir}/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p output.mp4')
