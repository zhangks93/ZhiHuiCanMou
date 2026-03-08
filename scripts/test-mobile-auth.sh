#!/bin/bash

# 移动端认证测试脚本

echo "=========================================="
echo "智汇参谋 - 移动端认证测试"
echo "=========================================="
echo ""

# 检查设备连接
echo "1. 检查设备连接..."
DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
    echo "❌ 未检测到 Android 设备"
    echo "请确保设备已连接并启用 USB 调试"
    exit 1
fi
echo "✅ 检测到 $DEVICES 个设备"
echo ""

# 检查应用是否安装
echo "2. 检查应用安装状态..."
PACKAGE="com.canmou.app"
if adb shell pm list packages | grep -q "$PACKAGE"; then
    echo "✅ 应用已安装"
else
    echo "❌ 应用未安装"
    echo "请先构建并安装应用"
    exit 1
fi
echo ""

# 测试 Deep Link
echo "3. 测试 Deep Link..."
echo "测试 URL: canmou://auth-callback#access_token=test123&refresh_token=test456"
adb shell am start -a android.intent.action.VIEW -d "canmou://auth-callback#access_token=test123&refresh_token=test456"
sleep 2
echo "✅ Deep Link 命令已发送"
echo ""

# 查看日志
echo "4. 查看应用日志（按 Ctrl+C 停止）..."
echo "----------------------------------------"
adb logcat -c  # 清除旧日志
adb logcat | grep --color=always "Canmou"
