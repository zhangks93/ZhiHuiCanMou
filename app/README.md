# 智汇参谋 · 企业智能助手平台

基于 Tauri 2 + React + TypeScript 构建的跨平台企业智能助手应用，支持桌面端与移动端适配。

## 技术栈

- **框架**: Tauri 2, React 19, TypeScript
- **样式**: Tailwind CSS, DaisyUI
- **路由**: React Router v7
- **数据**: Supabase（可扩展对接）

## 功能模块

- 首页总览 - 核心指标、今日日程、经营预警、智能分析
- 日程提醒 - 日历、备忘
- 常用数据 - 组织架构、干部人数
- 经营数据 - 营收达成、预警
- 商机管理 - 进度分布、人员商机
- 出差管理 - 在途人员、统计
- 考勤管理 - 出勤汇总
- 系统链接 - 常用系统入口
- 智能分析 - AI 经营建议
- 设置 - 预警阈值、模块管理

## 开发

```bash
# 安装依赖
npm install

# 开发模式（仅 Web）
npm run dev

# Tauri 开发模式（桌面应用）
npm run tauri:dev

# 构建
npm run build
npm run tauri:build
```

## Supabase 配置

1. 复制 `.env.example` 为 `.env`
2. 在 [Supabase](https://supabase.com) 创建项目
3. 填入 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

数据表结构可根据业务需求在 Supabase 中创建，参考 `src/lib/supabase.ts` 中的类型定义进行扩展。

## 环境要求

- Node.js 18+
- Rust 1.70+（Tauri 构建）
- 各平台 Webview2（Windows）/ WebKit（macOS/Linux）
