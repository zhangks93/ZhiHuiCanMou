# 完整经营分析报告生成规范

仅用于完整报告、月报、markdown 报告和汇报材料。完整报告必须像经营汇报材料，不写成泛化摘要。

## 1. 数据主线

完整报告必须优先调用 `query_business_report_pack`。若 `coverage.core_biz_data = missing`，不得生成完整报告，只输出缺数说明。

报告包字段使用优先级：
- 写作素材：`writing_brief`、`section_briefs`、`evidence_ledger`。
- 硬约束：`quality_contract`、`claim_rules`、`data_completeness_matrix`。
- 核心表：`school_year_goal_assessment_table`、`metric_comparison_wide_table`、`organization_two_level_table`、`cost_expense_wide_table`。
- 结构与风险：`scope_profile`、`direct_children_table`、`key_descendant_table`、`leaf_exception_table`、`unit_cards`、`variance_rankings`、`warnings`。
- 缺数说明：`missing_data_notes`、`coverage.gaps`。

关键结论必须能回溯到 `evidence_ledger`；`manual_required` 只能写成补数要求，不得写成已确认事实。

## 2. 章节结构

默认结构：
1. 经营摘要与学年目标判断
2. 目标对标与实际完成
3. 组织结构、贡献与拖累
4. 成本费用与效率
5. 风险判断与后续动作
6. 数据限制与待补说明

允许按组织层级和数据完整度合并小节，但不得省略核心经营判断。集团看区域 / 中心结构与贡献；区域 / 中心看下属单元差异；叶子节点不强行输出无意义下级构成。

## 3. 表格规则

数据充足时优先输出：
- 学年目标达成概率与风险表：只覆盖营业收入、税前利润。
- 目标对标宽表：实际值只展示一次，并列展示学年预算与突围考核。
- 组织构成 / 贡献 / 缺口表：至少一张覆盖两层组织；若无二级下属，在数据限制中说明。
- 成本费用或效率宽表。
- 风险动作表。

表格服务于判断，不为凑数量。每张核心表后至少写 2 条带数字、对象、原因或风险的分析。

## 4. 缺失数据与禁用

- 终稿不得出现 `fone`、`tuwei`，统一写“学年预算”“突围考核”。
- 不输出 `【人工补充】` 或大面积待补占位表。
- 应收账款、资金计划、核心费用专项明细只在“数据限制与待补说明”集中列出补数要求。
- 系统已有的人力成本、工资、物资成本、车辆费用、能耗费、差旅费、招待费等指标必须正常分析，不能写成待补。
- 普通完整报告不输出图表 JSON；只有用户明确要求 chart spec 时才读取 `chart-guidance.md`。

## 5. 自审

输出终稿前：
1. 按 `report-quality-rubric.md` 自审。
2. 调用 `audit_business_report` 审核 Markdown 初稿。
3. 修复 error 级问题；warning 级问题若因数据缺失无法修复，在数据限制中说明。
