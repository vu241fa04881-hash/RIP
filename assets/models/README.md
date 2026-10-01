# MoveAssist 3D Exoskeleton Asset Pipeline (.GLB / .GLTF)

This directory is the dedicated drop-in folder for custom 3D exoskeleton models in the **MoveAssist Digital Twin**.

---

## 🚀 Quick Start (Drag & Drop or Direct Drop-In)

### Option A: Direct File Drop-In
Place your model as:
`frontend/assets/models/exoskeleton.glb` (or `assets/models/exoskeleton.glb`)

When MoveAssist loads, it will automatically detect and mount this model!

### Option B: Runtime Upload / Drag & Drop
1. Open the MoveAssist Web Cockpit in your browser (`http://localhost:8000/`).
2. Click **📁 Load .GLB** on the 3D toolbar, or **drag and drop** any `.glb` or `.gltf` file directly onto the 3D viewport canvas.
3. The model will instantly mount and bind to the live 100 Hz telemetry stream!

---

## 📐 Recommended Hierarchy & Node Naming

MoveAssist uses an intelligent fuzzy bone/node resolver. To have your model animate with live joint angles, name your bones or grouped parts using any of the standard conventions below:

| Joint / Body Segment | Supported Object / Bone Names | Controlled Angle |
| :--- | :--- | :--- |
| **Pelvis / Root** | `Pelvis`, `Hips`, `Hip_Center`, `root` | Descent during Sit-Stand |
| **Right Thigh / Hip Joint** | `Right_Thigh`, `Right_Femur`, `Thigh_R`, `UpperLeg_R`, `RightLeg` | `thigh_angle_deg` |
| **Right Knee Joint** | `Right_Knee`, `Knee_R`, `Knee_Right` | `knee_angle_deg` |
| **Right Shank / Calf** | `Right_Shank`, `Right_Tibia`, `Shank_R`, `LowerLeg_R`, `RightCalf` | Kinematic Chain |
| **Right Ankle / Foot** | `Right_Ankle`, `Right_Foot`, `Foot_R`, `FootPlate_R` | Ground Clearance / Sole Leveling |
| **Left Thigh (Optional)** | `Left_Thigh`, `Left_Femur`, `Thigh_L`, `UpperLeg_L` | Contralateral Mode |
| **Left Knee (Optional)** | `Left_Knee`, `Knee_L`, `Knee_Left` | Contralateral Mode |
| **Knee Actuator Housing** | `Actuator`, `Motor`, `Exo_Actuator`, `Knee_Motor` | Command Torque Glow & Rotation |

*Note: If your model is a single rigid unrigged frame, MoveAssist will still load and center it correctly in the medical laboratory scene.*

---

## 🛠️ Exporting CAD to GLB via Blender

1. **Import your CAD model** into Blender:
   - For `.STL`: `File` → `Import` → `STL (.stl)`
   - For `.OBJ`: `File` → `Import` → `Wavefront (.obj)`
   - For `.STEP` / `.IGES`: Use the free [STEPper add-on](https://github.com/amb3/STEPper) or convert in FreeCAD/Fusion 360 to `.obj` / `.stl`.
2. **Set Origin & Pivot Points**:
   - Ensure the hip pivot is at `(0, 0, 0)` of the thigh parent.
   - Ensure the knee pivot is aligned with the rotational hinge center.
3. **Export to GLTF 2.0**:
   - Go to `File` → `Export` → `glTF 2.0 (.glb/.gltf)`.
   - Format: **glTF Binary (.glb)**.
   - Include: **Selected Objects**, **Transform: +Y Up**.
   - Geometry: Check **Apply Modifiers**.
4. Save as `exoskeleton.glb` and place into this directory!
