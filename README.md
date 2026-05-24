# 智汇参谋 Canmou

智汇参谋是一套面向经营管理场景的企业智能助手应用。当前代码以 React Web 应用为主，结合 Tauri 2 提供桌面端和 Android 打包能力，并通过 Supabase 承载认证、业务数据、组织数据、日程协作与 Edge Functions。

## 当前能力

- 工作台：日程管理、日程收件箱、常用系统链接。
- 数据中枢：经营数据、商机台账、出差记录、考勤统计、人员组织、经营规划。
- AI 分析：基于技能注册表加载智能体，支持经营分析技能、工具调用、Markdown/图表预览与本地对话持久化。
- 设置：经营完成率预警阈值配置、多模型供应商配置。
- 认证：Supabase Auth 与飞书 OAuth 回调，支持 Tauri Deep Link。
- 数据安全：私有导入数据与公开 Pages 产物隔离，CI 会阻断敏感数据和 Excel 文件进入公开发布链路。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19, TypeScript, Vite 7, React Router 7 |
| UI | Tailwind CSS, DaisyUI, Lucide, Recharts, TanStack Table |
| AI | OpenAI-compatible Chat API 配置，技能化 Agent，工具调用 |
| 后端 | Supabase Postgres, Auth, Edge Functions, RLS |
| 桌面/移动 | Tauri 2, Rust, SQLite 本地持久化, Android |
| 质量 | ESLint, Vitest, Rust fmt/clippy/test, Pages 安全扫描 |

## 目录结构

```text
ZhiHuiCanMou/
├── app/                         # 主应用：React + Tauri
│   ├── src/
│   │   ├── app/                 # 路由、布局、配置、Provider
│   │   ├── features/            # 业务模块：工作台、数据、AI、设置、认证
│   │   └── shared/              # 通用 UI、工具库、Agent Runtime
│   ├── src-tauri/               # Tauri/Rust 原生层
│   └── package.json
├── docs/                        # GitHub Pages 产品页
├── scripts/                     # 导入、渲染、CI 安全检查与发布辅助脚本
├── supabase/
│   ├── migrations/              # 数据库迁移
│   └── functions/               # Supabase Edge Functions
├── private-data/                # 本地私有导入数据，不提交
└── README.md
```

## 环境要求

- Node.js 20+ 推荐；本地开发至少需要满足 Vite/React 工具链要求。
- Rust stable 与 Cargo。
- Android 构建需要 Android Studio、JDK 17、Android SDK/NDK。
- Supabase 项目：需要配置 URL、Anon Key、数据库迁移与 Edge Functions。

## 快速开始

```bash
npm install
npm run dev
```

也可以进入应用目录执行：

```bash
cd app
npm install
npm run dev
```

开发服务器默认由 Vite 启动，Tauri 开发模式会自动拉起前端：

```bash
npm run tauri:dev
```

## 环境变量

复制示例文件并按实际环境填写：

```bash
copy app\.env.example app\.env
```

核心变量：

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FEISHU_APP_ID=
VITE_FEISHU_REDIRECT_URI=
VITE_FEISHU_SCOPE=contact:user.base:readonly
VITE_AUTH_CALLBACK_URL=http://localhost:5173/#/auth-callback
```

系统链接可通过 `VITE_LINK_*_URL` 覆盖默认值。AI 模型供应商、API URL、API Key 与模型名在应用内“设置 -> AI 模型配置”中保存。

## 常用脚本

根目录脚本会转发到 `app/`：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Web 开发服务器 |
| `npm run build` | TypeScript 检查并构建前端 |
| `npm run tauri:dev` | 启动桌面端开发模式 |
| `npm run tauri:build` | 构建 Tauri 桌面应用 |
| `npm run build:exe` | 构建 Windows 桌面产物 |

应用目录还提供：

```bash
cd app
npm run lint
npm run test
npm run preview
```

## 构建发布

### Web

```bash
npm run build
```

产物位于 `app/dist/`。

### Windows 桌面端

```bash
npm run build:exe
```

产物位于 `app/src-tauri/target/release/` 与 `app/src-tauri/target/release/bundle/`。

### GitHub Actions

- `CI`：在 `main` 推送和 PR 上运行前端 lint/build/test、Pages 产物检查、私有数据检查、RLS 检查、密钥扫描，以及 Rust fmt/clippy/test。
- `Deploy GitHub Pages`：在 `main` 推送或手动触发时，将 `docs/` 处理为 `.pages-artifact/` 后发布。
- `Build and Release`：当前 workflow 在手动触发、`main` 推送、`app-v*` tag 推送时运行，并按 `app/package.json` 版本创建或更新 GitHub Release。

## GitHub Pages

产品页源码位于 `docs/`。发布前脚本会生成 `.pages-artifact/`，并过滤 `docs/data/**` 与 Excel 文件：

```bash
node scripts/prepare-pages-artifact.mjs --source docs --out .pages-artifact
node scripts/check-public-artifacts.mjs --dir .pages-artifact
```

首次启用 Pages：

1. 打开仓库 `Settings -> Pages`。
2. 在 `Build and deployment` 中将 Source 设置为 `GitHub Actions`。
3. 推送到 `main` 后自动发布。

页面地址通常为：

```text
https://<github-user-or-org>.github.io/ZhiHuiCanMou/
```

## 私有数据与安全约束

- 私有业务数据放在 `private-data/`，该目录已被 `.gitignore` 忽略。
- 不要提交 `docs/data/**`、`*.xls`、`*.xlsx` 或临时 Excel 文件。
- CI 中的 `check-tracked-private-data.mjs`、`check-public-artifacts.mjs`、`check-no-secrets.mjs` 会阻断常见误提交。
- Supabase 迁移需要保持核心业务表 RLS 策略，`check-rls-policies.mjs` 会在 CI 中检查。

## 路径别名

前端代码使用 `@/*` 指向 `app/src/*`，常见路径包括：

- `@/app/*`：应用路由、布局、配置、Provider。
- `@/features/*`：业务功能模块。
- `@/shared/*`：共享 UI、通用库、Agent Runtime。

## License

Private
