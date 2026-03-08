# 移动端认证问题修复指南

## 问题描述
在 Android 应用中点击"使用飞书登录"按钮后，页面没有反应，无法完成登录流程。

## 修复内容

### 1. 更新 Rust Deep Link 处理
- 从旧的 `app.listen()` 方式迁移到官方 `DeepLinkExt` API
- 同时处理应用启动时和运行时的 deep link
- 改进 URL 参数解析逻辑

### 2. 增强前端调试功能
- 登录页面添加实时调试信息显示
- AuthCallback 页面添加详细的执行日志
- 便于排查移动端认证问题

### 3. 添加测试工具
- 创建 Deep Link 测试页面 (`/#/deep-link-test`)
- 可以测试自定义 URL 和查看执行日志

### 4. 更新权限配置
- 完善 `capabilities/default.json` 配置
- 确保 opener 插件有正确的权限

## 构建步骤

### 1. 安装依赖
```bash
cd app
npm install
```

### 2. 配置环境变量
确保 `app/.env` 文件包含以下配置：
```env
VITE_FEISHU_APP_ID=your_app_id
VITE_FEISHU_REDIRECT_URI=https://your-project.supabase.co/functions/v1/feishu-callback
VITE_FEISHU_SCOPE=contact:user.base:readonly
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. 构建前端
```bash
npm run build
```

### 4. 构建 Android 应用
```bash
cd src-tauri
npm run tauri android build
```

或者使用调试模式：
```bash
npm run tauri android dev
```

## 测试步骤

### 1. 安装应用到设备
```bash
# 通过 USB 连接设备
adb devices

# 安装 APK
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

### 2. 测试 Deep Link
```bash
# 测试 deep link 是否能唤起应用
adb shell am start -a android.intent.action.VIEW -d "canmou://auth-callback#access_token=test&refresh_token=test"
```

应该能看到应用被唤起并导航到 AuthCallback 页面。

### 3. 查看日志
```bash
# 实时查看应用日志
adb logcat | grep Canmou
```

应该能看到类似以下的日志：
```
[Canmou] Deep link received: canmou://auth-callback#access_token=...
[Canmou] Processing deep link: canmou://auth-callback#...
[Canmou] Auth callback detected
[Canmou] Auth params: access_token=...&refresh_token=...
[Canmou] Executing navigation: window.location.hash = '/auth-callback#...'
[Canmou] Navigation successful
```

### 4. 测试完整登录流程
1. 打开应用
2. 点击"使用飞书登录"按钮
3. 观察登录页面的调试信息
4. 在系统浏览器中完成飞书授权
5. 应用应该被自动唤起
6. 观察 AuthCallback 页面的调试信息
7. 成功后应该跳转到首页

### 5. 使用测试工具
1. 在应用中访问 `/#/deep-link-test`
2. 测试不同的 URL 格式
3. 查看详细的执行日志

## 常见问题排查

### 问题1: 点击登录按钮没有反应
**检查步骤**:
1. 查看登录页面的调试信息
2. 确认环境变量是否正确配置
3. 检查是否有 JavaScript 错误

**解决方案**:
- 重新构建应用
- 检查 `.env` 文件
- 查看浏览器控制台

### 问题2: 浏览器打开后无法返回应用
**检查步骤**:
1. 测试 deep link 是否能唤起应用（使用 adb 命令）
2. 查看 logcat 日志
3. 确认后端 redirectTo 参数

**解决方案**:
- 确认 `tauri.conf.json` 中的 deep-link 配置
- 检查后端环境变量 `FEISHU_LOGIN_REDIRECT_TO_MOBILE`
- 重新构建 Android 应用

### 问题3: 应用被唤起但未登录
**检查步骤**:
1. 查看 AuthCallback 页面的调试信息
2. 确认 token 是否正确解析
3. 检查 Supabase 配置

**解决方案**:
- 查看前端日志
- 确认 Supabase URL 和 anon key
- 测试后端 Edge Function

### 问题4: Deep link 事件未触发
**检查步骤**:
1. 确认使用了 `DeepLinkExt` API
2. 检查 `get_current()` 和 `on_open_url()` 是否都已设置
3. 测试应用在前台和后台时的行为

**解决方案**:
- 查看 Rust 代码实现
- 重新构建应用
- 使用测试工具验证

## 调试技巧

### 1. 启用详细日志
在 Rust 代码中添加更多 `println!` 语句：
```rust
println!("[Canmou] Debug: {}", debug_info);
```

### 2. 使用 Chrome DevTools
如果设备支持，可以使用 Chrome 远程调试：
```bash
# 在 Chrome 中访问
chrome://inspect
```

### 3. 查看完整的 logcat
```bash
# 查看所有日志
adb logcat

# 过滤特定标签
adb logcat -s Canmou
```

### 4. 测试不同场景
- 应用在前台时接收 deep link
- 应用在后台时接收 deep link
- 应用未运行时通过 deep link 启动

## 性能优化

### 1. 减少日志输出
生产环境可以禁用调试信息：
```typescript
const DEBUG = import.meta.env.DEV
if (DEBUG) {
  addDebugInfo(msg)
}
```

### 2. 优化构建大小
```bash
# 使用 release 模式构建
npm run tauri android build -- --release
```

### 3. 启用代码分割
在 `vite.config.ts` 中配置：
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
      }
    }
  }
}
```

## 相关文档
- [AUTH_FLOW.md](./AUTH_FLOW.md) - 详细的认证流程说明
- [Tauri Deep Link 文档](https://v2.tauri.app/plugin/deep-link/)
- [Tauri Opener 文档](https://v2.tauri.app/plugin/opener/)
