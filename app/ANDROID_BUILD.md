# Android APK 构建指南

## 前置要求

1. **Android Studio**：从 [Android 开发者网站](https://developer.android.com/studio) 下载安装
2. **环境变量**（Windows PowerShell 示例）：
   ```powershell
   # 设置 JAVA_HOME（路径根据实际安装调整）
   [System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")

   # 设置 ANDROID_HOME 和 NDK_HOME
   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LocalAppData\Android\Sdk", "User")
   $version = Get-ChildItem -Name "$env:LocalAppData\Android\Sdk\ndk" | Select-Object -Last 1
   [System.Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LocalAppData\Android\Sdk\ndk\$version", "User")
   ```
3. **Android SDK 组件**（在 Android Studio SDK Manager 中安装）：
   - Android SDK Platform
   - Android SDK Platform-Tools
   - NDK (Side by side)
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
4. **Rust Android 目标**：
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

## 构建步骤

1. **首次构建需初始化 Android 项目**（若 `src-tauri/gen/android` 不存在）：
   ```bash
   cd app
   npm run tauri:android:init
   ```

2. **构建 APK**：
   ```bash
   npm run tauri:android:build
   ```

3. 构建完成后，APK 文件位于 `app/src-tauri/gen/android/app/build/outputs/apk/` 目录下。

## 可用命令

- `npm run tauri:android:init` - 初始化 Android 项目
- `npm run tauri:android:dev` - 开发模式（连接真机或模拟器）
- `npm run tauri:android:build` - 构建 APK
