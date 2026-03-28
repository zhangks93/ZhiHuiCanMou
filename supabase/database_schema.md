# Supabase Database Schema

Last updated: 2026-03-24

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
**Purpose**: Store row-level opportunity entries parsed from visible workbook sheets
**RLS Enabled**: Yes
**Row Count**: dynamic

#### Columns
- `snapshot_id` (uuid, FK): References `opportunity_ledger_snapshots.id`
- `sheet_name` (text): Source sheet name, such as `0320`
- `row_number` (integer): Original Excel row number in the source sheet
- `schema_version` (text): Current parser version, fixed to `visible_v1`
- `target_date_raw` (text, nullable): Raw expected completion cell value
- `first_year_revenue_raw` (text, nullable): Raw first-year revenue cell value
- `Note`: The column list below is being transitioned from the legacy design; the migration `20260324153000_redesign_opportunity_ledger_for_visible_sheets` is the source of truth.
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `org_id` (uuid, nullable): Organization ID
- `snapshot_date` (date): Date of the snapshot
- `schema_version` (text): Record schema version (`legacy`, `funnel_v2`), default: `legacy`
- `project_group` (text, nullable): Project grouping from the latest workbook, such as 自拓项目
- `stage_code` (text, nullable): Funnel stage code (`lead`, `opportunity`, `internal_approval`, `customer_approval`, `contracted`, `legacy`)
- `stage_label` (text, nullable): Original or display label of the funnel stage
- `progress_note` (text, nullable): Current progress / next-step note
- `target_date` (date, nullable): Expected completion / landing date
- `first_year_revenue` (numeric, nullable): Expected first-year revenue
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
- `legacy_item_type` (text, nullable): Explicit legacy item type mirror
- `legacy_estimated_amount` (numeric, nullable): Explicit legacy estimated amount mirror
- `legacy_logistics_approved` (boolean, nullable): Explicit legacy logistics approval mirror
- `legacy_group_approved` (boolean, nullable): Explicit legacy group approval mirror
- `legacy_bid_date` (date, nullable): Explicit legacy bid date mirror
- `legacy_win_probability` (numeric, nullable): Explicit legacy probability mirror
- `legacy_manager_ready` (boolean, nullable): Explicit legacy manager readiness mirror
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()
- `updated_at` (timestamptz, nullable): Last update timestamp, default: now()

---

### 3. opportunity_ledger_snapshots
**Purpose**: Store one import snapshot per visible opportunity-ledger sheet
**RLS Enabled**: Yes
**Row Count**: dynamic

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `sheet_name` (text): Visible sheet name in workbook
- `sheet_index` (integer): Visible-sheet order in workbook
- `snapshot_date` (date): Snapshot date parsed from sheet name
- `source_file_name` (text): Imported workbook file name
- `source_file_path` (text, nullable): Imported workbook path
- `row_count` (integer): Imported detail row count
- `imported_at` (timestamptz): Import timestamp, default: now()
- `created_at` (timestamptz): Creation timestamp, default: now()

---

### 4. edu_logistics_biz_data
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
**Purpose**: 25学年经营数据报表（fone年初定稿版 / 突围版），涵盖 sheets 1.1/1.2/2.1/2.2/2.3 + 成本分析 6.1/6.2/7.1/7.2
**RLS Enabled**: No
**Row Count**: 11,477
**Comment**: 25学年经营数据报表（含节点层级关系）

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `sheet_code` (text): Sheet编号：1.1/1.2/2.1/2.2/2.3/6.1/6.2/7.1/7.2
- `report_type` (text): 报表类型 (fone, tuwei)
- `period_type` (text): 期间类型 (cumulative, monthly)
- `period` (text): 数据期间，如 <202603, 202602, 202601-202602
- `period_yoy` (text, nullable): 同期期间，如 <202503, 202502
- `node_name` (text): 组织节点名称（软关联 edu_org_hierarchy.node_name）
- `sort_order` (integer): 原始行号排序（8-139）, default: 0
- `metric_category` (text): 指标英文标识（25个指标）
- `metric_category_cn` (text): 指标中文名
- `actual_value` (numeric, nullable): 实际值
- `budget_value` (numeric, nullable): 预算数（fone版为年初预算数，突围版为考核数）
- `completion_rate` (numeric, nullable): 预算完成率
- `diff_value` (numeric, nullable): 预实差异
- `yoy_value` (numeric, nullable): 同期值
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()

#### 25 Metric Categories (指标类别)
主报表指标（16个）：
- revenue (营业收入), catering_expense (餐饮支出), material_cost (物资销售成本), gross_profit (毛利额), gross_margin (毛利率), labor_cost (人力成本), other_expense (其他支出), external_revenue (营业外收入), external_expense (营业外支出), pretax_profit (税前利润), pretax_margin (税前利润率), headcount (职工人数), per_capita_revenue (人均营收), labor_cost_rate (人力成本率), revenue_creation (一元创收), profit_creation (一元创利)

成本分析指标（10个）：
- labor_cost (人力成本), salary (工资), social_insurance (社保), housing_fund (公积金), labor_service_fee (劳务费), other_labor_cost (其他人力成本), vehicle_expense (车辆费用), energy_expense (能耗费), travel_expense (差旅费), entertainment_expense (业务招待费)

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
- Sheet 6.1-6.2: 成本分析（fone版）→ labor_cost, salary, social_insurance, housing_fund, labor_service_fee, other_labor_cost
- Sheet 7.1-7.2: 成本分析（突围版）→ vehicle_expense, energy_expense, travel_expense, entertainment_expense

#### Import Script
`scripts/import_biz_data.py` — reads from `docs/data/25学年经营数据.xlsx`

Idempotent (clears and re-imports). Use LEFT JOIN with `edu_org_hierarchy` table to get organizational hierarchy (level_0, level_1, level_2).

---

### 9. edu_biz_monthly_plan
**Purpose**: 25学年1-6月突围计划分月版，涵盖 sheet 3
**RLS Enabled**: No
**Row Count**: 1,498
**Comment**: 25学年1-6月突围计划分月版（含节点层级关系）

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
`scripts/import_biz_data.py` — same script as edu_biz_report. Use LEFT JOIN with `edu_org_hierarchy` table to get organizational hierarchy (level_0, level_1, level_2).

---

### 10. edu_org_hierarchy
**Purpose**: 组织层级映射表 - 定义业务单元的组织层级结构
**RLS Enabled**: No
**Row Count**: 153
**Comment**: 从教育后勤2025经营数据看版_组织标签映射表-勿动.xlsx导入

#### Columns
- `id` (uuid, PK): Unique identifier, default: gen_random_uuid()
- `node_name` (text, unique): 组织标签（节点名称），对应 edu_biz_report 和 edu_biz_monthly_plan 的 node_name
- `level_0` (text, nullable): 集团层级
- `level_1` (text, nullable): 一级组织层级
- `level_2` (text, nullable): 二级组织层级
- `created_at` (timestamptz, nullable): Creation timestamp, default: now()

#### Indexes
- `idx_edu_org_hierarchy_node_name` on (node_name)
- `idx_edu_org_hierarchy_level_0` on (level_0)
- `idx_edu_org_hierarchy_level_1` on (level_1)
- `idx_edu_org_hierarchy_level_2` on (level_2)

#### Usage Example
```sql
-- 获取带层级信息的经营数据
SELECT
  r.node_name,
  r.metric_category,
  r.actual_value,
  h.level_0,
  h.level_1,
  h.level_2
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

edu_org_hierarchy (153 rows)        ← 组织层级映射表
    ↓ (node_name, soft relation)
edu_biz_report (11,477 rows)        ← 经营数据报表 (sheets 1.1-2.3 + 6.1-7.2)
edu_biz_monthly_plan (1,498 rows)   ← 突围计划分月版 (sheet 3)
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
