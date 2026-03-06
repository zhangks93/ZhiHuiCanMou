#!/bin/bash

# Deep Link 测试脚本
# 用于测试 Android 应用的 deep link 功能

echo "=== 智汇参谋 Deep Link 测试 ==="
echo ""

# 检查 adb 是否可用
if ! command -v adb &> /dev/null; then
    echo "错误: adb 未安装或不在 PATH 中"
    echo "请安装 Android SDK Platform Tools"
    exit 1
fi

# 检查设备连接
echo "1. 检查 Android 设备连接..."
DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
    echo "错误: 未检测到 Android 设备"
    echo "请确保设备已连接并启用 USB 调试"
    exit 1
fi
echo "✓ 检测到 $DEVICES 个设备"
echo ""

# 检查应用是否安装
echo "2. 检查应用安装状态..."
PACKAGE="com.canmou.app"
if adb shell pm list packages | grep -q "$PACKAGE"; then
    echo "✓ 应用已安装: $PACKAGE"
else
    echo "✗ 应用未安装: $PACKAGE"
    echo "请先构建并安装应用:"
    echo "  cd app"
    echo "  npm run tauri android build"
    exit 1
fi
echo ""

# 测试 deep link
echo "3. 测试 Deep Link..."
echo "发送测试 deep link: canmou://auth-callback"

# 测试格式 1: 带 hash 参数
echo ""
echo "测试 1: Hash 参数格式"
adb shell am start -W -a android.intent.action.VIEW \
    -d "canmou://auth-callback#access_token=test_token_123&refresh_token=test_refresh_456" \
    2>&1 | grep -E "Status|Activity"

sleep 2

# 测试格式 2: 带 query 参数
echo ""
echo "测试 2: Query 参数格式"
adb shell am start -W -a android.intent.action.VIEW \
    -d "canmou://auth-callback?access_token=test_token_123&refresh_token=test_refresh_456" \
    2>&1 | grep -E "Status|Activity"

echo ""
echo "4. 查看应用日志..."
echo "按 Ctrl+C 停止日志输出"
echo ""
adb logcat -c  # 清除旧日志
adb logcat | grep -i --color=auto "canmou\|deep\|auth\|callback"
