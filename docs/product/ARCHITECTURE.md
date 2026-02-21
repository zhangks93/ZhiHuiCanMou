# 智汇参谋 产品架构

## 产品定位

**数字秘书**：让员工向 AI 汇报工作，管理者通过 AI 汇总与洞察获得决策辅助。

- **员工**：在统一工作台按模块同步进展，链接飞书文档/表格
- **管理者**：AI 自动汇总下属汇报、智能洞察、预警、自然语言追问

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite 7 |
| 样式 | Tailwind CSS, DaisyUI |
| 后端 | Supabase (Postgres, Auth, Edge Functions) |
| 桌面/移动 | Tauri 2 (Rust) |

## 核心模块

### 插件式模块

模块可按租户启用/禁用（`org_settings.enabled_module_ids`）：

| 模块 ID | 名称 | 汇报者视角 | 管理者视角 |
|---------|------|------------|------------|
| work-report | 工作汇报 | 录入进展、附加链接 | 查看下属汇总 |
| schedule | 日程提醒 | 同步日程 | 查看团队日程 |
| org-data | 常用数据 | 更新数据 | 查看组织数据 |
| biz-data | 经营数据 | 填报经营数据 | 查看经营分析 |
| opportunity | 商机管理 | 更新商机进展 | 商机管道视图 |
| competitor | 竞对档案 | 维护竞对信息 | 竞对分析 |
| trip | 出差管理 | 填报出差 | 出差汇总 |
| attendance | 考勤管理 | 考勤记录 | 考勤汇总 |
| links | 系统链接 | - | 快捷入口 |
| ai | 智能分析 | - | AI 汇总、洞察、追问 |

### 数据流

```
员工 → work_items（模块、内容、链接）→ Supabase
         ↓
管理者 ← AI 汇总 (Edge: ai-summarize) ← work_items
         ↓
      自然语言追问 (Edge: ai-qa) ← work_items + 问题
```

## 权限层级

| 层级 | 角色 | 可见范围 |
|------|------|----------|
| 总裁 | president | 全组织 |
| 总监 | director | 本中心及下属 |
| 经理 | manager | 本部门及下属 |
| 主管 | supervisor | 本组及个人 |

基于 `profiles.reports_to_id` 与 `org_nodes` 实现 RLS 数据过滤。

## 术语表

- **work_item**：工作进展条目，关联模块、汇报人、周期
- **org_settings**：租户级配置（启用模块等）
- **org_node**：组织节点（部门/小组树）
