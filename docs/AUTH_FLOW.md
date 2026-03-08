# 智汇参谋 - 登录认证流程说明

## 认证流程概述

### 桌面端流程
1. 用户点击"使用飞书登录"按钮
2. 打开新的 WebView 弹窗，加载飞书授权页面
3. 用户在飞书页面完成授权
4. 飞书重定向到后端 Edge Function (`feishu-callback`)
5. 后端验证并生成 Supabase magic link
6. 重定向到 `/#/auth-callback#access_token=xxx&refresh_token=xxx`
7. AuthCallback 页面解析 token，通过事件发送给主窗口
8. 主窗口接收事件，调用 `supabase.auth.setSession()`
9. OAuth 弹窗自动关闭，用户已登录

### 移动端流程（已优化）
1. 用户点击"使用飞书登录"按钮
2. 使用系统浏览器打开飞书授权页面（必须用系统浏览器，WebView 无法处理 deep link）
3. 用户在飞书页面完成授权
4. 飞书重定向到后端 Edge Function (`feishu-callback?platform=mobile`)
5. 后端验证并生成 Supabase magic link，redirectTo 设置为 `canmou://auth-callback`
6. 系统浏览器重定向到 `canmou://auth-callback#access_token=xxx&refresh_token=xxx`
7. Android 系统识别 deep link，唤起应用
8. Rust 代码使用 `DeepLinkExt` API 监听 deep link 事件
9. 解析 URL，导航到 `/#/auth-callback#access_token=xxx`
10. AuthCallback 页面解析 token，直接调用 `supabase.auth.setSession()`
11. 跳转到首页，用户已登录

## 关键改进

### 1. 使用官方 Deep Link API
**旧方式**（已废弃）:
```rust
app.listen("deep-link://new-url", move |event: tauri::Event| {
    // 手动解析 payload
})
```

**新方式**（推荐）:
```rust
use tauri_plugin_deep_link::DeepLinkExt;

// 检查启动时的 deep link
if let Ok(Some(urls)) = app.deep_link().get_current() {
    handle_deep_link(app.handle(), urls.first());
}

// 监听运行时的 deep link
app.deep_link().on_open_url(move |event| {
    handle_deep_link(&handle, event.urls().first());
});
```

### 2. 统一的 Deep Link 处理
```rust
fn handle_deep_link(handle: &tauri::AppHandle, url: &str) {
    if url.starts_with("canmou://auth-callback") {
        // 解析参数（支持 # 和 ? 两种格式）
        let params = /* 解析逻辑 */;

        // 导航到前端页面
        if let Some(window) = handle.get_webview_window("main") {
            window.eval(&format!("window.location.hash = '/auth-callback#{}'", params));
        }
    }
}
```

### 3. 增强的调试功能
- 登录页面和认证回调页面都添加了详细的调试信息
- 实时显示认证流程的每个步骤
- 便于排查移动端认证问题

### 4. Deep Link 测试工具
访问 `/#/deep-link-test` 可以测试 deep link 功能：
- 测试自定义 URL
- 查看详细日志
- 验证 deep link 是否正常工作

## 关键配置

### 1. Tauri 配置 (`tauri.conf.json`)
```json
{
  "plugins": {
    "deep-link": {
      "domains": [
        {
          "scheme": "canmou"
        }
      ]
    }
  }
}
```

### 2. Capabilities 配置 (`capabilities/default.json`)
```json
{
  "permissions": [
    "opener:default",
    {
      "identifier": "opener:allow-open-url",
      "allow": [
        { "url": "https://**" },
        { "url": "http://**" }
      ]
    }
  ]
}
```

### 3. Android Manifest
Tauri 会自动生成 intent-filter：
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="canmou" />
</intent-filter>
```

### 4. 环境变量
前端 (`.env`):
```
VITE_FEISHU_APP_ID=your_app_id
VITE_FEISHU_REDIRECT_URI=https://your-project.supabase.co/functions/v1/feishu-callback
VITE_FEISHU_SCOPE=contact:user.base:readonly
```

后端 Edge Function:
```
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_LOGIN_REDIRECT_TO=http://localhost:5173/#/auth-callback  # 桌面/Web
FEISHU_LOGIN_REDIRECT_TO_MOBILE=canmou://auth-callback  # 移动端
```

## 调试步骤

### 移动端调试

1. **检查 deep link 是否注册成功**
   ```bash
   # Android
   adb shell am start -a android.intent.action.VIEW -d "canmou://test"
   ```
   应该能唤起应用

2. **查看日志**
   ```bash
   # Android logcat
   adb logcat | grep Canmou
   ```
   应该看到：
   - `[Canmou] Deep link received: canmou://auth-callback#access_token=...`
   - `[Canmou] Processing deep link`
   - `[Canmou] Executing navigation: window.location.hash = ...`

3. **使用测试工具**
   - 在应用中访问 `/#/deep-link-test`
   - 测试不同的 URL 格式
   - 查看详细的执行日志

4. **检查浏览器重定向**
   - 在系统浏览器中手动访问：`canmou://auth-callback#access_token=test&refresh_token=test`
   - 应该能唤起应用并导航到 AuthCallback 页面

5. **查看前端调试信息**
   - 登录页面会显示环境检测、URL 构建等信息
   - AuthCallback 页面会显示 URL 解析、token 提取、会话设置等详细步骤

### 常见问题

#### 问题1: 点击登录按钮没有反应
**可能原因**:
- 环境变量未配置
- 按钮被禁用（检查 `canLogin` 状态）
- JavaScript 错误（查看控制台）

**解决方案**:
- 检查 `.env` 文件是否正确配置
- 重新构建应用：`npm run build`
- 查看登录页面的调试信息

#### 问题2: 浏览器打开后无法返回应用
**可能原因**:
- Deep link 未正确配置
- Android Manifest 缺少 intent-filter
- 后端 redirectTo 参数错误
- Deep link 监听器未正确初始化

**解决方案**:
- 检查 `tauri.conf.json` 中的 deep-link 配置
- 重新构建 Android 应用
- 检查后端 `FEISHU_LOGIN_REDIRECT_TO_MOBILE` 环境变量
- 确认 Rust 代码中使用了 `DeepLinkExt` API

#### 问题3: 返回应用后仍未登录
**可能原因**:
- Token 未正确解析
- `setSession` 调用失败
- Supabase 配置错误

**解决方案**:
- 查看 AuthCallback 页面的调试信息
- 检查 Supabase URL 和 anon key
- 确认后端 Edge Function 正常工作

#### 问题4: Deep link 事件未触发
**可能原因**:
- 使用了旧的事件监听方式
- Deep link 插件未正确初始化
- 应用未在前台运行

**解决方案**:
- 确认使用 `DeepLinkExt` API 而不是 `app.listen()`
- 检查 `get_current()` 和 `on_open_url()` 是否都已设置
- 测试应用在前台和后台时的行为

## 设计特点

### 视觉设计
- **配色**: 深蓝色渐变背景 + 琥珀色强调色
- **字体**: Crimson Text (衬线) + Inter (无衬线)
- **动画**: 流畅的淡入、滑动、旋转动画
- **响应式**: 完美适配桌面和移动端

### 用户体验
- **加载状态**: 清晰的加载指示器和进度条
- **错误处理**: 友好的错误提示和重试机制
- **状态反馈**: 实时显示认证进度（解析 → 认证 → 成功）
- **平滑过渡**: 所有状态变化都有动画过渡
- **调试信息**: 开发模式下显示详细的执行日志

### 技术亮点
- **跨平台**: 统一的代码库，适配 Web/Desktop/Mobile
- **安全**: 使用 Supabase magic link，不在前端存储敏感信息
- **可靠**: 多重 token 解析策略，兼容各种 URL 格式
- **可维护**: 清晰的代码结构和详细的注释
- **可调试**: 完善的日志系统和测试工具

## 文件清单

- `app/src/pages/Login.tsx` - 登录页面（带调试信息）
- `app/src/pages/AuthCallback.tsx` - 认证回调页面（带调试信息）
- `app/src/pages/DeepLinkTest.tsx` - Deep link 测试工具
- `app/src/contexts/AuthContext.tsx` - 认证上下文
- `app/src-tauri/src/lib.rs` - Tauri 主程序（使用 DeepLinkExt API）
- `app/src-tauri/tauri.conf.json` - Tauri 配置
- `app/src-tauri/capabilities/default.json` - 权限配置
- `supabase/functions/feishu-callback/index.ts` - 后端认证处理

## 测试清单

- [ ] 桌面端：弹窗登录流程
- [ ] Web 端：页面跳转登录流程
- [ ] 移动端：系统浏览器登录流程
- [ ] 移动端：Deep link 唤起应用（前台）
- [ ] 移动端：Deep link 唤起应用（后台）
- [ ] 移动端：应用启动时的 deep link 处理
- [ ] 移动端：Token 正确解析
- [ ] 移动端：登录成功后跳转首页
- [ ] Deep link 测试工具：URL 测试
- [ ] Deep link 测试工具：日志显示
- [ ] 错误处理：网络错误
- [ ] 错误处理：Token 缺失
- [ ] 错误处理：Supabase 错误
- [ ] 加载状态：所有加载指示器正常显示
- [ ] 调试信息：登录页面日志
- [ ] 调试信息：回调页面日志
- [ ] 动画效果：所有动画流畅运行
- [ ] 响应式：各种屏幕尺寸正常显示

## 性能优化建议

1. **减少日志输出**: 生产环境可以禁用调试信息
2. **优化动画**: 使用 CSS transform 而不是 position
3. **懒加载**: 按需加载 Tauri 插件
4. **缓存策略**: 合理使用 localStorage 缓存用户信息
