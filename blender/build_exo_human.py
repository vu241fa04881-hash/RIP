"""MoveAssist 3D Biomechanical & Exoskeleton Asset Generator
SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147

Builds an anatomically accurate, rigged digital twin avatar and lower-limb
exoskeleton hardware assembly. Exports to .blend and glTF 2.0 (.glb) format
with strict biomechanical Range of Motion (ROM) limits (0° to 120° knee flexion,
zero hyperextension) and MoveAssist naming conventions for live closed-loop
telemetry binding.
"""

import bpy
import math
import os
import shutil

# 1. Clean active scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. Create Skeleton Rig (Armature)
bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
arm_obj = bpy.context.active_object
arm_obj.name = "Human_Exo_Rig"
eb = arm_obj.data.edit_bones

# Pelvis / Root
root = eb['Bone']
root.name = 'Hips'
root.head = (0, 0, 1.0)
root.tail = (0, 0, 1.1)

# Lower Limb Chains
# Blender world coordinates: +X Lateral Right (anatomical left), -X Lateral Left (anatomical right),
# -Y Anterior (front), +Y Posterior (back), +Z Superior (up)
for side, x in [('L', -0.18), ('R', 0.18)]:
    # Femur / Thigh with subtle anatomical pre-flexion bend (-Y is anterior in Blender)
    thigh = eb.new(f'Thigh_{side}')
    thigh.head = (x, 0.0, 1.0)
    thigh.tail = (x, -0.018, 0.52)
    thigh.parent = root

    # Tibia / Shank / Knee
    knee = eb.new(f'Knee_{side}')
    knee.head = (x, -0.018, 0.52)
    knee.tail = (x, 0.0, 0.08)
    knee.parent = thigh
    knee.use_connect = True

    # Foot / Ankle
    ankle = eb.new(f'Ankle_{side}')
    ankle.head = (x, 0.0, 0.08)
    ankle.tail = (x, -0.22, 0.0)
    ankle.parent = knee
    ankle.use_connect = True

    # Inverse Kinematics (IK) Foot Target Controller
    foot_ik = eb.new(f'Foot_IK_{side}')
    foot_ik.head = (x, 0.0, 0.08)
    foot_ik.tail = (x, -0.22, 0.08)
    foot_ik.parent = None  # Independent kinematic target

    # Knee Pole Target (Positioned anteriorly in front of the knee to guide natural posterior flexion)
    knee_pole = eb.new(f'Knee_Pole_{side}')
    knee_pole.head = (x, -0.65, 0.52)
    knee_pole.tail = (x, -0.75, 0.52)
    knee_pole.parent = None  # Independent pole vector controller

# Switch to POSE mode to apply IK and Strict Biomechanical Range of Motion (ROM) Constraints
bpy.ops.object.mode_set(mode='POSE')
for side in ['L', 'R']:
    pose_knee = arm_obj.pose.bones[f'Knee_{side}']
    
    # 1. 2-Bone Inverse Kinematics Solver Constraint
    ik_con = pose_knee.constraints.new('IK')
    ik_con.name = f'IK_Limb_{side}'
    ik_con.target = arm_obj
    ik_con.subtarget = f'Foot_IK_{side}'
    ik_con.chain_count = 2
    ik_con.pole_target = arm_obj
    ik_con.pole_subtarget = f'Knee_Pole_{side}'
    # Pole angle ensures natural posterior knee flexion and forward foot placement
    ik_con.pole_angle = math.radians(-90.0)

    # 2. Strict Biomechanical IK Joint Limits (0° Extension to 120° Flexion, pure sagittal 1-DOF)
    pose_knee.use_ik_limit_x = True
    pose_knee.ik_min_x = 0.0                  # 0° Full Extension limit (prevents hyperextension / recurvatum)
    pose_knee.ik_max_x = math.radians(120.0)  # 120° Deep Flexion limit
    
    # Lock coronal and transverse rotations for single-DOF pure sagittal knee hinge
    pose_knee.use_ik_limit_y = True
    pose_knee.ik_min_y = 0.0
    pose_knee.ik_max_y = 0.0
    pose_knee.use_ik_limit_z = True
    pose_knee.ik_min_z = 0.0
    pose_knee.ik_max_z = 0.0

    # 3. Fallback standard constraint for FK posing / non-IK modes
    rom_limit = pose_knee.constraints.new('LIMIT_ROTATION')
    rom_limit.name = f'Knee_ROM_Limit_{side}'
    rom_limit.owner_space = 'LOCAL'
    rom_limit.use_limit_x = True
    rom_limit.min_x = 0.0
    rom_limit.max_x = math.radians(120.0)

bpy.ops.object.mode_set(mode='OBJECT')

# 3. Shaders / Materials Helper (Cross-Version Blender 3.x and 4.x compatible)
def make_principled_mat(name, base_color, metallic=0.0, roughness=0.5, emission_color=None, emission_strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        bsdf = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    
    if 'Base Color' in bsdf.inputs:
        bsdf.inputs['Base Color'].default_value = base_color
    if 'Metallic' in bsdf.inputs:
        bsdf.inputs['Metallic'].default_value = metallic
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = roughness
        
    if emission_color:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = emission_color
            if 'Emission Strength' in bsdf.inputs:
                bsdf.inputs['Emission Strength'].default_value = emission_strength
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = emission_color
            if 'Emission Strength' in bsdf.inputs:
                bsdf.inputs['Emission Strength'].default_value = emission_strength
    return mat

mat_human = make_principled_mat("Human_Anatomy_Mat", (0.15, 0.22, 0.32, 1.0), metallic=0.0, roughness=0.7)
mat_metal = make_principled_mat("Exo_Metal_Mat", (0.05, 0.06, 0.08, 1.0), metallic=0.95, roughness=0.25)
mat_led = make_principled_mat("Exo_Cyan_Glow", (0.0, 0.85, 1.0, 1.0), metallic=0.0, roughness=0.2,
                              emission_color=(0.0, 0.85, 1.0, 1.0), emission_strength=4.0)

# 4. Geometry Helper (Handles precise bone parenting without world-space displacement)
def create_component(name, bone_name, prim_type, pos, scale, mat, rot=(0, 0, 0)):
    if prim_type == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, rotation=rot)
    elif prim_type == 'cylinder':
        bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=1.0, location=pos, rotation=rot)
    elif prim_type == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.008, location=pos, rotation=rot)

    obj = bpy.context.active_object
    obj.name = name
    if prim_type != 'torus':
        obj.scale = scale
    
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

    # Parent to armature bone
    obj.parent = arm_obj
    obj.parent_type = 'BONE'
    obj.parent_bone = bone_name

    # In Blender Python API, setting matrix_parent_inverse preserves authoring world transform
    if bone_name in arm_obj.pose.bones:
        bone = arm_obj.pose.bones[bone_name]
        obj.matrix_parent_inverse = (arm_obj.matrix_world @ bone.matrix).inverted()

    return obj

# 5. Build Human Anatomy Proxies
create_component("Human_Pelvis", "Hips", 'cube', (0, 0, 1.0), (0.42, 0.22, 0.16), mat_human)
for s, x in [('L', -0.18), ('R', 0.18)]:
    create_component(f"Human_Thigh_{s}", f"Thigh_{s}", 'cylinder', (x, 0, 0.76), (0.08, 0.08, 0.48), mat_human)
    create_component(f"Human_Shank_{s}", f"Knee_{s}", 'cylinder', (x, 0, 0.30), (0.065, 0.065, 0.44), mat_human)
    create_component(f"Human_Foot_{s}", f"Ankle_{s}", 'cube', (x, -0.08, 0.04), (0.10, 0.24, 0.06), mat_human)

# 6. Build Exoskeleton Hardware Elements
for s, x in [('L', -0.18), ('R', 0.18)]:
    x_off = x * 1.35
    create_component(f"Exo_PelvisMount_{s}", "Hips", 'cylinder', (x * 1.3, 0, 0.98), (0.12, 0.12, 0.06), mat_metal)
    create_component(f"Exo_FemurStrut_{s}", f"Thigh_{s}", 'cylinder', (x_off, 0, 0.74), (0.022, 0.022, 0.38), mat_metal)
    create_component(f"Exo_ActuatorKnee_{s}", f"Thigh_{s}", 'cylinder', (x_off, 0, 0.52), (0.055, 0.055, 0.05), mat_metal, (0, math.radians(90), 0))
    create_component(f"Exo_LEDIndicator_{s}", f"Thigh_{s}", 'torus', (x_off + (0.03 if x > 0 else -0.03), 0, 0.52), (1, 1, 1), mat_led, (0, math.radians(90), 0))
    create_component(f"Exo_TibiaStrut_{s}", f"Knee_{s}", 'cylinder', (x_off, 0, 0.30), (0.02, 0.02, 0.36), mat_metal)
    create_component(f"Exo_CalfCuff_{s}", f"Knee_{s}", 'cylinder', (x, 0, 0.32), (0.09, 0.09, 0.04), mat_metal)
    create_component(f"Exo_FootPlate_{s}", f"Ankle_{s}", 'cube', (x_off, -0.06, 0.02), (0.08, 0.22, 0.02), mat_metal)

# 7. Export Assets
out_dir = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(out_dir, exist_ok=True)

blend_path = os.path.join(out_dir, "exo_human_rigged.blend")
glb_path = os.path.join(out_dir, "exo_digital_twin.glb")

bpy.ops.wm.save_as_mainfile(filepath=blend_path)

# glTF 2.0 Export with cross-version kwargs
export_kwargs = {
    'filepath': glb_path,
    'export_format': 'GLB',
    'use_selection': False,
    'export_skins': True,
    'export_morph': True
}
try:
    bpy.ops.export_scene.gltf(**export_kwargs, export_apply=True, export_yup=True)
except TypeError:
    try:
        bpy.ops.export_scene.gltf(**export_kwargs)
    except Exception as e:
        print(f"[WARN] Standard glTF export failed, retrying minimal: {e}")
        bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')

print(f"[SUCCESS] Exported rigged blend to: {blend_path}")
print(f"[SUCCESS] Exported digital twin GLB to: {glb_path}")

# 8. Deploy directly to MoveAssist Frontend & Assets directories
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
deploy_targets = [
    os.path.join(repo_root, "frontend", "assets", "models", "exoskeleton.glb"),
    os.path.join(repo_root, "assets", "models", "exoskeleton.glb"),
]
for target_path in deploy_targets:
    try:
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        shutil.copyfile(glb_path, target_path)
        print(f"[SUCCESS] Deployed model to: {target_path}")
    except Exception as err:
        print(f"[WARN] Could not deploy to {target_path}: {err}")
