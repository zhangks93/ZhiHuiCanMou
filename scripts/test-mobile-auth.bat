@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo 智汇参谋 - 移动端认证测试
echo ==========================================
echo.

REM 检查 adb 是否可用
where adb >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 adb 命令
    echo 请确保 Android SDK Platform Tools 已安装并添加到 PATH
    pause
    exit /b 1
)

REM 检查设备连接
echo 1. 检查设备连接...
adb devices | findstr /R "device$" >nul
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Android 设备
    echo 请确保设备已连接并启用 USB 调试
    pause
    exit /b 1
)
echo ✅ 设备已连接
echo.

REM 检查应用是否安装
echo 2. 检查应用安装状态...
set PACKAGE=com.canmou.app
adb shell pm list packages | findstr "%PACKAGE%" >nul
if %errorlevel% neq 0 (
    echo ❌ 应用未安装
    echo 请先构建并安装应用
    pause
    exit /b 1
)
echo ✅ 应用已安装
echo.

REM 测试 Deep Link
echo 3. 测试 Deep Link...
echo 测试 URL: canmou://auth-callback#access_token=test123^&refresh_token=test456
adb shell am start -a android.intent.action.VIEW -d "canmou://auth-callback#access_token=test123&refresh_token=test456"
timeout /t 2 /nobreak >nul
echo ✅ Deep Link 命令已发送
echo.

REM 查看日志
echo 4. 查看应用日志（按 Ctrl+C 停止）...
echo ----------------------------------------
adb logcat -c
adb logcat | findstr "Canmou"
