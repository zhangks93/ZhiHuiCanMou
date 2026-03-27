# 指标与参数速查

## query_with_hierarchy 参数说明
- `node_name`：首次查询时由 `resolve_org_nodes` 确认后的标准节点名称；若当前会话中该对象已高置信度确认且未变更，可直接复用
- `metric_category`：指标英文名
- `report_type`：
  - `fone` = 年初预算
  - `tuwei` = 突围考核
- `period_type`：
  - `monthly`
  - `cumulative`
- `period`：
  - 月度示例：`202601`
  - 累计示例：`<202603`
- `level_0`：可选，集团级过滤
- `level_1` / `level_2`：可选，层级过滤

## query_monthly_plan 参数
- `month`：`202601` 到 `202606`，或 `total`

适用场景：
- 用户询问“月度突围计划”
- 用户询问收入目标
- 用户询问税前利润目标

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
- `salary`
- `social_insurance`
- `housing_fund`
- `labor_service_fee`
- `other_labor_cost`
- `vehicle_expense`
- `energy_expense`
- `travel_expense`
- `entertainment_expense`

## 达成状态标签规则
- `< 80%` = 预警
- `80% 到 < 95%` = 待关注
- `>= 95%` = 达标

注意：
不要停留在标签判断本身，必须补充财务和经营层面的解释。