# Supabase Database Schema

Last updated: 2026-03-09

## Tables Overview

### 1. schedule_items
**Purpose**: Store schedule and meeting items
**RLS Enabled**: No
**Row Count**: 5

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `title` (text): Schedule title
- `description` (text, nullable): Detailed description
- `start_time` (timestamptz, nullable): Start time
- `end_time` (timestamptz, nullable): End time
- `type` (text, nullable): Type of schedule (meeting, business, routine, urgent)
- `location` (text, nullable): Location
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()
- `date` (date, nullable): Date of the schedule
- `period` (text, nullable): Time period (morning, afternoon, evening)
- `meeting_notes` (text, nullable): Meeting notes

---

### 2. opportunity_ledger
**Purpose**: Track business opportunities and project pipeline
**RLS Enabled**: Yes
**Row Count**: 630

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `org_id` (uuid, nullable): Organization ID
- `snapshot_date` (date): Date of the snapshot
- `item_type` (text): Type (operation, expansion, tracking)
- `region` (text, nullable): Geographic region
- `project_name` (text): Name of the project
- `estimated_amount` (numeric, nullable): Estimated project value
- `logistics_approved` (boolean, nullable): Logistics approval status, default: false
- `group_approved` (boolean, nullable): Group approval status, default: false
- `bid_date` (date, nullable): Bidding date
- `status` (text, nullable): Project status (tracking, bidding, contracted, operating, suspended, lost)
- `remark` (text, nullable): Additional remarks
- `win_probability` (numeric, nullable): Probability of winning
- `manager_ready` (boolean, nullable): Manager readiness, default: false
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()
- `updated_at` (timestamptz, nullable): Last update timestamp, default: now()

---

### 3. edu_logistics_biz_data
**Purpose**: Education logistics 2025 business data (cumulative)
**RLS Enabled**: No
**Row Count**: 116

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `node_name` (text): Node name
- `center` (text, nullable): Center name
- `biz_class` (text, nullable): Business class
- `biz_level1` (text, nullable): Business level 1
- `org_tag` (text, nullable): Organization tag

#### Revenue Metrics
- `actual_revenue` (numeric, nullable): Actual revenue
- `budget_revenue` (numeric, nullable): Budgeted revenue
- `revenue_completion_rate` (numeric, nullable): Revenue completion rate
- `revenue_diff` (numeric, nullable): Revenue difference
- `yoy_revenue` (numeric, nullable): Year-over-year revenue

#### Material & Meal Costs
- `actual_material` (numeric, nullable): Actual material cost
- `budget_material` (numeric, nullable): Budgeted material cost
- `material_completion_rate` (numeric, nullable): Material completion rate
- `yoy_material` (numeric, nullable): Year-over-year material cost
- `actual_meal` (numeric, nullable): Actual meal cost
- `budget_meal` (numeric, nullable): Budgeted meal cost
- `meal_completion_rate` (numeric, nullable): Meal completion rate
- `yoy_meal` (numeric, nullable): Year-over-year meal cost

#### Profit Metrics
- `actual_gross_profit` (numeric, nullable): Actual gross profit
- `budget_gross_profit` (numeric, nullable): Budgeted gross profit
- `gross_profit_completion_rate` (numeric, nullable): Gross profit completion rate
- `yoy_gross_profit` (numeric, nullable): Year-over-year gross profit
- `actual_gross_margin` (numeric, nullable): Actual gross margin
- `budget_gross_margin` (numeric, nullable): Budgeted gross margin
- `gross_margin_diff` (numeric, nullable): Gross margin difference
- `yoy_gross_margin` (numeric, nullable): Year-over-year gross margin

#### Operating Costs
- `actual_labor_cost` (numeric, nullable): Actual labor cost
- `budget_labor_cost` (numeric, nullable): Budgeted labor cost
- `labor_cost_completion_rate` (numeric, nullable): Labor cost completion rate
- `yoy_labor_cost` (numeric, nullable): Year-over-year labor cost
- `actual_other_cost` (numeric, nullable): Actual other costs
- `budget_other_cost` (numeric, nullable): Budgeted other costs
- `other_cost_completion_rate` (numeric, nullable): Other cost completion rate
- `yoy_other_cost` (numeric, nullable): Year-over-year other costs

#### External Revenue/Expense
- `actual_external_revenue` (numeric, nullable): Actual external revenue
- `budget_external_revenue` (numeric, nullable): Budgeted external revenue
- `yoy_external_revenue` (numeric, nullable): Year-over-year external revenue
- `actual_external_expense` (numeric, nullable): Actual external expense
- `budget_external_expense` (numeric, nullable): Budgeted external expense
- `yoy_external_expense` (numeric, nullable): Year-over-year external expense

#### Net Profit
- `actual_profit` (numeric, nullable): Actual profit
- `budget_profit` (numeric, nullable): Budgeted profit
- `profit_completion_rate` (numeric, nullable): Profit completion rate
- `profit_diff` (numeric, nullable): Profit difference
- `yoy_profit` (numeric, nullable): Year-over-year profit
- `actual_profit_margin` (numeric, nullable): Actual profit margin
- `budget_profit_margin` (numeric, nullable): Budgeted profit margin
- `profit_margin_diff` (numeric, nullable): Profit margin difference
- `yoy_profit_margin` (numeric, nullable): Year-over-year profit margin

#### Labor Efficiency
- `actual_labor_cost_rate` (numeric, nullable): Actual labor cost rate
- `budget_labor_cost_rate` (numeric, nullable): Budgeted labor cost rate
- `labor_cost_rate_completion` (numeric, nullable): Labor cost rate completion
- `yoy_labor_cost_rate` (numeric, nullable): Year-over-year labor cost rate

#### Productivity Metrics
- `actual_revenue_creation` (numeric, nullable): Actual revenue per capita
- `budget_revenue_creation` (numeric, nullable): Budgeted revenue per capita
- `revenue_creation_completion_rate` (numeric, nullable): Revenue creation completion rate
- `yoy_revenue_creation` (numeric, nullable): Year-over-year revenue creation
- `actual_profit_creation` (numeric, nullable): Actual profit per capita
- `budget_profit_creation` (numeric, nullable): Budgeted profit per capita
- `profit_creation_completion_rate` (numeric, nullable): Profit creation completion rate
- `yoy_profit_creation` (numeric, nullable): Year-over-year profit creation

#### Headcount
- `actual_headcount` (numeric, nullable): Actual headcount
- `budget_headcount` (numeric, nullable): Budgeted headcount
- `headcount_diff` (numeric, nullable): Headcount difference
- `yoy_headcount` (numeric, nullable): Year-over-year headcount
- `actual_per_capita_labor` (numeric, nullable): Actual per capita labor cost
- `yoy_per_capita_labor` (numeric, nullable): Year-over-year per capita labor
- `budget_per_capita_labor` (numeric, nullable): Budgeted per capita labor
- `per_capita_labor_diff` (numeric, nullable): Per capita labor difference

#### Metadata
- `dashboard_flag` (text, nullable): Dashboard flag
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()

---

### 4. business_trips
**Purpose**: Track business trip records
**RLS Enabled**: No
**Row Count**: 44

#### Columns
- `id` (bigint, PK): Unique identifier, auto-increment
- `opportunity_name` (text, nullable): Related opportunity name
- `customer_name` (text, nullable): Customer name
- `start_time` (timestamptz, nullable): Trip start time
- `end_time` (timestamptz, nullable): Trip end time
- `reason` (text, nullable): Trip reason
- `employee_name` (text, nullable): Employee name
- `employee_id` (text, nullable): Employee ID
- `department` (text, nullable): Department

---

### 5. feishu_departments
**Purpose**: Store Feishu (Lark) department information
**RLS Enabled**: Yes
**Row Count**: 242

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `department_id` (text, unique): Feishu department ID
- `name` (text): Department name
- `parent_id` (text, nullable): Parent department ID
- `order_value` (integer, nullable): Display order, default: 0
- `member_count` (integer, nullable): Number of members, default: 0
- `leader_user_id` (text, nullable): Department leader user ID
- `status` (jsonb, nullable): Department status
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()
- `updated_at` (timestamptz, nullable): Last update timestamp, default: now()

#### Foreign Key References
- Referenced by: `attendance_records.department_id`

---

### 6. feishu_members
**Purpose**: Store Feishu (Lark) member information
**RLS Enabled**: Yes
**Row Count**: 891

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `open_id` (text, unique): Feishu open ID
- `user_id` (text, nullable): Feishu user ID
- `name` (text): Member name
- `en_name` (text, nullable): English name
- `employee_no` (text, nullable): Employee number
- `email` (text, nullable): Email address
- `avatar_url` (text, nullable): Avatar URL
- `department_id` (text, nullable): Department IDs (text format), default: '{}'
- `job_title` (text, nullable): Job title
- `gender` (smallint, nullable): Gender (0: unknown, 1: male, 2: female)
- `employee_type` (smallint, nullable): Employee type
- `status` (jsonb, nullable): Member status
- `join_time` (bigint, nullable): Join timestamp
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()
- `updated_at` (timestamptz, nullable): Last update timestamp, default: now()

#### Foreign Key References
- Referenced by: `attendance_records.member_id`

---

### 7. attendance_records
**Purpose**: Attendance records linked to Feishu members and departments
**RLS Enabled**: Yes
**Row Count**: 369

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `member_id` (uuid): Foreign key to feishu_members.id
- `department_id` (text): Foreign key to feishu_departments.department_id
- `year_month` (integer): Year and month (format: YYYYMM)
- `expected_days` (numeric, nullable): Expected working days, default: 0
- `actual_days` (numeric, nullable): Actual working days, default: 0
- `leave_days` (numeric, nullable): Leave days, default: 0
- `absent_days` (numeric, nullable): Absent days, default: 0
- `late_times` (integer, nullable): Number of late arrivals, default: 0
- `early_leave_times` (integer, nullable): Number of early leaves, default: 0
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()
- `updated_at` (timestamptz, nullable): Last update timestamp, default: now()

#### Foreign Keys
- `member_id` → `feishu_members.id`
- `department_id` → `feishu_departments.department_id`

---

### 8. edu_biz_report
**Purpose**: 25学年经营数据报表（fone年初定稿版 / 突围版），涵盖 sheets 1.1/1.2/2.1/2.2/2.3
**RLS Enabled**: No
**Row Count**: 9,699
**Comment**: 教育后勤2025经营数据（fone版/突围版）

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `sheet_code` (text): Sheet编号：1.1/1.2/2.1/2.2/2.3
- `report_type` (text): 报表类型 (fone, tuwei)
- `period_type` (text): 期间类型 (cumulative, monthly)
- `period` (text): 数据期间，如 <202603, 202602, 202601-202602
- `period_yoy` (text, nullable): 同期期间，如 <202503, 202502
- `node_name` (text): 业务单元/分析单元名称（共132个，如"生活体验广场"、"西南区域合计"等）
- `sort_order` (integer): 原始行号排序（8-139）, default: 0
- `metric_category` (text): 指标英文标识（revenue, catering_expense, material_cost, gross_profit, gross_margin, labor_cost, other_expense, external_revenue, external_expense, pretax_profit, pretax_margin, headcount, per_capita_revenue, labor_cost_rate, revenue_creation, profit_creation）
- `metric_category_cn` (text): 指标中文名（营业收入、餐饮支出、物资销售成本、毛利额、毛利率、人力成本、其他支出、营业外收入、营业外支出、税前利润、税前利润率、职工人数、人均营收、人力成本率、一元创收、一元创利）
- `actual_value` (numeric, nullable): 实际值
- `budget_value` (numeric, nullable): 预算数（fone版为年初预算数，突围版为考核数）
- `completion_rate` (numeric, nullable): 预算完成率
- `diff_value` (numeric, nullable): 预实差异
- `yoy_value` (numeric, nullable): 同期值
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()

#### Indexes
- `idx_edu_biz_report_node_name` on (node_name)

#### Check Constraints
- `report_type IN ('fone', 'tuwei')`
- `period_type IN ('cumulative', 'monthly')`

#### Data Source
- Sheet 1.1: 25学年累计（fone年初定稿版）→ report_type=fone, period_type=cumulative
- Sheet 1.2: 25学年2月底稿（fone年初定稿版）→ report_type=fone, period_type=monthly
- Sheet 2.1: 25学1-2月底稿（突围版）→ report_type=tuwei, period_type=cumulative
- Sheet 2.2: 25学年1月底稿（突围版）→ report_type=tuwei, period_type=monthly
- Sheet 2.3: 25学年2月底稿（突围版）→ report_type=tuwei, period_type=monthly

#### Import Script
`scripts/import_biz_data.py` — reads from `docs/data/25学年经营数据.xlsx`

Idempotent (clears and re-imports). Use LEFT JOIN with `edu_org_hierarchy` table to get organizational hierarchy.

---

### 9. edu_biz_monthly_plan
**Purpose**: 25学年1-6月突围计划分月版，涵盖 sheet 3
**RLS Enabled**: No
**Row Count**: 1,848
**Comment**: 教育后勤25学年1-6月突围计划分月版

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `node_name` (text): 业务单元/分析单元名称
- `sort_order` (integer): 原始行号排序, default: 0
- `metric_category` (text): 指标标识 (revenue, pretax_profit)
- `metric_category_cn` (text): 指标中文名（营业收入、税前利润）
- `month` (text): 月份（202601-202606）或 total（合计）
- `plan_value` (numeric, nullable): 计划值
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()

#### Indexes
- `idx_edu_biz_monthly_plan_node_name` on (node_name)

#### Check Constraints
- `metric_category IN ('revenue', 'pretax_profit')`

#### Data Source
- Sheet 3: 1-6突围计划分月版（每个业务单元 × 2个指标 × 7列(6个月+合计)）

#### Import Script
`scripts/import_biz_data.py` — same script as edu_biz_report. Use LEFT JOIN with `edu_org_hierarchy` table to get organizational hierarchy.

---

### 10. edu_org_hierarchy
**Purpose**: 组织层级映射表 - 定义业务单元的组织层级结构
**RLS Enabled**: No
**Row Count**: 153
**Comment**: 从教育后勤2025经营数据看版_组织标签映射表-勿动.xlsx导入

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `node_name` (text, unique): 组织标签（节点名称），对应 edu_biz_report 和 edu_biz_monthly_plan 的 node_name
- `level_1` (text, nullable): 中心/区域 - 后勤管理中心, 三大区域, 商业业务, 战略支持中心, 科创发展中心
- `level_2` (text, nullable): 板块业务分类 - 教育园特色餐饮, 西南区域, 东部区域, etc.
- `level_3` (text, nullable): 25年业务板块-分析汇报一级 - Primary reporting unit
- `label` (text, nullable): 业务板块-分析汇报二级 - Secondary tag/category (中心餐饮业务, 管理部门, 其他, etc.)
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()

#### Indexes
- `idx_edu_org_hierarchy_node_name` on (node_name)

#### Usage Example
```sql
-- 获取带层级信息的经营数据
SELECT
  r.node_name,
  r.metric_category,
  r.actual_value,
  h.level_1,
  h.level_2,
  h.level_3,
  h.label
FROM edu_biz_report r
LEFT JOIN edu_org_hierarchy h ON r.node_name = h.node_name
WHERE r.sheet_code = '1.1' AND r.metric_category = 'revenue';
```

#### Import Script
`scripts/import_biz_data.py` — reads from `docs/data/教育后勤2025经营数据看版_组织标签映射表-勿动.xlsx`

Idempotent (clears and re-imports).

---

## Database Relationships

```
feishu_members (891 rows)
    ↓ (member_id)
attendance_records (369 rows)
    ↓ (department_id)
feishu_departments (242 rows)

edu_org_hierarchy (153 rows)       ← 组织层级映射表
    ↓ (node_name)
edu_biz_report (9,699 rows)        ← 经营数据报表 (sheets 1.1-2.3)
edu_biz_monthly_plan (1,848 rows)  ← 突围计划分月版 (sheet 3)
  ↑ Import source: docs/data/25学年经营数据.xlsx
```

## Row-Level Security (RLS)

Tables with RLS enabled:
- `opportunity_ledger`
- `feishu_departments`
- `feishu_members`
- `attendance_records`

Tables without RLS:
- `schedule_items`
- `edu_logistics_biz_data`
- `business_trips`
- `edu_biz_report`
- `edu_biz_monthly_plan`
- `edu_org_hierarchy`
