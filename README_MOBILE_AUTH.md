# 移动端认证修复总结

## 问题
在 Android 应用中点击"使用飞书登录"按钮后，页面没有反应，无法完成登录流程。

## 解决方案

### 核心改进

#### 1. 使用官方 Deep Link API
**之前**: 使用已废弃的 `app.listen("deep-link://new-url")` 方式
**现在**: 使用官方 `DeepLinkExt` API，支持应用启动和运行时的 deep link

```rust
// 检查启动时的 deep link
if let Ok(Some(urls)) = app.deep_link().get_current() {
    handle_deep_link(app.handle(), urls.first());
}

// 监听运行时的 deep link
app.deep_link().on_open_url(move |event| {
    handle_deep_link(&handle, event.urls().first());
});
```

#### 2. 统一的 Deep Link 处理函数
创建了独立的 `handle_deep_link()` 函数，支持多种 URL 格式：
- `canmou://auth-callback#access_token=xxx&refresh_token=xxx`
- `canmou://auth-callback?access_token=xxx&refresh_token=xxx`

#### 3. 增强的调试功能
- 登录页面显示实时调试信息（环境检测、URL 构建、浏览器打开状态）
- AuthCallback 页面显示详细执行日志（URL 解析、token 提取、会话设置）
- 便于快速定位问题

#### 4. Deep Link 测试工具
创建了专门的测试页面 `/#/deep-link-test`，可以：
- 测试自定义 deep link URL
- 查看详细的执行日志
- 验证 deep link 功能是否正常

#### 5. 完善的权限配置
更新 `capabilities/default.json`，确保 opener 插件有正确的权限：
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

## 修改的文件

### Rust 后端
- `app/src-tauri/src/lib.rs` - 重写 deep link 处理逻辑
- `app/src-tauri/capabilities/default.json` - 更新权限配置

### 前端
- `app/src/pages/Login.tsx` - 添加调试信息显示
- `app/src/pages/AuthCallback.tsx` - 添加详细执行日志
- `app/src/pages/DeepLinkTest.tsx` - 新增测试工具页面
- `app/src/App.tsx` - 添加测试页面路由

### 文档
- `docs/AUTH_FLOW.md` - 更新认证流程说明
- `docs/MOBILE_AUTH_FIX.md` - 新增修复指南
- `README_MOBILE_AUTH.md` - 本文件

### 脚本
- `scripts/test-mobile-auth.sh` - Linux/Mac 测试脚本
- `scripts/test-mobile-auth.bat` - Windows 测试脚本

## 测试方法

### 快速测试
使用提供的测试脚本：

**Windows**:
```bash
scripts\test-mobile-auth.bat
```

**Linux/Mac**:
```bash
chmod +x scripts/test-mobile-auth.sh
./scripts/test-mobile-auth.sh
```

### 手动测试

1. **构建应用**
```bash
cd app
npm install
npm run build
cd src-tauri
npm run tauri android build
```

2. **安装到设备**
```bash
adb install -r gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

3. **测试 Deep Link**
```bash
adb shell am start -a android.intent.action.VIEW -d "canmou://auth-callback#access_token=test&refresh_token=test"
```

4. **查看日志**
```bash
adb logcat | grep Canmou
```

5. **测试完整流程**
- 打开应用
- 点击"使用飞书登录"
- 观察调试信息
- 在浏览器完成授权
- 验证应用被唤起并成功登录

### 使用测试工具
1. 在应用中访问 `/#/deep-link-test`
2. 输入测试 URL
3. 点击"测试 Deep Link"
4. 查看日志输出

## 预期行为

### 登录流程
1. 点击登录按钮 → 显示"使用系统浏览器打开授权页面"
2. 系统浏览器打开 → 显示"已打开系统浏览器，等待回调..."
3. 完成授权 → 应用被唤起
4. AuthCallback 页面 → 显示"移动端/Web模式: 直接设置会话"
5. 会话设置成功 → 显示"会话设置成功"
6. 跳转首页 → 登录完成

### 日志输出
**Rust 日志** (adb logcat):
```
[Canmou] Deep link received: canmou://auth-callback#access_token=...
[Canmou] Processing deep link: canmou://auth-callback#...
[Canmou] Auth callback detected
[Canmou] Auth params: access_token=...&refresh_token=...
[Canmou] Executing navigation: window.location.hash = '/auth-callback#...'
[Canmou] Navigation successful
```

**前端日志** (调试信息):
```
环境检测: Tauri, 移动端
授权URL: https://open.feishu.cn/open-apis/authen/v1/authorize?...
使用系统浏览器打开授权页面
已打开系统浏览器，等待回调...
```

```
完整URL: canmou://auth-callback#access_token=...
解析参数: {"access_token":"...","refresh_token":"..."}
Token 解析成功
环境: Tauri, 移动端
移动端/Web模式: 直接设置会话
会话设置成功
跳转到首页
```

## 故障排查

### 问题1: 点击登录按钮没有反应
**检查**:
- 查看登录页面的调试信息
- 确认环境变量配置
- 检查控制台错误

**解决**:
- 重新构建应用
- 验证 `.env` 文件
- 查看浏览器控制台

### 问题2: 浏览器打开后无法返回应用
**检查**:
- 运行 `adb shell am start -a android.intent.action.VIEW -d "canmou://test"`
- 查看 logcat 日志
- 确认后端 redirectTo 参数

**解决**:
- 检查 `tauri.conf.json` 配置
- 验证后端环境变量
- 重新构建应用

### 问题3: 应用被唤起但未登录
**检查**:
- 查看 AuthCallback 页面的调试信息
- 确认 token 解析
- 检查 Supabase 配置

**解决**:
- 查看前端日志
- 验证 Supabase 配置
- 测试后端 API

### 问题4: Deep link 事件未触发
**检查**:
- 确认使用 `DeepLinkExt` API
- 检查 `get_current()` 和 `on_open_url()`
- 测试前台/后台行为

**解决**:
- 查看 Rust 实现
- 重新构建应用
- 使用测试工具验证

## 技术亮点

1. **官方 API**: 使用 Tauri 官方推荐的 `DeepLinkExt` API
2. **完整覆盖**: 同时处理应用启动和运行时的 deep link
3. **详细日志**: 前后端都有完善的日志系统
4. **测试工具**: 提供专门的测试页面和脚本
5. **文档完善**: 详细的流程说明和故障排查指南

## 下一步

1. **测试验证**: 在真实设备上测试完整流程
2. **性能优化**: 生产环境禁用调试信息
3. **错误处理**: 添加更多边界情况处理
4. **用户体验**: 优化加载状态和错误提示

## 参考文档

- [AUTH_FLOW.md](./docs/AUTH_FLOW.md) - 详细的认证流程
- [MOBILE_AUTH_FIX.md](./docs/MOBILE_AUTH_FIX.md) - 修复指南
- [Tauri Deep Link 文档](https://v2.tauri.app/plugin/deep-link/)
- [Tauri Opener 文档](https://v2.tauri.app/plugin/opener/)
