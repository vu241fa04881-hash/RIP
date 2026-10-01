@echo off
setlocal enabledelayedexpansion

echo ======================================================================
echo MoveAssist -- Blender CLI Rigged 3D Asset Generator
echo ======================================================================

set "BLENDER_BIN="

:: 1. Check if blender is in PATH
where blender >nul 2>nul
if %errorlevel% equ 0 (
    set "BLENDER_BIN=blender"
    goto :FOUND
)

:: 2. Search common Blender Foundation installation directories
for /d %%D in ("C:\Program Files\Blender Foundation\Blender*") do (
    if exist "%%D\blender.exe" (
        set "BLENDER_BIN=%%D\blender.exe"
        goto :FOUND
    )
)

for /d %%D in ("%LOCALAPPDATA%\Programs\Blender Foundation\Blender*") do (
    if exist "%%D\blender.exe" (
        set "BLENDER_BIN=%%D\blender.exe"
        goto :FOUND
    )
)

:: 3. Search Steam, Scoop, and Chocolatey
if exist "C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe" (
    set "BLENDER_BIN=C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe"
    goto :FOUND
)
if exist "C:\Program Files\Steam\steamapps\common\Blender\blender.exe" (
    set "BLENDER_BIN=C:\Program Files\Steam\steamapps\common\Blender\blender.exe"
    goto :FOUND
)
if exist "%USERPROFILE%\scoop\apps\blender\current\blender.exe" (
    set "BLENDER_BIN=%USERPROFILE%\scoop\apps\blender\current\blender.exe"
    goto :FOUND
)
if exist "C:\ProgramData\chocolatey\bin\blender.exe" (
    set "BLENDER_BIN=C:\ProgramData\chocolatey\bin\blender.exe"
    goto :FOUND
)

echo [ERROR] Blender executable not detected in PATH or standard installation folders.
echo Please install Blender from https://www.blender.org/download/ or add blender.exe to your PATH.
exit /b 1

:FOUND
echo [OK] Using Blender executable: "%BLENDER_BIN%"
echo [INFO] Generating rigged 3D digital twin mesh and exporting GLB...

"%BLENDER_BIN%" --background --python "%~dp0build_exo_human.py"
if %errorlevel% neq 0 (
    echo [ERROR] Blender script execution failed with exit code %errorlevel%.
    exit /b %errorlevel%
)

:: Automatically deploy to MoveAssist frontend assets folder
if exist "%~dp0output\exo_digital_twin.glb" (
    echo [INFO] Deploying generated GLB to MoveAssist asset folders...
    mkdir "%~dp0..\frontend\assets\models" 2>nul
    mkdir "%~dp0..\assets\models" 2>nul
    copy /Y "%~dp0output\exo_digital_twin.glb" "%~dp0..\frontend\assets\models\exoskeleton.glb" >nul
    copy /Y "%~dp0output\exo_digital_twin.glb" "%~dp0..\assets\models\exoskeleton.glb" >nul
    echo [SUCCESS] Model deployed to:
    echo   - frontend\assets\models\exoskeleton.glb
    echo   - assets\models\exoskeleton.glb
)

echo ======================================================================
echo Asset generation completed successfully!
echo ======================================================================
pause
