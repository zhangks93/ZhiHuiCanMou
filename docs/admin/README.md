# 智汇参谋 管理员手册

## 模块配置

### 启用/禁用模块

通过 `org_settings` 表的 `enabled_module_ids` 字段控制租户可见的模块。默认为全部启用。

示例（SQL）：
```sql
UPDATE org_settings
SET enabled_module_ids = ARRAY['work-report', 'schedule', 'org-data', 'biz-data', 'opportunity', 'ai', 'settings']
WHERE org_id = '你的组织ID';
```

## 组织架构

### 组织节点 (org_nodes)

用于构建部门/小组树，支持层级权限：
- 创建组织节点，设置 `parent_id` 形成树形结构
- 用户的 `org_node_id` 关联到所属节点
- `reports_to_id` 关联直接上级

### 角色分配

在 `profiles` 表中设置 `role`：
- `president`：总裁
- `director`：总监
- `manager`：经理
- `supervisor`：主管

```sql
UPDATE profiles SET role = 'manager', reports_to_id = '上级用户ID' WHERE id = '用户ID';
```

## 飞书对接

### OAuth 配置

1. 飞书开放平台创建应用，获取 `app_id`、`app_secret`
2. 配置 Supabase Edge Function `feishu-callback` 的环境变量：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `FEISHU_LOGIN_REDIRECT_TO`（可选，登录成功跳转 URL）

3. 飞书应用 redirect_uri 需配置为 Edge Function 的 URL

### 用户关联

用户通过飞书 OAuth 登录后，`profiles` 自动创建/更新，包含 `feishu_open_id`、`name`、`avatar_url`，并默认分配 `org_id` 为默认组织。

## AI 服务配置

### OpenAI API（可选）

若要启用 AI 汇总与自然语言追问，在 Supabase Edge Functions 的环境变量中设置：
- `OPENAI_API_KEY`：OpenAI API 密钥

未配置时，工作汇总使用模板生成，追问功能会提示需配置。

### 私有化模型

若使用私有化部署的 OpenAI 兼容 API，可修改 Edge Functions `ai-summarize`、`ai-qa` 中的请求 URL 与模型名称。
