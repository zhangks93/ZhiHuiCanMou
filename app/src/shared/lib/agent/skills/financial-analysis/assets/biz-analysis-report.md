# 后勤集团经营分析报告模板

**汇报单位**：`query_business_report_pack.metadata.scope_name`  
**统计周期**：当月 `metadata.month`；截至当月累计 `metadata.cumulative_to_month_period`；学年目标累计 `metadata.school_year_target_period`  
**数据单位**：万元  
**数据来源**：`edu_biz_report`、`edu_biz_monthly_plan`、`edu_org_hierarchy`

> 模板是写作框架，可按组织层级和数据完整度合并小节。字段选择和硬约束以 `report-generation.md`、`quality_contract` 为准。

## 1. 经营摘要与学年目标判断

用 3-6 条要点写清：
- 收入和税前利润是否达成目标。
- 收入完成与利润完成是否匹配。
- 主要增长点、拖累点和风险点。
- 当前状态对累计目标或后续月份的影响。

本节使用 `school_year_goal_assessment_table`，只覆盖营业收入和税前利润。

建议表头：

| 指标 | 实际值 | 学年进度 | 学年预算目标 | 学年预算完成率 | 学年预算达成概率 | 学年预算风险 | 突围考核目标 | 突围考核完成率 | 突围考核达成概率 | 突围考核风险 |
|---|---:|---:|---:|---:|---|---|---:|---:|---|---|

## 2. 目标对标与实际完成

优先使用 `metric_comparison_wide_table`。实际值只展示一次，并列展示学年预算与突围考核目标、完成率和差额。

建议表头：

| 期间 | 指标 | 实际值 | 同比 | 环比 | 学年预算目标 | 学年预算完成率 | 学年预算差额 | 突围考核目标 | 突围考核完成率 | 突围考核差额 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|

表后说明收入缺口、利润缺口、利润转化是否匹配，以及黄色 / 红色预警。

## 3. 组织结构、贡献与拖累

按 `scope_profile.recommended_report_focus` 调整颗粒度：
- 集团：区域 / 中心结构、贡献排行、缺口排行和结构质量。
- 区域 / 中心：直接下级差异、重点单元拖累和费用压力。
- 叶子节点：自身目标达成、趋势和费用风险。

可用表：`organization_two_level_table`、`direct_children_table`、`key_descendant_table`、`leaf_exception_table`、`variance_rankings`、`unit_cards`。

## 4. 成本费用与效率

优先使用 `cost_expense_wide_table`、`cost_expense_summary`、`variance_rankings.expense_over_budget_top`。

重点覆盖：人力成本及明细、餐饮支出、物资销售成本、其他支出、营业外支出、车辆费用、能耗费、差旅费、业务招待费、人效类指标。

## 5. 风险判断与后续动作

使用 `warnings`、`unit_cards.warnings`、`writing_brief.risk_action_points` 输出动作表。

建议表头：

| 关注事项 | 对象 | 证据 | 风险等级 | 后续动作 |
|---|---|---|---|---|

动作必须对应具体对象和证据，避免只写“加强管理、持续关注”。

## 6. 数据限制与待补说明

仅当 `missing_data_notes`、`coverage.gaps` 或 `data_completeness_matrix` 显示缺数时输出。

写 2-5 条短说明：缺失字段、原因、业务侧需补充内容、补数后需复核事项。
