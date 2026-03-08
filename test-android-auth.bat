@echo off
REM Android 飞书认证测试脚本 (Windows)

echo ===================================
echo Android 飞书认证测试
echo ===================================
echo.

REM 检查设备连接
echo 1. 检查 Android 设备连接...
adb devices | findstr "device" >nul
if errorlevel 1 (
    echo ❌ 未检测到 Android 设备，请连接设备并启用 USB 调试
    exit /b 1
)
echo ✅ 设备已连接
echo.

REM 检查应用是否已安装
echo 2. 检查应用安装状态...
adb shell pm list packages | findstr "com.canmou.app" >nul
if errorlevel 1 (
    echo ⚠️  应用未安装，请先安装应用
    echo    运行: cd app ^&^& npm run tauri android build
    echo    然后: adb install app\src-tauri\gen\android\app\build\outputs\apk\debug\app-debug.apk
    exit /b 1
)
echo ✅ 应用已安装
echo.

REM 测试 deep link
echo 3. 测试 deep link 处理...
echo    发送测试 deep link: canmou://auth-callback#access_token=test^&refresh_token=test
adb shell am start -W -a android.intent.action.VIEW -d "canmou://auth-callback#access_token=test_token_12345&refresh_token=test_refresh_67890" com.canmou.app

echo.
echo 4. 查看应用日志（按 Ctrl+C 停止）...
echo    查找 [Canmou] 标记的日志...
echo.
adb logcat | findstr "[Canmou] AuthCallback"
