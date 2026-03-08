#!/bin/bash

# Android 飞书认证测试脚本

echo "==================================="
echo "Android 飞书认证测试"
echo "==================================="
echo ""

# 检查设备连接
echo "1. 检查 Android 设备连接..."
if ! adb devices | grep -q "device$"; then
    echo "❌ 未检测到 Android 设备，请连接设备并启用 USB 调试"
    exit 1
fi
echo "✅ 设备已连接"
echo ""

# 检查应用是否已安装
echo "2. 检查应用安装状态..."
if adb shell pm list packages | grep -q "com.canmou.app"; then
    echo "✅ 应用已安装"
else
    echo "⚠️  应用未安装，请先安装应用"
    echo "   运行: cd app && npm run tauri android build"
    echo "   然后: adb install app/src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk"
    exit 1
fi
echo ""

# 测试 deep link
echo "3. 测试 deep link 处理..."
echo "   发送测试 deep link: canmou://auth-callback#access_token=test&refresh_token=test"
adb shell am start -W -a android.intent.action.VIEW \
  -d "canmou://auth-callback#access_token=test_token_12345&refresh_token=test_refresh_67890" \
  com.canmou.app

echo ""
echo "4. 查看应用日志（按 Ctrl+C 停止）..."
echo "   查找 [Canmou] 标记的日志..."
echo ""
adb logcat | grep --color=always -E "\[Canmou\]|AuthCallback"
