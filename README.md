# 智汇参谋 (Canmou)

企业智能助手平台，整合日程、数据、商机、考勤等核心业务管理功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite 7 |
| 样式 | Tailwind CSS, DaisyUI |
| 后端 | Supabase (Postgres, Auth, Edge Functions) |
| 桌面/移动 | Tauri 2 (Rust) |

## 开发环境要求

- **Node.js** 18+
- **Rust** (cargo) - [安装](https://www.rust-lang.org/tools/install)
- **Android 开发** (仅 APK 构建): Android Studio, JDK 17, Android SDK

## 快速开始

```bash
cd app
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的配置：

```bash
cp .env.example .env
```

### 开发模式

```bash
# Web 开发服务器
npm run dev

# 桌面应用开发（Tauri + Vite）
npm run tauri:dev

# Android 开发
npm run tauri:android:dev
```

## 产品展示页（GitHub Pages）

`docs/` 目录包含产品宣传页，推送代码后会自动部署到 GitHub Pages。

**首次启用：**

1. 打开仓库 **Settings** → **Pages**
2. 在 **Build and deployment** 下，**Source** 选择 **GitHub Actions**
3. 保存后，每次推送到 `main` 分支会自动构建并发布

页面地址：`https://<你的用户名>.github.io/ZhiHuiCanMou/`

---

## 构建发布

### Windows EXE

```bash
cd app
npm run build:exe
```

产物位于 `app/src-tauri/target/release/`：
- `canmou.exe` - 可执行文件
- `bundle/nsis/` - NSIS 安装包
- `bundle/msi/` - MSI 安装包

### Android APK

1. **首次使用**：初始化 Android 项目
   ```bash
   cd app
   npm run tauri:android:init
   ```

2. **构建 APK**
   ```bash
   npm run build:apk
   ```

产物位于 `app/src-tauri/gen/android/app/build/outputs/apk/`。

### 应用图标

使用 1024x1024 PNG 生成各平台图标：

```bash
cd app
npm run tauri:icon
# 将 icon.png 放到 app/ 目录后执行
```

## 项目结构

```
Canmou/
├── app/                    # 主应用
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── config/         # 配置与环境变量
│   │   ├── contexts/       # React 上下文 (Auth)
│   │   ├── lib/            # 工具库 (Supabase, types)
│   │   ├── pages/          # 路由页面
│   │   └── ...
│   ├── src-tauri/          # Tauri 原生层 (Rust)
│   └── package.json
├── supabase/               # Supabase 配置与迁移
│   ├── migrations/
│   └── functions/
└── README.md
```

## 路径别名

- `@/components/*` - 组件
- `@/pages/*` - 页面
- `@/lib/*` - 工具库
- `@/config/*` - 配置
- `@/hooks/*` - 自定义 Hooks

## License

Private
