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

### 移动端流程
1. 用户点击"使用飞书登录"按钮
2. 使用系统浏览器打开飞书授权页面（必须用系统浏览器，WebView 无法处理 deep link）
3. 用户在飞书页面完成授权
4. 飞书重定向到后端 Edge Function (`feishu-callback?platform=mobile`)
5. 后端验证并生成 Supabase magic link，redirectTo 设置为 `canmou://auth-callback`
6. 系统浏览器重定向到 `canmou://auth-callback#access_token=xxx&refresh_token=xxx`
7. Android 系统识别 deep link，唤起应用
8. Rust 代码监听 `deep-link://new-url` 事件
9. 解析 URL，导航到 `/#/auth-callback#access_token=xxx`
10. AuthCallback 页面解析 token，直接调用 `supabase.auth.setSession()`
11. 跳转到首页，用户已登录

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

### 2. Android Manifest
需要在 `AndroidManifest.xml` 中配置 intent-filter（Tauri 自动生成）：
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="canmou" />
</intent-filter>
```

### 3. 环境变量
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
   - `[Canmou] Processing auth callback`
   - `[Canmou] Executing JS: window.location.hash = ...`

3. **检查浏览器重定向**
   - 在系统浏览器中手动访问：`canmou://auth-callback#access_token=test&refresh_token=test`
   - 应该能唤起应用并导航到 AuthCallback 页面

4. **检查 AuthCallback 页面**
   - 打开浏览器开发者工具（如果支持）
   - 查看 console.log 输出
   - 确认 token 被正确解析

### 常见问题

#### 问题1: 点击登录按钮没有反应
**可能原因**:
- 环境变量未配置
- 按钮被禁用（检查 `canLogin` 状态）
- JavaScript 错误（查看控制台）

**解决方案**:
- 检查 `.env` 文件是否正确配置
- 重新构建应用：`npm run build`
- 查看浏览器/应用控制台日志

#### 问题2: 浏览器打开后无法返回应用
**可能原因**:
- Deep link 未正确配置
- Android Manifest 缺少 intent-filter
- 后端 redirectTo 参数错误

**解决方案**:
- 检查 `tauri.conf.json` 中的 deep-link 配置
- 重新构建 Android 应用
- 检查后端 `FEISHU_LOGIN_REDIRECT_TO_MOBILE` 环境变量

#### 问题3: 返回应用后仍未登录
**可能原因**:
- Token 未正确解析
- `setSession` 调用失败
- Supabase 配置错误

**解决方案**:
- 查看 AuthCallback 页面的日志
- 检查 Supabase URL 和 anon key
- 确认后端 Edge Function 正常工作

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

### 技术亮点
- **跨平台**: 统一的代码库，适配 Web/Desktop/Mobile
- **安全**: 使用 Supabase magic link，不在前端存储敏感信息
- **可靠**: 多重 token 解析策略，兼容各种 URL 格式
- **可维护**: 清晰的代码结构和详细的注释

## 文件清单

- `app/src/pages/Login.tsx` - 登录页面
- `app/src/pages/AuthCallback.tsx` - 认证回调页面
- `app/src/contexts/AuthContext.tsx` - 认证上下文
- `app/src-tauri/src/lib.rs` - Tauri 主程序（deep link 处理）
- `app/src-tauri/tauri.conf.json` - Tauri 配置
- `supabase/functions/feishu-callback/index.ts` - 后端认证处理

## 测试清单

- [ ] 桌面端：弹窗登录流程
- [ ] Web 端：页面跳转登录流程
- [ ] 移动端：系统浏览器登录流程
- [ ] 移动端：Deep link 唤起应用
- [ ] 移动端：Token 正确解析
- [ ] 移动端：登录成功后跳转首页
- [ ] 错误处理：网络错误
- [ ] 错误处理：Token 缺失
- [ ] 错误处理：Supabase 错误
- [ ] 加载状态：所有加载指示器正常显示
- [ ] 动画效果：所有动画流畅运行
- [ ] 响应式：各种屏幕尺寸正常显示
