# 指标与参数速查

**数据边界**：系统实际可用的指标名与期间值以对话中注入的 **Runtime Data Context**（如 `metrics_preview`、`monthly_periods`、`cumulative_periods`、`monthly_plan_months`）为准。下列清单为常规全集；若某指标或期间不在运行上下文中，以查询结果与工具返回为准，不得编造。报告模板中若出现回款、合同等字段而库中无对应数据，保留章节并标 `【待补】`。

## query_with_hierarchy 参数说明

**必填参数**：`node_name`、`report_type`、`period_type`、`period`

- `node_name`：组织节点名称。优先传 `resolve_org_nodes` 确认后的标准名称。
  - 传具体节点名称：返回该节点作为根节点的完整子树
  - 传空字符串 `""`：返回整棵组织树
- `metric_categories`：可选，**字符串数组**；不传则返回当前范围内全部可用指标。
- `report_type`：
  - `fone` = 年初预算
  - `tuwei` = 突围考核
- `period_type`：
  - `monthly`
  - `cumulative`
- `period`：**仅允许**使用 Runtime Data Context 中列出的合法 `period` 精确字符串（与数据库一致）。
  - 月度：`YYYYMM`（如 `202602`）
  - 累计：系统常见存储为右开区间，例如“截至 202602”通常为 `<202603`；不要自行假设 period 生成规则，必须直接使用 Runtime Data Context 中 `cumulative_periods` 里的真实合法值。若“累计至目标月份”的候选值不在 `cumulative_periods` 中，说明该 period 当前不可用。
- `sheet_codes`：可选，按报表 sheet 代码过滤。

返回主结构为 `tree`，不是平铺 `rows`。每个节点包含：
- `node_name`
- `node_kind`
- `org_hierarchy`
- `metrics`
- `children`

每个节点的 `metrics` 中优先使用：
- `actual`
- `target_value`
- `completion_rate`
- `diff`
- `yoy`
- `monthly_plan`

这些字段已返回时，报告中必须直接使用，不能忽略。

## query_monthly_plan 参数

- `month`：**仅允许**使用 Runtime Data Context 中 `monthly_plan_months` 所列合法月份精确值（数据来自 `edu_biz_monthly_plan` 表；不同环境可能不同，不以固定区间代替）。
- `metric_category`：月度计划侧主要为 `revenue`、`pretax_profit`（见工具定义）。

适用场景：

- 用户询问「月度突围计划」、收入目标、税前利润目标等

## 主报表指标

- `revenue`
- `catering_expense`
- `material_cost`
- `gross_profit`
- `gross_margin`
- `labor_cost`
- `other_expense`
- `external_revenue`
- `external_expense`
- `pretax_profit`
- `pretax_margin`
- `headcount`
- `per_capita_revenue`
- `labor_cost_rate`
- `revenue_creation`
- `profit_creation`

## 成本分析指标

- `labor_cost`
- `salary`
- `social_insurance`
- `housing_fund`
- `labor_service_fee`
- `other_labor_cost`
- `catering_expense`
- `material_cost`
- `other_expense`
- `external_expense`
- `vehicle_expense`
- `energy_expense`
- `travel_expense`
- `entertainment_expense`

建议：

做人力与费用分析时，不要只看 `labor_cost` 与 `other_expense` 两个指标，优先把可用的人力成本和费用细项一起查询。

完整经营分析 / 月报 / 报告场景下，默认至少覆盖以下费用项：
- `catering_expense`
- `material_cost`
- `vehicle_expense`
- `energy_expense`
- `travel_expense`
- `entertainment_expense`
- `other_expense`

输出时要求：
- 当月与累计分开呈现
- `completion_rate`、`diff`、`year_over_year` 必须标明是当月口径还是累计口径

## 达成状态标签规则

- `< 80%` = 预警
- `80%` 到 `< 95%` = 待关注
- `>= 95%` = 达标

注意：

不要停留在标签判断本身，必须补充财务和经营层面的解释。
