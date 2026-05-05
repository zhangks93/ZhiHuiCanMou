# 指标与参数速查

系统实际可用的指标名与期间值，以 Runtime Data Context 为准；本文件只做参数和常用指标分组速查。

## 轻量取数默认规则

当用户只是问“某部门 / 某期间 / 某指标是多少”时：
- 优先只查询用户点名指标
- 未明确 `report_type` 时，默认先查学年预算（内部参数 `fone`）
- 未明确期间类型时，默认先查 `monthly`
- 若同一次要查多个指标，优先用一次 `metric_categories` 查询完成
- 若用户要的只是单节点单指标结果，允许直接用 `query_biz_data` 返回更扁平的结果；若还需要层级或子节点结构，再用 `query_with_hierarchy`

## query_with_hierarchy 参数说明

**必填参数**：`node_name`、`report_type`、`period_type`、`period`

- `node_name`：组织节点名称。优先传 `resolve_org_nodes` 确认后的标准名称。
  - 传具体节点名称：返回该节点作为根节点的完整子树
  - 传空字符串 `""`：返回整棵组织树
- `metric_categories`：可选，**字符串数组**；不传则返回当前范围内全部可用指标。
- `report_type`：
  - 内部参数 `fone` = 学年预算
  - 内部参数 `tuwei` = 突围考核
  - 最终报告正文不得输出内部参数名，只写“学年预算”“突围考核”
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

这些字段已返回时，应优先直接使用。

适用场景：
- 需要节点子树
- 需要看父子层级
- 需要集团整体或某板块结构
- 需要在同一次查询里拿到一组指标并基于树做聚合

若用户只问单节点、少量指标、单期间的数值，`query_biz_data` 也可优先使用。

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
