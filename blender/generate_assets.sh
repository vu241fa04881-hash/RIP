#!/bin/bash
# MoveAssist -- Blender CLI Rigged 3D Asset Generator
# Linux / macOS Execution Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLENDER_BIN=""

# 1. Check if blender is in PATH
if command -v blender &> /dev/null; then
    BLENDER_BIN="blender"
# 2. Check macOS default application path
elif [ -f "/Applications/Blender.app/Contents/MacOS/Blender" ]; then
    BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"
# 3. Check Linux snap or standard locations
elif [ -f "/snap/bin/blender" ]; then
    BLENDER_BIN="/snap/bin/blender"
elif [ -f "/usr/bin/blender" ]; then
    BLENDER_BIN="/usr/bin/blender"
fi

if [ -z "$BLENDER_BIN" ]; then
    echo "[ERROR] Blender executable not found in PATH or standard application folders."
    echo "Please install Blender from https://www.blender.org/download/."
    exit 1
fi

echo "[OK] Using Blender: $BLENDER_BIN"
echo "[INFO] Running build_exo_human.py in headless background mode..."

"$BLENDER_BIN" --background --python "$SCRIPT_DIR/build_exo_human.py"

# Deploy to frontend assets and project root models folder
if [ -f "$SCRIPT_DIR/output/exo_digital_twin.glb" ]; then
    echo "[INFO] Deploying generated GLB to MoveAssist asset folders..."
    mkdir -p "$SCRIPT_DIR/../frontend/assets/models"
    mkdir -p "$SCRIPT_DIR/../assets/models"
    cp -f "$SCRIPT_DIR/output/exo_digital_twin.glb" "$SCRIPT_DIR/../frontend/assets/models/exoskeleton.glb"
    cp -f "$SCRIPT_DIR/output/exo_digital_twin.glb" "$SCRIPT_DIR/../assets/models/exoskeleton.glb"
    echo "[SUCCESS] Model deployed to:"
    echo "  - frontend/assets/models/exoskeleton.glb"
    echo "  - assets/models/exoskeleton.glb"
fi

echo "======================================================================"
echo "Asset generation completed successfully!"
echo "======================================================================"
