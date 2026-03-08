# Android 飞书认证 Deep Link 修复说明

## 问题描述
打包后的 Android 应用在飞书认证完成后，跳转页面显示错误：
```
网页无法打开
位于 canmou://auth-callback#access_token=... 的网页无法加载，因为：
net::ERR_UNKNOWN_URL_SCHEME
```

## 问题原因
移动端 OAuth 流程在应用内的 WebView 中打开。当 Supabase 重定向到自定义 URL scheme `canmou://auth-callback` 时，WebView 尝试直接加载该 URL，但 WebView 无法处理自定义 scheme，导致 `ERR_UNKNOWN_URL_SCHEME` 错误。

## 解决方案
**在系统浏览器中打开 OAuth 流程**，而不是在应用内 WebView 中打开。这样当 Supabase 重定向到 `canmou://` 时，系统浏览器会触发 Android 的 deep link 机制，正确地打开应用并传递参数。

## 修改内容

### 文件：`app/src/pages/Login.tsx`

**修改前**（移动端在 WebView 内跳转）：
```typescript
if (isTauriApp() && !mobile) {
  // 桌面端：使用弹窗 WebView
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const oauthWindow = new WebviewWindow('oauth', { url: urlStr, ... })
} else {
  // 移动端和 Web：直接跳转（问题所在！）
  window.location.href = urlStr
}
```

**修改后**（移动端使用系统浏览器）：
```typescript
if (isTauri && !mobile) {
  // 桌面端：使用弹窗 WebView
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const oauthWindow = new WebviewWindow('oauth', { url: urlStr, ... })
} else if (isTauri && mobile) {
  // 移动端：使用系统浏览器打开（修复！）
  const { open } = await import('@tauri-apps/plugin-opener')
  await open(urlStr)
} else {
  // Web 环境：直接跳转
  window.location.href = urlStr
}
```

## 工作流程

### 修复前（错误流程）
1. 用户点击登录 → 应用内 WebView 打开飞书授权页
2. 用户授权 → Supabase 重定向到 `canmou://auth-callback`
3. ❌ WebView 尝试加载 `canmou://` → `ERR_UNKNOWN_URL_SCHEME`

### 修复后（正确流程）
1. 用户点击登录 → **系统浏览器**打开飞书授权页
2. 用户授权 → Supabase 重定向到 `canmou://auth-callback`
3. ✅ 系统浏览器触发 deep link → Android 打开应用
4. ✅ Tauri deep link 处理器接收 URL → 导航到 `/auth-callback`
5. ✅ AuthCallback 组件解析 token → 登录成功

## 重新构建和测试

### 1. 重新构建应用
```bash
cd app
npm run tauri android build
```

### 2. 安装到设备
```bash
adb install app/src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. 测试流程
1. 在 Android 设备上打开智汇参谋应用
2. 点击"使用飞书登录"按钮
3. 系统浏览器会打开飞书授权页面
4. 点击"同意"授权
5. 浏览器会自动跳转并打开智汇参谋应用
6. 应用显示"登录成功"并跳转到首页

### 4. 查看日志（可选）
```bash
# 查看 deep link 处理日志
adb logcat | grep "\[Canmou\]"

# 应该看到类似输出：
# [Canmou] Deep link received: canmou://auth-callback#access_token=xxx
# [Canmou] Processing auth callback
# [Canmou] Executing JS: window.location.hash = '/auth-callback#...'
```

## 技术细节

### 使用的 Tauri 插件
- `tauri-plugin-opener`：在系统浏览器中打开 URL
- `tauri-plugin-deep-link`：处理自定义 URL scheme 回调

### Android 配置
AndroidManifest.xml 中已配置 deep link intent-filter：
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="canmou" android:host="auth-callback" />
</intent-filter>
```

### Rust 处理逻辑
`app/src-tauri/src/lib.rs` 中的 deep link 处理器会：
1. 接收 `canmou://auth-callback#...` URL
2. 解析 URL 参数
3. 通过 JavaScript 导航到前端路由 `/#/auth-callback#...`

## 相关文件
- `app/src/pages/Login.tsx` - 登录页面（已修改）
- `app/src/pages/AuthCallback.tsx` - 认证回调处理
- `app/src-tauri/src/lib.rs` - Deep link 处理逻辑
- `app/src-tauri/tauri.conf.json` - Tauri 配置
- `supabase/functions/feishu-callback/index.ts` - 飞书回调处理

## 参考文档
- [Tauri Opener Plugin](https://v2.tauri.app/plugin/opener/)
- [Tauri Deep Link Plugin](https://v2.tauri.app/plugin/deep-link/)
- [Android Deep Links](https://developer.android.com/training/app-links/deep-linking)
