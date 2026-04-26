# GitHub Actions 说明

## 工作流

- `ci.yml`：每次 `pull_request` 和 `main` push 执行前端 lint/build/test、Pages 公开产物扫描、仓库私有数据跟踪扫描、RLS 扫描、密钥扫描、Rust fmt/clippy/test 检查。
- `deploy-pages.yml`：发布 `docs/` 里的公开站点内容，但实际上传前会先生成 `.pages-artifact/`，自动排除 `docs/data/` 和 Excel 文件。
- `build-release.yml`：仅手动触发或推送 `app-v*` tag 时构建桌面端和 Android 产物，并上传到 GitHub Release。

## 触发方式

1. `CI`：Pull Request 与推送到 `main` 自动触发
2. `Deploy GitHub Pages`：推送到 `main` 或手动触发
3. `Build and Release`：手动触发，或推送 `app-v*` tag 时触发

## 构建产物

- **Windows**：`.msi` 安装包、`.exe` 安装程序（NSIS）
- **Android**：`.apk` 安装包

构建完成后，产物会上传到同一条 GitHub Release 的 Draft 中。

## Pages 安全边界

- 公开站点源码保留在 `docs/`
- 私有业务数据必须放在 `private-data/`，禁止继续提交到 `docs/data/`
- CI 与 Pages workflow 都会阻断被 Git 跟踪的 `docs/data/**`、`.xls`、`.xlsx`
- Pages workflow 发布前还会运行公开产物扫描，发现敏感命名文件会直接失败

## 前置配置

1. **GitHub Token 权限**：前往仓库 Settings → Actions → General → Workflow permissions，选择 "Read and write permissions"
2. **Android 签名（可选）**：若需发布到应用商店，需配置 [Android 代码签名](https://v2.tauri.app/distribute/sign/android)
