# Codex 执行计划：仓库安全、质量与产品闭环整改

> 来源：根据 ChatGPT 对代码仓库的静态审查结果整理。该审查覆盖代码结构、功能实现、配置、迁移脚本、工作流与发布目录；但未完成可执行构建验证，因为 `npm ci` 超时，且审查环境没有 `cargo`，Rust/Tauri 测试未运行。

## 0. 给 Codex 的执行原则

### 目标

将当前仓库从“功能骨架完整但存在生产风险”的状态，推进到“可控、安全、可测试、可发布”的状态。

### 优先级

1. **P0：安全止血**
   - 防止业务 Excel 数据继续被公开发布。
   - 收紧 Supabase RLS，避免匿名或宽泛读写企业数据。
   - 清理环境变量和导入脚本中的默认真实项目信息。
   - 收紧 Tauri 权限与 CSP。

2. **P1：交付质量与核心闭环**
   - 修复 DataHub 模块注册不一致。
   - 建立 CI、测试和发布门禁。
   - 合并重复 GitHub Pages workflow。
   - 补齐关键页面的加载、错误、空状态、数据更新时间。
   - 提升 AI 回答的来源引用和可解释性。

3. **P2：可维护性重构**
   - 拆分超大文件。
   - 生成 Supabase 类型并移除 `as any`。
   - 引入统一 logger。
   - 强化本地 LLM key 存储。
   - 规范导入脚本 dry-run、审计和校验。

4. **P3：产品增强**
   - 角色化经营首页。
   - AI 分析报告导出。
   - 数据治理、血缘、导入批次、质量评分。
   - 决策闭环：发现问题 → 分派动作 → 追踪结果。

### 执行约束

- 不要一次性做大范围无关重构；每个任务尽量形成独立 PR。
- 优先修安全与发布风险，再做体验和架构优化。
- 所有涉及数据删除、历史重写、密钥轮换、RLS 策略大改的动作，应在代码中实现检查和文档，但不要自动执行破坏性操作。
- 对现有功能保持向后兼容，尤其是 Tauri 本地 SQLite 日程数据。
- 每个任务完成后运行可用的检查命令，并在提交说明中写明未能运行的命令及原因。

### 建议基础检查命令

在仓库支持的情况下，Codex 应优先尝试：

```bash
npm ci
npm run lint
npm run build
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

如果仓库暂未提供对应脚本，应新增或在计划中记录缺口。

---

## 1. 推荐分支与 PR 拆分

### PR-01：P0 安全止血

范围：

- 移除公开发布目录中的业务数据。
- 清理 `.env.example` 与导入脚本默认 key。
- 合并/限制 Pages workflow。
- 新增敏感文件提交和发布检查。
- 新增 migration RLS 安全扫描脚本。

### PR-02：P0 权限与桌面安全

范围：

- 收紧 Supabase RLS 策略。
- 收紧 Tauri capabilities。
- 限制 HTTP、opener、shell 权限。
- 调整 CSP 的生产配置。
- 为 deep link 回调增加参数校验。

### PR-03：P1 CI、测试与发布治理

范围：

- 完善 GitHub Actions。
- 增加 lint/build/test 质量门禁。
- 整理 release workflow。
- 修正文档与 workflow 触发条件不一致。
- 支持按平台独立构建和重跑。

### PR-04：P1 产品主路径与 DataHub 一致性

范围：

- 新增管理者首页 / 今日经营简报。
- 修复历史数据模块配置与 DataHub tab 不一致。
- 给数据页补齐统一状态组件。
- 优化日程收件箱状态表达。
- 优化 AI 回答来源和结构化呈现。

### PR-05：P2 类型、安全存储与日志

范围：

- 生成 Supabase Database 类型。
- 移除 `scheduleTransferRepository.ts` 中的 `supabase as any`。
- 新增统一 logger。
- 生产环境默认关闭 debug 日志。
- 本地 LLM key 迁移到安全存储方案或服务端 LLM Proxy 接口抽象。

### PR-06：P2 大文件拆分

范围：

- 拆分 `chatAgent.ts`。
- 拆分 `SchedulePage.tsx`。
- 拆分 `bizDataService.ts`。
- 拆分 `TableView.tsx`。
- 拆分 `index.css`。

---

## 2. P0 任务清单：安全止血

### SEC-001：阻止 `docs/data` 业务数据公开发布

**背景**

仓库中 `docs/data` 包含业务 Excel 文件，例如经营数据、商机台账、出差申请、组织标签映射表、考勤数据等。当前 Pages workflow 上传整个 `docs` 目录，存在业务数据随 GitHub Pages 公开发布的风险。

**目标**

确保任何公开站点发布产物都不包含业务 Excel 或私有数据。

**建议修改**

- 将 `docs/data` 移出公开发布目录，例如移动到 `private-data/` 或仓库外的受控数据目录。
- 将 GitHub Pages 发布目录改成纯静态站点目录，例如 `docs-site/`。
- 更新 `.gitignore`：

```gitignore
docs/data/
private-data/
*.xlsx
*.xls
~$*
```

- 新增脚本，例如 `scripts/check-public-artifacts.mjs`，扫描待发布目录是否包含：
  - `.xls`
  - `.xlsx`
  - `.csv`，如包含敏感业务数据
  - `docs/data`
  - 文件名含 `经营数据`、`商机`、`考勤`、`出差`、`组织标签`
- 在 Pages workflow 中发布前运行该脚本。

**验收标准**

- Pages workflow 不再上传整个 `docs` 目录。
- 发布目录中不存在 `docs/data`。
- CI 能阻断 Excel 文件进入公开发布目录。
- README 或部署文档说明公开站点目录与私有数据目录的边界。

---

### SEC-002：检查历史与已发布 artifact 风险

**背景**

即使当前代码移除数据文件，历史 commit、GitHub Pages artifact、release artifact 仍可能包含业务 Excel。

**目标**

给维护者提供明确的历史风险检查步骤。

**建议修改**

新增文档 `docs/security/data-exposure-remediation.md`，包含：

- 如何检查 GitHub Pages 历史 artifact。
- 如何检查 release artifact。
- 如何搜索 Git 历史中的 Excel 和敏感文件。
- 如果仓库曾公开，建议执行：
  - 密钥轮换
  - Pages artifact 清理
  - Release artifact 清理
  - Git 历史清理方案评估
- 明确：Git 历史重写需要人工确认，不由 CI 自动执行。

**验收标准**

- 存在数据暴露修复文档。
- 文档中包含可复制命令。
- 文档明确哪些操作需要人工审批。

---

### SEC-003：收紧 Supabase RLS

**背景**

多个 migration 中存在类似 `using (true)` / `with check (true)` 的策略，可能导致客户端拿到 anon key 后拥有远超预期的读写权限。

**目标**

所有业务表默认启用 RLS，禁止匿名或宽泛读写企业数据。

**建议修改**

- 检查 `supabase/migrations/*` 中：
  - `using (true)`
  - `with check (true)`
  - `to public`
  - 未启用 RLS 的业务表
- 新增脚本 `scripts/check-rls-policies.mjs`，在 CI 中扫描 migration。
- 对业务表引入权限字段：
  - `org_id`
  - `owner_id`
  - `created_by`
  - `visible_to`
- 读权限至少限制为 `authenticated`。
- 写权限优先通过：
  - Edge Function
  - 后台导入任务
  - service role 环境变量
  - 管理后台
- 导入脚本不要使用 anon key 写入敏感表。

**验收标准**

- CI 中 migration 扫描会阻断新增宽泛策略。
- 业务表没有无说明的 `using (true)` / `with check (true)`。
- 客户端 anon key 不具备敏感表直接写入权限。
- 若短期必须保留某个宽泛策略，必须添加注释、TODO 和 issue 编号。

---

### SEC-004：清理环境变量示例与导入脚本默认值

**背景**

`.env.example` 和部分导入脚本中存在真实形式的 Supabase URL、anon key、飞书 app id，导入脚本还可能有默认项目 URL 和 anon key。

**目标**

示例配置只保留占位符；导入脚本缺少必要环境变量时直接失败。

**建议修改**

- 将 `.env.example` 改为：

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_FEISHU_APP_ID=your-feishu-app-id
```

- 移除 Python/Node 导入脚本中的硬编码 URL/key 默认值。
- 导入脚本启动时校验：
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - 数据文件路径
- 缺少环境变量时以非 0 状态码退出。
- 增加 `--dry-run` 和 `--confirm`。

**验收标准**

- `.env.example` 不含真实项目标识或真实 key。
- 导入脚本不再 fallback 到内置默认 Supabase 项目。
- 缺少必要 env 时导入脚本失败并输出清晰错误。
- 文档说明客户端 anon key 与 service role key 的区别。

---

### SEC-005：收紧 Tauri capabilities 与 CSP

**背景**

`src-tauri/capabilities/default.json` 中 HTTP、opener、shell、webview 权限偏宽；`tauri.conf.json` 的 CSP 含 `'unsafe-inline'`。

**目标**

将桌面端权限改为最小可用范围。

**建议修改**

- HTTP scope 只允许实际需要域名：
  - Supabase 项目域名
  - Feishu OAuth/API 域名
  - 企业自有 API 域名
- opener 只允许 OAuth、帮助文档、可信外链。
- 不需要 shell 权限则移除。
- 区分开发和生产 CSP。
- 生产 CSP 尽量移除 `'unsafe-inline'`。
- deep link scheme `canmou` 增加来源校验和回调参数校验。

**验收标准**

- `http://**`、`https://**` 等通配 scope 被移除或有明确例外说明。
- shell 权限最小化。
- 生产 CSP 不再无条件依赖 `'unsafe-inline'`。
- OAuth/deep link 回调有参数校验。

---

## 3. P1 任务清单：交付质量与核心体验

### IA-001：修复 DataHub 模块注册不一致

**背景**

历史数据模块配置、旧路径重定向和 DataHub tab 曾存在多处事实来源，容易出现“路由可达但页面不可见”的状态。

**目标**

让路由、模块配置、DataHub tab 共用同一个事实来源。

**建议修改**

- 让 DataHub tabs 从 `modules.ts` 或统一 registry 派生。
- 避免 `modules.ts`、routes、`DATA_TABS` 各自维护一份模块列表。

**验收标准**

- 历史数据模块不会出现“路由可达但页面不可见”的状态。
- 新增模块只需在一个注册源维护。
- DataHub tab、侧边栏和路由行为一致。

---

### UX-001：新增管理者首页 / 今日经营简报

**目标**

把当前“功能集合”升级为“管理闭环”，为管理者提供默认入口。

**建议展示模块**

- 今日重点日程。
- 未处理日程包 / 收件箱提醒。
- 本月经营异常指标。
- Top 商机进展 / 风险项目。
- 最新数据更新时间。
- AI 快捷问题：
  - “本月收入异常的部门有哪些？”
  - “有哪些商机超过 30 天未推进？”
  - “根据本周日程，帮我整理管理重点。”

**建议文件**

- `src/features/home/pages/ManagerBriefingPage.tsx`
- `src/features/home/components/TodayScheduleCard.tsx`
- `src/features/home/components/BusinessAlertsCard.tsx`
- `src/features/home/components/OpportunityRiskCard.tsx`
- `src/features/home/components/AiQuickQuestions.tsx`

**验收标准**

- 登录后默认首页能看到今日经营简报。
- 首页能处理数据加载中、空数据、错误状态。
- 每个指标展示数据来源和更新时间。
- AI 快捷问题能带上下文进入 AI 助手。

---

### UX-002：数据页统一状态组件

**背景**

关键页面缺少统一的加载、空状态、错误状态、数据更新时间展示。

**目标**

统一数据页的反馈体验。

**建议新增组件**

- `DataLoadingState`
- `DataEmptyState`
- `DataErrorState`
- `DataFreshnessBadge`
- `ActiveFiltersSummary`

**建议路径**

`src/shared/components/data-state/`

**验收标准**

- 经营数据、商机、出差、考勤、组织数据、DataHub tab 至少接入统一状态组件。
- 错误状态支持重试。
- 空状态给出下一步操作建议。
- 每个数据页能显示数据来源、最新更新时间、当前筛选条件摘要。

---

### UX-003：优化日程收件箱与本地/云端边界表达

**背景**

日程模块同时涉及 Tauri/SQLite 本地数据和 Supabase 日程包转交，用户需要清楚哪些数据在本机、哪些上传到云端。

**目标**

减少协作误解，明确日程包导入后是本地副本，不会自动同步。

**建议修改**

- 在日程收件箱增加：
  - 未读数量。
  - 导入预览。
  - 已导入状态。
  - 重复导入提示。
- 在 UI 中明确状态：
  - “本机日程”
  - “已发送”
  - “待接收”
  - “已导入”
  - “不会自动同步，导入后为本地副本”
- 对重复导入提供可理解提示：
  - 跳过
  - 覆盖
  - 另存为副本

**验收标准**

- 用户能在导入前知道将导入哪些日程。
- 导入后能看到是否已导入。
- 重复导入不会静默产生重复数据。
- UI 明确本地数据和云端转交数据的边界。

---

### AI-001：提升 AI 回答可信度与可解释性

**背景**

AI Agent 已有工具调用、流式输出、thinking/reasoning 块、工具结果压缩、重复工具调用保护等基础能力，但企业分析需要更高可信度。

**目标**

AI 回答中展示数据来源、分析路径和结构化行动建议。

**建议修改**

- 回答中新增“本次使用数据”区域：
  - 数据源
  - 月份/周期
  - 组织节点
  - 筛选条件
  - 数据更新时间
- 可展开“分析路径”：
  - 查询了什么数据
  - 做了什么筛选
  - 得到哪些中间结论
- 回答结构固定为：
  - 发现
  - 风险
  - 原因假设
  - 建议动作
  - 责任人/部门建议
  - 截止时间建议

**验收标准**

- AI 针对经营数据、商机、日程的回答能展示来源摘要。
- 用户可以展开查看高层次分析路径。
- 工具调用细节不会泄露敏感 token、内部 key 或无关调试信息。
- 回答不是纯自然语言段落，而是可执行建议。

---

### CI-001：建立前端、Rust、迁移、安全质量门禁

**目标**

让每次 PR 至少通过基础构建、lint、测试和安全扫描。

**建议 workflow**

`.github/workflows/ci.yml`

包含：

```bash
npm ci
npm run lint
npm run build
cargo fmt --check
cargo clippy -- -D warnings
cargo test
node scripts/check-rls-policies.mjs
node scripts/check-public-artifacts.mjs
```

如果当前仓库没有对应脚本，应补齐 package scripts 或在 CI 中注明跳过原因。

**验收标准**

- PR 会触发 CI。
- CI 失败会阻断合并。
- RLS 宽泛策略和公开发布数据风险会被扫描发现。
- 构建失败、lint 失败、测试失败均会显示清晰日志。

---

### CI-002：整理 Pages 与 Release workflow

**背景**

当前存在两个 Pages workflow，且都上传 `docs`。README 描述与 `build-release.yml` 实际触发分支不一致；release 发布脚本中存在没有 `await` 的 GitHub API 调用风险。

**目标**

发布流程清晰、可控、可重复执行。

**建议修改**

- 只保留一个 Pages workflow。
- Pages 发布目录改为不含数据文件的目录。
- Release workflow 与 README 对齐。
- Release job 使用 tag 或 `workflow_dispatch`，不要每次 main push 都潜在触发完整多平台构建。
- 修正 `github.rest.repos.updateRelease` 的 `await`。
- Android、Windows、macOS、Linux 构建拆成可独立重跑的 job。

**验收标准**

- 只有一个 Pages workflow。
- 发布目录不包含业务数据。
- README 中的触发方式与 workflow 一致。
- Release workflow 可手动触发。
- 平台构建可以独立重试。

---

## 4. P2 任务清单：可维护性、类型与数据导入

### REF-001：拆分 `src/shared/lib/agent/chatAgent.ts`

**背景**

该文件约 1000 行，混合 provider 适配、工具循环、流式解析、结果压缩和类型定义。

**目标**

降低复杂度，便于测试和演进。

**建议拆分**

- `src/shared/lib/agent/providers/openaiCompatibleProvider.ts`
- `src/shared/lib/agent/providers/claudeProvider.ts`
- `src/shared/lib/agent/toolLoop.ts`
- `src/shared/lib/agent/toolResultCompactor.ts`
- `src/shared/lib/agent/streamParser.ts`
- `src/shared/lib/agent/agentTypes.ts`

**验收标准**

- 原公开 API 保持兼容。
- 每个新文件职责清晰。
- 新增单元测试覆盖：
  - provider 适配
  - 工具循环最大深度
  - 重复工具调用保护
  - 工具结果压缩
  - stream parser

---

### REF-002：拆分 `SchedulePage.tsx`

**建议拆分**

- `ScheduleCalendarView`
- `ScheduleAddModal`
- `ScheduleShareModal`
- `ScheduleNotesModal`
- `useScheduleActions`
- `useScheduleImport`

**验收标准**

- 页面组件只负责组合和顶层状态。
- 导入、分享、新增、备注逻辑拆到 hooks 或子组件。
- 现有日程导入和转交功能不回归。

---

### REF-003：拆分 `bizDataService.ts`

**建议拆分**

- `fetchBizData.ts`
- `aggregateBizData.ts`
- `buildBizTree.ts`
- `derivedMetrics.ts`
- `bizDataFormatters.ts`

**验收标准**

- 拉取、聚合、树构建、派生指标、格式化职责分离。
- 对聚合和派生指标增加 Vitest。
- 对外 service API 保持稳定或提供迁移层。

---

### REF-004：拆分 `TableView.tsx` 和 `index.css`

**目标**

降低 UI 与样式维护成本。

**建议**

- `TableView.tsx` 拆出：
  - 表头
  - 行渲染
  - 排序/筛选
  - 空状态
  - 分页或虚拟列表
- `index.css` 拆为：
  - `base.css`
  - `layout.css`
  - `components.css`
  - `features/*.css`

**验收标准**

- 样式拆分后视觉不回归。
- 表格逻辑更容易测试。
- 核心业务文件尽量控制在 250 到 350 行左右。

---

### TYPE-001：生成 Supabase 类型并移除 `as any`

**背景**

`scheduleTransferRepository.ts` 中有多处 `supabase as any`，通常意味着数据库类型没有及时生成或 migration 与前端类型脱节。

**目标**

让 repository 使用强类型 Supabase client。

**建议修改**

- 使用 Supabase CLI 生成 `Database` 类型。
- 将生成类型放入类似：
  - `src/shared/lib/supabase/database.types.ts`
- 所有 repository 使用强类型 client。
- migration 更新后在 CI 检查类型是否同步。
- 禁止新代码引入 `as any`，除非有明确注释和 TODO。

**验收标准**

- `scheduleTransferRepository.ts` 不再使用 `supabase as any`。
- Supabase 表、insert、update、select 具备类型提示。
- CI 能发现类型文件未同步问题。

---

### LOG-001：新增统一 logger

**背景**

分散的 `console.log/error/warn` 可能在生产环境暴露敏感信息。

**目标**

集中控制日志输出级别和敏感字段脱敏。

**建议新增**

`src/shared/lib/logger.ts`

能力：

- `logger.debug`
- `logger.info`
- `logger.warn`
- `logger.error`
- 根据环境控制输出。
- 对 token、key、authorization、cookie、secret 等字段脱敏。
- 生产环境默认关闭 debug。

**验收标准**

- 新代码不直接使用 `console.log`。
- 关键服务和导入流程改用 logger。
- 生产构建不输出敏感 debug 日志。

---

### IMPORT-001：数据导入脚本 dry-run、确认与审计

**目标**

避免导入脚本误删、误覆盖、误写入生产数据。

**建议能力**

所有导入脚本支持：

- `--dry-run`
- `--confirm`
- 导入文件名预览
- sheet 预览
- 识别行数
- 将写入的表
- 将删除/覆盖的范围
- 行级校验错误报告
- 导入后写审计日志表

**验收标准**

- 没有 `--confirm` 时不执行破坏性写入。
- `--dry-run` 能输出将要执行的变更摘要。
- 导入失败时有明确错误行和原因。
- 审计日志能追踪导入人、时间、数据范围、结果。

---

### KEY-001：本地 LLM Key 安全存储

**背景**

浏览器侧 API key 放 sessionStorage 尚可接受，但 Tauri 侧通过 SQLite 明文保存企业 LLM key 风险较高。

**目标**

减少客户端持有明文 provider key 的风险。

**建议方案**

优先级从高到低：

1. 企业版走服务端 LLM Proxy，客户端不直接持有 provider key。
2. 桌面端使用 OS Keychain / Tauri Stronghold / 加密本地存储。
3. 保留 SQLite 设置时必须加密，并有迁移逻辑。

**验收标准**

- 新保存的 LLM key 不以明文形式写入 SQLite。
- 旧明文配置有迁移或清理提示。
- 模型调用审计日志记录：
  - 用户
  - 时间
  - 模型
  - 数据范围
  - token 用量
  - 是否导出结果

---

## 5. P3 产品增强路线

### PROD-001：角色化经营首页

**角色视图**

- 总经理：整体经营、异常、关键商机。
- 区域负责人：区域指标、团队表现、项目推进。
- 部门主管：部门目标、人员、考勤、执行事项。
- 一线管理者：日程、待办、客户/项目动作。

**验收标准**

- 不同角色有不同默认首页。
- 首页组件可复用。
- 角色权限与数据权限一致。

---

### PROD-002：AI 分析报告化

**报告类型**

- 经营月报。
- 商机推进报告。
- 部门异常分析。
- 人员/组织动态报告。
- 出差与考勤洞察。

**验收标准**

- AI 回答可以保存为报告。
- 报告包含数据来源、生成时间、筛选条件。
- 后续可扩展 PDF/Docx 导出。

---

### PROD-003：数据治理能力

**能力**

- 数据导入批次。
- 数据质量评分。
- 字段映射管理。
- 数据血缘。
- 异常导入回滚。

**验收标准**

- 每条核心业务数据可追溯到导入批次。
- 导入质量问题可查看、修复、回滚。
- 字段映射不再散落在脚本中。

---

### PROD-004：管理者任务闭环

**流程**

发现问题 → AI 生成建议任务 → 分派负责人 → 设置截止日期 → 跟踪状态 → 经营会汇总未完成事项。

**验收标准**

- AI 建议可以转成任务。
- 任务有负责人、截止日期、状态。
- 首页和报告能展示未完成事项。

---

## 6. 关键代码点速查

Codex 应优先检查和修改以下位置：

| 领域 | 路径/文件 | 问题 | 优先级 |
|---|---|---|---|
| 数据暴露 | `docs/data` | 业务 Excel 可能被 Pages 发布 | P0 |
| Pages | `.github/workflows/deploy-pages.yml`、`.github/workflows/pages.yml` | 重复 workflow，且上传整个 `docs` | P0 |
| RLS | `supabase/migrations/*` | 存在 `using (true)` / `with check (true)` 风险 | P0 |
| 环境变量 | `app/.env.example` | 示例中存在真实形式配置 | P0 |
| 导入脚本 | Python/Node import scripts | 可能内置 Supabase URL/key 默认值 | P0 |
| Tauri 权限 | `src-tauri/capabilities/default.json` | HTTP/opener/shell scope 偏宽 | P0 |
| CSP | `src-tauri/tauri.conf.json` | CSP 含 `'unsafe-inline'` | P0 |
| DataHub | `src/app/config/modules.ts`、`src/features/data-hub/pages/DataHubPage.tsx` | 模块注册和 tab 曾存在事实来源不一致 | P1 |
| AI 初始化 | `useChatStreaming.ts` | `ensureAgentReady()` 可能重复调用 | P1 |
| Supabase 类型 | `scheduleTransferRepository.ts` | 存在 `supabase as any` | P2 |
| Agent | `src/shared/lib/agent/chatAgent.ts` | 文件过大，职责混合 | P2 |
| 日程页面 | `src/features/schedule/pages/SchedulePage.tsx` | 文件过大 | P2 |
| 经营数据 | `src/features/biz-data/services/bizDataService.ts` | 文件过大 | P2 |
| 表格 | `src/features/biz-data/components/TableView.tsx` | 文件过大 | P2 |
| 样式 | `src/index.css` | 样式文件过大 | P2 |

---

## 7. 建议新增脚本

### `scripts/check-public-artifacts.mjs`

用途：

- 扫描公开发布目录。
- 阻止 Excel、敏感 CSV、`docs/data` 被发布。

建议参数：

```bash
node scripts/check-public-artifacts.mjs --dir docs-site
```

失败条件：

- 出现 `.xls` 或 `.xlsx`。
- 出现 `docs/data`。
- 文件名命中敏感关键词。
- 可选：文件体积异常大的数据文件进入公开目录。

---

### `scripts/check-rls-policies.mjs`

用途：

- 扫描 Supabase migration。
- 阻止危险 RLS 策略进入主分支。

失败条件：

- `using (true)` 且没有允许注释。
- `with check (true)` 且没有允许注释。
- `to public` 作用于业务表。
- `alter table ... disable row level security` 作用于业务表。
- 业务表没有启用 RLS。

---

### `scripts/check-no-secrets.mjs`

用途：

- 扫描示例文件和脚本。
- 防止真实 URL/key/token 混入仓库。

重点扫描：

- `.env*`
- `scripts/**`
- `.github/workflows/**`
- `docs/**`
- `src/**`

失败条件：

- 出现 service role key 样式字符串。
- 出现硬编码 Supabase 项目 URL 且不在允许列表。
- 出现 Feishu app secret。
- 出现 OpenAI/Claude provider key 样式字符串。

---

## 8. 建议测试补齐

### Vitest

优先覆盖：

- 经营数据聚合。
- 派生指标计算。
- 数据格式化。
- DataHub 模块 registry。
- AI tool result compaction。
- stream parser。
- schedule hooks。

### Playwright

优先覆盖：

- 登录页。
- 主导航。
- DataHub tab。
- AI 设置页。
- 日程导入入口。
- 日程收件箱导入预览。
- 管理者首页关键卡片。

### Rust/Tauri

优先覆盖：

- 日程导入。
- 日程包合并。
- 重复导入。
- 字段校验。
- 本地 SQLite 设置读写。
- deep link 参数校验。

---

## 9. Definition of Done

每个 PR 完成前至少满足：

- [ ] 代码变更范围与 PR 目标一致。
- [ ] 没有新增硬编码 key、URL 默认值或业务数据文件。
- [ ] 没有新增无说明的 `as any`。
- [ ] 没有新增无说明的宽泛 RLS 策略。
- [ ] 能运行的检查命令已运行。
- [ ] 未能运行的命令已在 PR 说明中记录原因。
- [ ] 用户可见变更有空状态、错误状态和加载状态。
- [ ] 安全相关变更有文档说明。
- [ ] 涉及数据迁移的变更有回滚或人工确认说明。

---

## 10. 首轮执行建议

建议 Codex 首先执行以下顺序：

1. 新建安全检查脚本：
   - `check-public-artifacts.mjs`
   - `check-rls-policies.mjs`
   - `check-no-secrets.mjs`

2. 整理 Pages workflow：
   - 只保留一个 Pages workflow。
   - 改为发布不含业务数据的目录。
   - 接入 `check-public-artifacts.mjs`。

3. 清理 `.env.example` 与导入脚本：
   - 示例值改占位符。
   - 移除默认 URL/key。
   - 缺少 env 直接失败。
   - 增加 dry-run 和 confirm。

4. 扫描并修复 RLS：
   - 找到所有 `using (true)` / `with check (true)`。
   - 按业务表设计最小权限策略。
   - 接入 CI 阻断新增风险。

5. 修复 DataHub 一致性：
   - 统一模块 registry。
   - 处理历史数据模块显示或隐藏策略。

6. 建立 CI：
   - lint/build/test。
   - Rust/Tauri 检查。
   - 安全扫描。
   - artifact 扫描。

完成以上 6 步后，再进入管理者首页、AI 可解释性、大文件拆分和数据治理能力建设。
