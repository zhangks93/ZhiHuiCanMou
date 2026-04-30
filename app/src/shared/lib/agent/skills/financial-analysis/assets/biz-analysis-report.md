# 后勤集团经营分析报告写作模板

**汇报单位**：以 `query_business_report_pack.metadata.scope_name` 为准  
**统计周期**：当月 `metadata.month`，累计 `metadata.cumulative_period`  
**数据单位**：万元  
**数据来源**：`edu_biz_report`、`edu_biz_monthly_plan`、`edu_org_hierarchy`

> 使用规则：
> - 完整报告必须优先调用 `query_business_report_pack`，不得用多次零散查数替代报告包。
> - 报告正文优先使用 `writing_brief`、`scope_profile`、`summary_cards`、`target_vs_actual_table`、`direct_children_table`、`unit_cards`、`cost_expense_summary`、`cost_expense_table`、`variance_rankings`、`warnings`。
> - 模板是写作框架，不是必须逐字照搬的固定目录。允许根据组织层级、数据完整度和用户要求合并、删减或调整小节。
> - 当月、上月、累计必须分开表达；`fone` 和 `tuwei` 口径不可混写。
> - 百分比字段由小数展示为百分比，例如 `0.84` 写作 `84%`。
> - 不输出图表 JSON；除非用户明确要求图表配置。
> - 应收、资金计划、核心费用专项明细等系统取不到的数据，不在正文输出大量占位表，只在结尾集中说明。

---

## 1. 经营摘要

用 3-6 条要点先写清本期核心判断。优先引用 `writing_brief.executive_summary_points`，并补充经营含义：
- 收入和税前利润是否达成目标。
- 收入完成与利润完成是否匹配。
- 主要增长点、拖累点和风险点。
- 当前状态对累计目标或后续月份的影响。

---

## 2. 目标对标与实际完成

使用 `target_vs_actual_table` 或 `summary_cards` 输出 fone/tuwei 的当月和累计目标对标表。至少覆盖：
- 营业收入实际、目标、完成率、差额。
- 税前利润实际、目标、完成率、差额。

表后写 2-5 条判断：
- 对照努力目标的整体完成状态。
- 收入端缺口和利润端缺口的相对大小。
- 利润转化是否弱于收入兑现。
- 黄色/红色预警必须点名对象和指标。

---

## 3. 组织结构、贡献与拖累

先查看 `scope_profile.recommended_report_focus` 决定颗粒度：
- 集团层级：重点写区域/中心结构、贡献排行、缺口排行和结构质量。
- 区域/中心层级：重点写直接下级差异、重点项目/业务单元拖累和费用压力。
- 叶子节点：不强行输出下级构成，重点写自身目标达成、当月/累计变化和费用风险。

可使用：
- `direct_children_table`：首选构成表。
- `key_descendant_table`、`leaf_exception_table`：直接子级不足或需要穿透时补充。
- `variance_rankings`：输出收入/利润缺口 TOP、贡献 TOP。
- `unit_cards.selection_reason`：说明为什么点名该单位。

表后必须说明增长点、拖累点和结构质量，不只复述表格。

---

## 4. 成本费用与效率

使用 `cost_expense_summary`、`cost_expense_table`、`variance_rankings.expense_over_budget_top` 输出系统可取的成本费用和效率指标。优先覆盖：
- 人力成本及工资、社保、公积金、劳务费等明细。
- 餐饮支出、物资销售成本、其他支出、营业外支出。
- 车辆费用、能耗费、差旅费、业务招待费。
- 人力成本率、人均营收、一元创收、一元创利等效率指标。

写作要求：
- 费用类经营指标通常低于或等于目标为好，超目标需点名对象和指标。
- 不把系统已有费用指标写成待补。
- 对无法自动取得的专项费用明细，只在结尾数据限制中说明。

---

## 5. 风险判断与后续动作

使用 `warnings`、`unit_cards.warnings`、`writing_brief.risk_action_points` 输出管理动作表。

建议表头：

| 关注事项 | 对象 | 证据 | 风险等级 | 后续动作 |
|---|---|---|---|---|

本节必须：
- 引用前文具体数据或预警，不写泛泛建议。
- 区分收入兑现、利润转化、成本刚性、效率改善、专项补数五类动作。
- 动作表达要具体，避免“加强管理、持续关注”这类空话单独出现。

---

## 6. 数据限制与待补说明

仅当 `missing_data_notes`、`coverage.gaps` 或 `data_completeness_matrix` 显示缺数时输出本节。

写法：
- 用 2-5 条短说明列出系统未接入的数据源或字段。
- 对应收账款回款、资金计划执行、核心费用专项明细，只说明“需业务侧补充后复核”，不渲染大面积 `【人工补充】` 占位表。
- 数据不足时降低结论强度，但不要删除已可自动生成的核心经营分析。
