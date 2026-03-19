# 25个指标类别 — 中英文映射与业务含义

## 主报表指标（16个）

| metric_category | 中文名 | 业务含义 | 单位 |
|---|---|---|---|
| revenue | 营业收入 | 对外营业总收入 | 万元 |
| catering_expense | 餐饮支出 | 食材及餐饮原料成本 | 万元 |
| material_cost | 物资销售成本 | 物资/商品销售的成本 | 万元 |
| gross_profit | 毛利额 | 收入 - 直接成本 | 万元 |
| gross_margin | 毛利率 | 毛利额 / 营业收入 | 比率（0~1） |
| labor_cost | 人力成本 | 工资+社保+公积金+劳务费等 | 万元 |
| other_expense | 其他支出 | 除人力外的间接费用 | 万元 |
| external_revenue | 营业外收入 | 非主营业务收入 | 万元 |
| external_expense | 营业外支出 | 非主营业务支出 | 万元 |
| pretax_profit | 税前利润 | 经营利润（税前） | 万元 |
| pretax_margin | 税前利润率 | 税前利润 / 营业收入 | 比率（0~1） |
| headcount | 职工人数 | 在岗员工数 | 人 |
| per_capita_revenue | 人均营收 | 营业收入 / 人数 | 万元/人 |
| labor_cost_rate | 人力成本率 | 人力成本 / 营业收入 | 比率（0~1） |
| revenue_creation | 一元创收 | 每元人力成本创造的收入 | 元/元 |
| profit_creation | 一元创利 | 每元人力成本创造的利润 | 元/元 |

## 成本分析指标（10个，sheets 6.1/6.2/7.1/7.2）

| metric_category | 中文名 | 业务含义 | 单位 |
|---|---|---|---|
| labor_cost | 人力成本 | 合计（同上，成本分析版本） | 万元 |
| salary | 工资 | 基本工资及绩效 | 万元 |
| social_insurance | 社保 | 社会保险费（五险） | 万元 |
| housing_fund | 公积金 | 住房公积金 | 万元 |
| labor_service_fee | 劳务费 | 外包劳务人员费用 | 万元 |
| other_labor_cost | 其他人力成本 | 其他人员相关费用 | 万元 |
| vehicle_expense | 车辆费用 | 用车、燃油、维修等 | 万元 |
| energy_expense | 能耗费 | 水电气等能源费用 | 万元 |
| travel_expense | 差旅费 | 出差费用 | 万元 |
| entertainment_expense | 业务招待费 | 商务接待费用 | 万元 |

## 数值格式说明

- **金额类**（万元）：actual_value / budget_value / diff_value / yoy_value 直接为数值
- **比率类**（gross_margin / pretax_margin / labor_cost_rate 等）：存储为 0~1 小数，显示时 ×100 转为百分比
- **completion_rate**：完成率，0~1 小数，≥1 表示超额完成
- **yoy_value**：同比增长率，0~1 小数，正值为增长，负值为下降

## Sheet 与数据对应关系

| sheet_code | report_type | period_type | 说明 |
|---|---|---|---|
| 1.1 | fone | cumulative | 25学年累计（年初定稿版） |
| 1.2 | fone | monthly | 25学年2月当月（年初定稿版） |
| 2.1 | tuwei | cumulative | 25学年1-2月累计（突围版） |
| 2.2 | tuwei | monthly | 25学年1月当月（突围版） |
| 2.3 | tuwei | monthly | 25学年2月当月（突围版） |
| 6.1 | fone | cumulative | 成本分析累计（年初版） |
| 6.2 | fone | monthly | 成本分析当月（年初版） |
| 7.1 | tuwei | cumulative | 成本分析累计（突围版） |
| 7.2 | tuwei | monthly | 成本分析当月（突围版） |
