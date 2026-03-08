# 飞书认证 Deep Link 修复

## 问题
在 Android 应用中，飞书认证完成后跳转到 `canmou://auth-callback` 地址时，页面报错显示"网页无法打开"，错误信息为 `net::ERR_UNKNOWN_URL_SCHEME`。

## 根本原因
1. **主要原因**：移动端 OAuth 流程在 WebView 内打开，当 Supabase 重定向到 `canmou://` 时，WebView 尝试直接加载该 URL，导致 `ERR_UNKNOWN_URL_SCHEME` 错误
2. WebView 无法处理自定义 URL scheme，必须由 Android 系统的 deep link 机制处理
3. 需要在系统浏览器中打开 OAuth 流程，这样重定向时才能触发 deep link 并正确打开应用

## 修复内容

### 1. 后端修复 (Rust)

#### `app/src-tauri/Cargo.toml`
添加 deep link 插件依赖：
```toml
tauri-plugin-deep-link = "2"
```

#### `app/src-tauri/src/lib.rs`
- 初始化 `tauri-plugin-deep-link`
- 注册 deep link 处理器，监听 `canmou://` scheme
- 当收到 `canmou://auth-callback` 时，解析 URL 参数并通过 JavaScript 导航到前端路由

#### `app/src-tauri/tauri.conf.json`
配置 deep link scheme：
```json
{
  "plugins": {
    "deep-link": {
      "mobile": {
        "scheme": "canmou"
      }
    }
  }
}
```

### 2. 前端修复 (TypeScript)

#### `app/src/pages/Login.tsx` ⭐ 关键修复
- **移动端使用系统浏览器**：通过 `@tauri-apps/plugin-opener` 在系统浏览器中打开 OAuth 流程
- 这样当 Supabase 重定向到 `canmou://` 时，Android 系统会正确处理 deep link 并打开应用
- 桌面端继续使用 WebView 弹窗（因为桌面环境可以正常处理）
- Web 环境直接跳转（不涉及 deep link）

```typescript
// 移动端 Tauri：使用系统浏览器打开 OAuth
if (isTauri && mobile) {
  const { open } = await import('@tauri-apps/plugin-opener')
  await open(urlStr)
}
```

### 3. 配置验证

#### `app/src-tauri/gen/android/app/src/main/AndroidManifest.xml`
确认包含正确的 intent-filter（已存在）：
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="canmou" android:host="auth-callback" />
</intent-filter>
```

## 工作流程

1. **用户点击飞书登录** → 在系统浏览器中打开飞书授权页面（移动端）
2. **用户授权** → 飞书回调到 Supabase Edge Function
3. **Edge Function 处理** → 生成 magic link 并重定向到 `canmou://auth-callback#access_token=xxx&refresh_token=xxx`
4. **系统浏览器重定向** → 触发 `canmou://` deep link
5. **Android 系统** → 识别 deep link 并打开智汇参谋应用
6. **Tauri Deep Link 处理器** → 接收 URL 并解析参数
7. **JavaScript 导航** → 通过 `window.location.hash` 导航到 `/auth-callback`
8. **AuthCallback 组件** → 解析 token 并调用 `supabase.auth.setSession()`
9. **登录成功** → 跳转到首页

## 测试步骤

### 1. 重新构建应用
```bash
cd app
npm install
npm run tauri android build
```

### 2. 安装到设备
```bash
cd src-tauri/gen/android
./gradlew installDebug
```

或者直接安装 APK：
```bash
adb install app/src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. 测试 Deep Link
使用测试脚本：
```bash
chmod +x test-deep-link.sh
./test-deep-link.sh
```

或手动测试：
```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "canmou://auth-callback#access_token=test&refresh_token=test"
```

### 4. 查看日志
```bash
# Android 系统日志
adb logcat | grep -i "canmou\|deep\|auth"

# WebView 控制台日志
# 在 Chrome 中打开 chrome://inspect
# 连接设备并选择智汇参谋的 WebView
```

### 5. 完整测试流程
1. 在 Android 设备上打开智汇参谋应用
2. 点击"飞书登录"按钮
3. 在飞书授权页面点击"同意"
4. 观察应用是否自动返回并完成登录

## 调试技巧

### 查看 Deep Link 是否被接收
```bash
adb logcat | grep "\[Canmou\]"
```

应该看到类似输出：
```
[Canmou] Deep link received: canmou://auth-callback#access_token=xxx&refresh_token=xxx
[Canmou] Processing auth callback
[Canmou] URL suffix: #access_token=xxx&refresh_token=xxx
[Canmou] Executing JS: window.location.hash = '/auth-callback#access_token=xxx&refresh_token=xxx'
```

### 查看前端日志
在 Chrome DevTools 中应该看到：
```
AuthCallback - Full URL: http://localhost/#/auth-callback#access_token=xxx&refresh_token=xxx
AuthCallback - Parsed params: {access_token: "xxx", refresh_token: "xxx"}
```

### 常见问题

#### 问题 1: "网页无法打开"
- 确保应用已安装
- 重新安装应用以更新 intent-filter
- 检查 URL scheme 是否正确（`canmou://`）

#### 问题 2: 应用打开但未导航
- 查看 logcat 确认 deep link 是否被接收
- 检查 JavaScript 是否执行成功
- 确认前端路由配置正确

#### 问题 3: Token 解析失败
- 检查 URL 格式
- 查看 WebView 控制台日志
- 确认 Supabase Edge Function 返回正确的 URL

## 环境变量

确保 Supabase Edge Function 配置了正确的移动端回调 URL：
```
FEISHU_LOGIN_REDIRECT_TO_MOBILE=canmou://auth-callback
```

## 相关文件

- `app/src-tauri/Cargo.toml` - Rust 依赖配置
- `app/src-tauri/src/lib.rs` - Deep link 处理逻辑
- `app/src-tauri/tauri.conf.json` - Tauri 配置
- `app/src/pages/AuthCallback.tsx` - 前端回调处理
- `supabase/functions/feishu-callback/index.ts` - 飞书回调处理
- `DEEP_LINK_DEBUG.md` - 详细调试指南
- `test-deep-link.sh` - 测试脚本

## 参考文档

- [Tauri Deep Link Plugin](https://v2.tauri.app/plugin/deep-link/)
- [Android Deep Links](https://developer.android.com/training/app-links/deep-linking)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
