# biz-analysis

## Metadata
- **Name**: 教育后勤经营分析助手
- **Version**: 1.0.0
- **Domain**: Education Logistics Business Intelligence
- **Stack**: TypeScript · Supabase · React · Claude API (streaming + tool_use)

## 触发条件

以下任意条件触发本技能：
- 用户要求分析经营数据、收入、利润、成本、完成率、同比
- 涉及 `edu_biz_report`、`edu_biz_monthly_plan`、`edu_org_hierarchy` 表的查询或展示
- 修改 `AiAnalysis.tsx`、`queryBizData.ts`、`chatAgent.ts` 等 Agent 相关文件
- 用户要求新增查询维度、指标或报表类型

---

## 核心指令

### 1. 数据库架构（必须熟记）

**三张核心表**：

| 表 | 行数 | 用途 |
|---|---|---|
| `edu_biz_report` | 11,477 | 经营数据报表（fone/突围，累计/当月，25个指标） |
| `edu_biz_monthly_plan` | 1,498 | 1-6月突围计划分月数（revenue/pretax_profit） |
| `edu_org_hierarchy` | 153 | 组织层级映射（node_name → level_1/2/3/label） |

**edu_biz_report 关键字段**：
```
sheet_code      -- 1.1/1.2/2.1/2.2/2.3/6.1/6.2/7.1/7.2
report_type     -- fone（年初预算）| tuwei（突围考核）
period_type     -- cumulative（累计）| monthly（当月）
period          -- <202603 / 202602 / 202601-202602
node_name       -- 组织节点（软关联 edu_org_hierarchy）
sort_order      -- 原始排序（8~139）
metric_category -- 25个指标英文标识（见下方枚举）
metric_category_cn -- 指标中文名
actual_value    -- 实际值
budget_value    -- 预算值
completion_rate -- 完成率（0~1 小数）
diff_value      -- 预实差异
yoy_value       -- 同期值（同比，0~1 小数）
```

**25个 metric_category 枚举**：
```
主报表(16): revenue, catering_expense, material_cost, gross_profit, gross_margin,
            labor_cost, other_expense, external_revenue, external_expense,
            pretax_profit, pretax_margin, headcount, per_capita_revenue,
            labor_cost_rate, revenue_creation, profit_creation

成本分析(10): labor_cost, salary, social_insurance, housing_fund, labor_service_fee,
              other_labor_cost, vehicle_expense, energy_expense,
              travel_expense, entertainment_expense
```

**标准 JOIN 模式**（获取层级信息）：
```sql
SELECT r.node_name, r.metric_category, r.actual_value,
       h.level_1, h.level_2, h.level_3, h.label
FROM edu_biz_report r
LEFT JOIN edu_org_hierarchy h ON r.node_name = h.node_name
WHERE r.report_type = 'fone'
  AND r.period_type = 'cumulative'
  AND r.metric_category = 'revenue'
ORDER BY r.sort_order;
```

---

### 2. Agent 层架构

**文件路径**：
```
app/src/lib/agent/
  ├── types.ts              -- 所有 TS 类型定义
  ├── chatAgent.ts          -- ChatAgent 类（OpenAI + Claude 双协议）
  ├── conversationStore.ts  -- localStorage 持久化（max 50条会话）
  ├── tools/
  │   └── queryBizData.ts   -- query_biz_data 工具（唯一注册工具）
  └── index.ts              -- 桶形导出
```

**ChatAgent 关键行为**：
- `chat(messages, systemPrompt)` — 异步生成器，yield ChatStreamChunk
- chunk 类型：`text` | `thinking` | `tool_call` | `tool_result`
- Claude 3.7+/4+ 启用 extended thinking（budget_tokens: 10000）
- 工具调用后递归调用 `callAndProcess()`，支持多轮工具链

**query_biz_data 工具当前能力**：
- 查询 `edu_biz_report`，支持 node_name(ilike)、metric_category、report_type、period_type、limit
- 返回 JSON：`{ total_records, filters, data: [{节点,指标,实际值,预算值,完成率,差异,同比,期间}] }`
- **不含组织层级**（无 JOIN edu_org_hierarchy）
- **不含月度计划**（未查询 edu_biz_monthly_plan）

---

### 3. 扩展查询工具的规范

新增或修改工具时**必须遵守**：

```typescript
// app/src/lib/agent/tools/queryXxx.ts
import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

export const queryXxxTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_xxx',          // snake_case
      description: '中文描述，说明能查什么、返回什么',
      parameters: {
        type: 'object',
        properties: { /* ... */ },
        required: [],              // 所有参数均可选
      },
    },
  },
  execute: async (args): Promise<string> => {
    // 1. 参数解析 + 默认值
    // 2. Supabase 查询（加 .limit() 防大结果集）
    // 3. 错误处理：throw new Error(`数据库查询失败: ${error.message}`)
    // 4. 空结果返回 JSON message 而非抛错
    // 5. 格式化为中文字段名 JSON 供 LLM 阅读
    return JSON.stringify(result, null, 2)
  },
}
```

在 `AiAnalysis.tsx` 注册：
```typescript
agentRef.current.registerTool(queryXxxTool)
```

---

### 4. System Prompt 规范

系统提示必须明确列出：
1. 角色定位（教育后勤经营分析助手）
2. 可用工具及其参数枚举
3. 数据说明（report_type/period_type 含义、金额单位等）
4. 分析建议（优先给出完成率、同比对比、异常预警）

---

### 5. 前端渲染规范

`AiAnalysis.tsx` 内联子组件：
- `ThinkingBlock` — 折叠面板，显示 thinking 推理过程
- `ToolCallCard` — 工具调用卡片（calling/success/error 状态图标）
- `MarkdownContent` — react-markdown + Prism 语法高亮
- `MessageBubble` — 用户右对齐，助手左对齐，含头像

**MarkdownContent className 规范**（避免 prop 类型错误）：
```tsx
// 正确：使用 className prop 传递样式
<ReactMarkdown
  components={{
    code({ className, children, ...props }) {
      // className 形如 "language-sql"
    }
  }}
>
  {content}
</ReactMarkdown>
```

---

### 6. 常见分析场景 & 查询策略

| 用户问题 | 建议工具调用 |
|---|---|
| 整体收入完成情况 | `metric_category=revenue, report_type=fone, period_type=cumulative` |
| 各中心利润排名 | `metric_category=pretax_profit` + 按 actual_value 排序 |
| 某节点成本结构 | `node_name=餐饮中心, metric_category=labor_cost` 等多次调用 |
| 月度趋势 | `period_type=monthly` 多期数据 |
| 突围 vs 年初对比 | 分别查 `report_type=fone` 和 `report_type=tuwei` |
| 月度计划 vs 实际 | 查 `edu_biz_monthly_plan` + `edu_biz_report` 对比 |

**重要提示**：单次查询 limit 最大 200，复杂分析应拆成多次工具调用。

---

### 7. 已知限制 & 待优化点

- `queryBizDataTool` 未 JOIN `edu_org_hierarchy`，无法按 level_1/2/3 聚合
- 未实现 `edu_biz_monthly_plan` 查询工具
- 会话历史上限 50条（localStorage），超出自动截断
- Claude extended thinking 仅对 `claude-3.7+` / `claude-4+` 生效

---

## 参考文件

- `references/database-schema.md` — 完整数据库 schema
- `references/metric-categories.md` — 25个指标的中英文映射与业务含义
