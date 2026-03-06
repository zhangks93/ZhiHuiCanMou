# Supabase Database Schema

Last updated: 2026-03-06

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

## Database Relationships

```
feishu_members (891 rows)
    ↓ (member_id)
attendance_records (369 rows)
    ↓ (department_id)
feishu_departments (242 rows)
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
