#!/bin/bash

# 智汇参谋 - 认证流程调试脚本

echo "==================================="
echo "智汇参谋 - 认证流程调试工具"
echo "==================================="
echo ""

# 检查环境变量
echo "1. 检查环境变量配置..."
echo ""

if [ -f "app/.env" ]; then
  echo "✓ 找到 .env 文件"

  if grep -q "VITE_FEISHU_APP_ID" app/.env; then
    echo "✓ VITE_FEISHU_APP_ID 已配置"
  else
    echo "✗ VITE_FEISHU_APP_ID 未配置"
  fi

  if grep -q "VITE_FEISHU_REDIRECT_URI" app/.env; then
    echo "✓ VITE_FEISHU_REDIRECT_URI 已配置"
  else
    echo "✗ VITE_FEISHU_REDIRECT_URI 未配置"
  fi

  if grep -q "VITE_SUPABASE_URL" app/.env; then
    echo "✓ VITE_SUPABASE_URL 已配置"
  else
    echo "✗ VITE_SUPABASE_URL 未配置"
  fi

  if grep -q "VITE_SUPABASE_ANON_KEY" app/.env; then
    echo "✓ VITE_SUPABASE_ANON_KEY 已配置"
  else
    echo "✗ VITE_SUPABASE_ANON_KEY 未配置"
  fi
else
  echo "✗ 未找到 .env 文件"
  echo "  请创建 app/.env 文件并配置必要的环境变量"
fi

echo ""
echo "2. 检查 Tauri 配置..."
echo ""

if [ -f "app/src-tauri/tauri.conf.json" ]; then
  echo "✓ 找到 tauri.conf.json"

  if grep -q '"deep-link"' app/src-tauri/tauri.conf.json; then
    echo "✓ deep-link 插件已配置"

    if grep -q '"canmou"' app/src-tauri/tauri.conf.json; then
      echo "✓ canmou:// scheme 已注册"
    else
      echo "✗ canmou:// scheme 未注册"
    fi
  else
    echo "✗ deep-link 插件未配置"
  fi
else
  echo "✗ 未找到 tauri.conf.json"
fi

echo ""
echo "3. 检查关键文件..."
echo ""

files=(
  "app/src/pages/Login.tsx"
  "app/src/pages/AuthCallback.tsx"
  "app/src/contexts/AuthContext.tsx"
  "app/src-tauri/src/lib.rs"
  "supabase/functions/feishu-callback/index.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ $file (缺失)"
  fi
done

echo ""
echo "4. Android 调试命令..."
echo ""
echo "测试 deep link:"
echo "  adb shell am start -a android.intent.action.VIEW -d \"canmou://auth-callback#access_token=test&refresh_token=test\""
echo ""
echo "查看日志:"
echo "  adb logcat | grep Canmou"
echo ""
echo "查看应用日志:"
echo "  adb logcat | grep -E '(Canmou|chromium)'"
echo ""

echo "5. 构建命令..."
echo ""
echo "开发模式:"
echo "  cd app && npm run tauri dev"
echo ""
echo "构建 Android APK:"
echo "  cd app && npm run tauri android build"
echo ""
echo "构建桌面应用:"
echo "  cd app && npm run tauri build"
echo ""

echo "==================================="
echo "调试完成"
echo "==================================="
echo ""
echo "如果遇到问题，请查看 docs/AUTH_FLOW.md 获取详细说明"
echo ""
