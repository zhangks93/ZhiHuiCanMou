# Deep Link 调试指南

## 问题描述
飞书认证完成后跳转到 `canmou://auth-callback` 地址，但页面报错显示"网页无法打开"。

## 已修复的问题

### 1. 添加 Deep Link 插件
- 在 `Cargo.toml` 中添加了 `tauri-plugin-deep-link = "2"`
- 在 `lib.rs` 中初始化并注册了 deep link 处理器
- 在 `tauri.conf.json` 中配置了 deep link scheme

### 2. 改进前端处理
- 更新了 `AuthCallback.tsx` 以支持多种 URL 格式
- 添加了详细的日志输出用于调试
- 改进了参数解析逻辑

## 测试步骤

### 1. 重新构建应用
```bash
cd app
npm run tauri android build
```

### 2. 安装到 Android 设备
```bash
cd src-tauri/gen/android
./gradlew installDebug
```

### 3. 测试 Deep Link
使用 adb 命令测试 deep link 是否正常工作：
```bash
adb shell am start -W -a android.intent.action.VIEW -d "canmou://auth-callback#access_token=test&refresh_token=test"
```

### 4. 查看日志
```bash
adb logcat | grep -i "canmou\|deep\|auth"
```

## 预期行为

1. 飞书认证完成后，浏览器重定向到 `canmou://auth-callback#access_token=xxx&refresh_token=xxx`
2. Android 系统识别 deep link 并打开智汇参谋应用
3. 应用导航到 `/auth-callback` 页面
4. 前端解析 token 并调用 `supabase.auth.setSession()`
5. 登录成功后跳转到首页

## 可能的问题和解决方案

### 问题 1: Deep Link 未被识别
**症状**: 点击链接后显示"无法打开网页"

**解决方案**:
- 确保应用已安装并且 AndroidManifest.xml 包含正确的 intent-filter
- 检查 scheme 和 host 是否匹配：`canmou://auth-callback`
- 重新安装应用以更新 intent-filter

### 问题 2: 应用打开但未导航到正确页面
**症状**: 应用打开但停留在首页或登录页

**解决方案**:
- 检查 `lib.rs` 中的 deep link 处理器是否正确注册
- 查看 logcat 日志确认 deep link 是否被接收
- 确认前端路由配置正确

### 问题 3: Token 解析失败
**症状**: 应用显示"未找到认证信息"

**解决方案**:
- 检查 URL 格式是否正确
- 查看浏览器控制台日志（如果是 WebView）
- 确认 Supabase Edge Function 返回的 redirect URL 格式正确

## 调试技巧

### 1. 启用详细日志
在 `AuthCallback.tsx` 中已添加 console.log，可以通过以下方式查看：

**Android WebView 调试**:
1. 在 Chrome 中打开 `chrome://inspect`
2. 连接 Android 设备
3. 找到智汇参谋应用的 WebView
4. 点击 "inspect" 查看控制台日志

### 2. 测试 URL 格式
在浏览器中测试不同的 URL 格式：
```
canmou://auth-callback#access_token=xxx&refresh_token=xxx
canmou://auth-callback?access_token=xxx&refresh_token=xxx
```

### 3. 验证 Supabase Edge Function
检查 `feishu-callback` Edge Function 返回的 redirect URL：
```typescript
const redirectUrl = platform === 'mobile' ? LOGIN_REDIRECT_TO_MOBILE : LOGIN_REDIRECT_TO
// 应该是: canmou://auth-callback
```

## 环境变量配置

确保 Supabase Edge Function 的环境变量正确设置：
```
FEISHU_LOGIN_REDIRECT_TO_MOBILE=canmou://auth-callback
```

## 下一步

如果问题仍然存在，请：
1. 收集 logcat 日志
2. 收集 WebView 控制台日志
3. 检查飞书回调 URL 的实际格式
4. 验证 Supabase magic link 的生成逻辑
