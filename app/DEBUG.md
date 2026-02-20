# 白屏排查指南

## 已做的修复

1. **Vite `base: './'`**：确保打包后资源路径在 Tauri 自定义协议下正确加载
2. **AuthContext 异常捕获**：Supabase 初始化失败时不再导致整个应用崩溃
3. **ErrorBoundary**：React 出错时会显示错误信息而非白屏

## 如何查看控制台错误

### 方法一：Tauri 开发者工具（推荐）

1. 运行应用后按 **F12** 或 **Ctrl+Shift+I**
2. 在 DevTools 的 Console 面板查看报错

若 F12 无效，可在 `src-tauri/src/lib.rs` 中临时启用 devtools 插件（需添加 `tauri-plugin-devtools` 依赖）。

### 方法二：命令行运行

在 `app` 目录执行：

```bash
npm run tauri:build
```

构建完成后，直接运行生成的 exe（或在终端中运行），部分错误会输出到终端。

## 常见原因

| 原因 | 排查方法 | 解决方案 |
|------|----------|----------|
| **资源路径错误** | 检查 Console 是否有 404 | 已通过 `base: './'` 修复 |
| **Supabase 未配置** | Console 有 auth/network 相关错误 | 确保构建时 `.env` 中有 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` |
| **CSP 拦截** | Console 有 "Refused to load" | 在 `tauri.conf.json` 的 `security.csp` 中放行所需域名 |
| **构建时未包含 .env** | 打包在 CI 中执行且未传 env | 在 GitHub Actions 中配置 Secrets 并注入环境变量 |

## CI 构建时注入环境变量

若在 GitHub Actions 中构建，需在 workflow 中传入 Supabase 配置，否则打包产物中会是空值：

```yaml
- name: Build Windows executable
  uses: tauri-apps/tauri-action@action-v0.6.1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

在仓库 Settings → Secrets 中新增 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
