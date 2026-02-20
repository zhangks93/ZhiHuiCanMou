# GitHub Actions 构建说明

## 工作流说明

`build-release.yml` 用于自动构建智汇参谋的 Windows exe 和 Android APK，并上传到 GitHub Release。

## 触发方式

1. **手动触发**：在 GitHub 仓库的 Actions 页面选择 "Build and Release" 工作流，点击 "Run workflow"
2. **推送触发**：推送到 `release` 分支时自动触发

## 构建产物

- **Windows**：`.msi` 安装包、`.exe` 安装程序（NSIS）
- **Android**：`.apk` 安装包

构建完成后，产物会上传到同一条 GitHub Release 的 Draft 中。

## 前置配置

1. **GitHub Token 权限**：前往仓库 Settings → Actions → General → Workflow permissions，选择 "Read and write permissions"
2. **Android 签名（可选）**：若需发布到应用商店，需配置 [Android 代码签名](https://v2.tauri.app/distribute/sign/android)
