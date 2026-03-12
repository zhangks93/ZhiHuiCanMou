# Implementation Plan: 经营数据页面重新设计

## Task Type
- [x] Frontend (UI/UX redesign)
- [x] Backend (Data modeling & queries)
- [x] Fullstack

## Technical Solution

### Overview
Redesign the BizData page to leverage the new `edu_biz_report` (9,656 rows) and `edu_biz_monthly_plan` (1,848 rows) tables, replacing the old `edu_logistics_biz_data` (116 rows). The new design will provide comprehensive views of:
1. **实际经营值** (Actual values)
2. **与预算的关系** (vs Budget - fone版年初预算)
3. **与突围的关系** (vs Breakthrough targets - tuwei版考核数 + monthly plans)
4. **与同比的关系** (vs Year-over-year)

### Data Architecture

#### Data Model
```typescript
// New types for edu_biz_report
interface EduBizReport {
  id: string
  sheet_code: '1.1' | '1.2' | '2.1' | '2.2' | '2.3'
  report_type: 'fone' | 'tuwei'
  period_type: 'cumulative' | 'monthly'
  period: string  // e.g., "<202603", "202602", "202601-202602"
  period_yoy: string | null
  node_name: string
  sort_order: number
  metric_category: MetricCategory
  metric_category_cn: string
  actual_value: number | null
  budget_value: number | null
  completion_rate: number | null
  diff_value: number | null
  yoy_value: number | null
  // Hierarchy
  center_region: string | null
  business_segment: string | null
  report_level1: string | null
  report_level2: string | null
  is_aggregated: boolean
  aggregation_level: string | null
}

// New types for edu_biz_monthly_plan
interface EduBizMonthlyPlan {
  id: string
  node_name: string
  sort_order: number
  metric_category: 'revenue' | 'pretax_profit'
  metric_category_cn: string
  month: string  // '202601'-'202606' or 'total'
  plan_value: number | null
  // Same hierarchy fields
  center_region: string | null
  business_segment: string | null
  report_level1: string | null
  report_level2: string | null
  is_aggregated: boolean
  aggregation_level: string | null
}

type MetricCategory =
  | 'revenue' | 'catering_expense' | 'material_cost'
  | 'gross_profit' | 'gross_margin' | 'labor_cost'
  | 'other_expense' | 'external_revenue' | 'external_expense'
  | 'pretax_profit' | 'pretax_margin' | 'headcount'
  | 'per_capita_revenue' | 'labor_cost_rate'
  | 'revenue_creation' | 'profit_creation'

// Aggregated view for UI
interface BizDataNode {
  node_name: string
  sort_order: number
  hierarchy: {
    center_region: string | null
    business_segment: string | null
    report_level1: string | null
    report_level2: string | null
    is_aggregated: boolean
    aggregation_level: string | null
  }
  metrics: {
    [key in MetricCategory]?: {
      actual: number | null
      budget_fone: number | null  // 年初预算
      budget_tuwei: number | null  // 突围考核数
      completion_fone: number | null
      completion_tuwei: number | null
      diff_fone: number | null
      diff_tuwei: number | null
      yoy: number | null
      monthly_plan?: { [month: string]: number }  // For revenue & pretax_profit
    }
  }
}
```

#### Query Strategy
1. **Initial Load**: Fetch latest cumulative data (period_type='cumulative', latest period)
   - Query `edu_biz_report` for both fone and tuwei versions
   - Query `edu_biz_monthly_plan` for monthly breakdown
   - Join by `node_name` and `metric_category`

2. **Filtering Options**:
   - Period selector: cumulative vs monthly (specific month)
   - Report type toggle: fone vs tuwei vs comparison
   - Hierarchy drill-down: center → segment → level1 → level2

3. **Performance Optimization**:
   - Use indexed columns: `node_name`, `metric_category`, `period`, `center_region`
   - Client-side aggregation for hierarchy tree
   - Lazy load monthly details on demand

### UI Architecture

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ PageTitle: 经营数据 · 2025学年                               │
├─────────────────────────────────────────────────────────────┤
│ Period Selector: [累计 ▼] [2月 ▼]  Report Type: [对比视图 ▼] │
├─────────────────────────────────────────────────────────────┤
│ KPI Cards (4-6 cards)                                       │
│ ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│ │ 实际营收  │ 实际利润  │ 毛利率    │ 预算达成  │ 突围达成  │   │
│ │ vs预算   │ vs预算   │ vs同期   │ (fone)   │ (tuwei)  │   │
│ └──────────┴──────────┴──────────┴──────────┴──────────┘   │
├─────────────────────────────────────────────────────────────┤
│ Comparison View Tabs                                        │
│ [预算对比] [突围对比] [同比对比] [月度趋势]                   │
├─────────────────────────────────────────────────────────────┤
│ Metric Selector                                             │
│ [营收] [利润] [毛利] [成本] [人效]                           │
├─────────────────────────────────────────────────────────────┤
│ Hierarchical Data Table                                     │
│ ▼ 后勤管理中心                                               │
│   ▶ 教育园特色餐饮                                           │
│   ▶ 中心餐饮业务                                             │
│ ▼ 三大区域                                                   │
│   ▶ 西南区域                                                 │
│   ▶ 东部区域                                                 │
│   ▶ 华北区域                                                 │
├─────────────────────────────────────────────────────────────┤
│ Smart Insights (AI-generated analysis)                      │
└─────────────────────────────────────────────────────────────┘
```

#### Component Breakdown
1. **PeriodSelector**: Dropdown for cumulative/monthly selection
2. **ReportTypeToggle**: Switch between fone/tuwei/comparison views
3. **KPICardGrid**: 4-6 stat cards with multi-comparison
4. **ComparisonTabs**: 4 tabs for different comparison modes
5. **MetricSelector**: Horizontal pill buttons for metric categories
6. **HierarchicalTable**: Tree table with expand/collapse
7. **ComparisonCell**: Custom cell component showing actual vs target with visual indicators
8. **MonthlyTrendChart**: Line/bar chart for monthly breakdown (optional)
9. **InsightsPanel**: AI-generated insights based on data patterns

### Implementation Steps

#### Step 1: Update Type Definitions
**File**: `app/src/lib/supabase.ts`
- Add `EduBizReport` interface
- Add `EduBizMonthlyPlan` interface
- Add `BizDataNode` aggregated interface
- Add `MetricCategory` type
- Keep old `BizDataSnapshot` for backward compatibility (mark as deprecated)

**Deliverable**: Type-safe interfaces for new tables

#### Step 2: Create Data Service Layer
**File**: `app/src/services/bizDataService.ts` (new)
- `fetchBizReport(options)`: Query edu_biz_report with filters
- `fetchMonthlyPlan(options)`: Query edu_biz_monthly_plan
- `aggregateByNode(reports, plans)`: Merge data by node_name
- `buildHierarchyTree(nodes)`: Build tree structure from flat data
- `calculateComparisons(node)`: Compute completion rates, diffs

**Deliverable**: Reusable data fetching and transformation logic

#### Step 3: Create UI Components
**Files**:
- `app/src/components/BizData/PeriodSelector.tsx`
- `app/src/components/BizData/ReportTypeToggle.tsx`
- `app/src/components/BizData/ComparisonTabs.tsx`
- `app/src/components/BizData/MetricSelector.tsx`
- `app/src/components/BizData/ComparisonCell.tsx`
- `app/src/components/BizData/HierarchicalTable.tsx`
- `app/src/components/BizData/MonthlyTrendChart.tsx` (optional)

**Deliverable**: Reusable, composable UI components

#### Step 4: Refactor BizData Page
**File**: `app/src/pages/BizData.tsx`
- Replace `edu_logistics_biz_data` queries with new service calls
- Implement period/report type state management
- Integrate new components
- Update insights engine to use new data structure
- Add loading states and error handling

**Deliverable**: Fully functional redesigned page

#### Step 5: Update Insights Engine
**File**: `app/src/pages/BizData.tsx` (insights section)
- Extend `generateInsights()` to analyze:
  - Fone vs Tuwei completion rate gaps
  - Monthly plan progress tracking
  - YoY growth/decline patterns
  - Cross-metric correlations (e.g., revenue up but profit down)
- Add insight types: `breakthrough_gap`, `monthly_lag`, `yoy_trend`

**Deliverable**: Enhanced AI insights with multi-dimensional analysis

#### Step 6: Add Monthly Trend Visualization (Optional)
**File**: `app/src/components/BizData/MonthlyTrendChart.tsx`
- Use recharts or similar library
- Show monthly plan vs actual (if monthly data available)
- Line chart for trends, bar chart for comparisons
- Interactive tooltips with detailed breakdowns

**Deliverable**: Visual monthly trend analysis

#### Step 7: Testing & Refinement
- Test with real data (9,656 + 1,848 rows)
- Verify hierarchy tree rendering performance
- Test all comparison modes (fone/tuwei/yoy)
- Validate calculations (completion rates, diffs)
- Cross-browser testing
- Mobile responsiveness check

**Deliverable**: Production-ready, tested implementation

### Key Files

| File | Operation | Description |
|------|-----------|-------------|
| app/src/lib/supabase.ts | Modify | Add new type definitions |
| app/src/services/bizDataService.ts | Create | Data fetching & transformation service |
| app/src/components/BizData/PeriodSelector.tsx | Create | Period selection dropdown |
| app/src/components/BizData/ReportTypeToggle.tsx | Create | Fone/Tuwei/Comparison toggle |
| app/src/components/BizData/ComparisonTabs.tsx | Create | Comparison mode tabs |
| app/src/components/BizData/MetricSelector.tsx | Create | Metric category selector |
| app/src/components/BizData/ComparisonCell.tsx | Create | Table cell with comparison visuals |
| app/src/components/BizData/HierarchicalTable.tsx | Create | Tree table component |
| app/src/components/BizData/MonthlyTrendChart.tsx | Create | Monthly trend chart (optional) |
| app/src/pages/BizData.tsx | Refactor | Main page with new data & components |

### Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| **Performance**: 9,656 rows may cause slow rendering | Use virtualized table (react-window), client-side pagination, lazy load children |
| **Data complexity**: Multiple joins (fone + tuwei + monthly) | Pre-aggregate on client, cache results, use indexed queries |
| **Hierarchy ambiguity**: 4-level hierarchy may be confusing | Clear visual indentation, breadcrumb trail, collapsible sections |
| **Missing data**: Not all nodes have monthly plans | Graceful fallback, show "N/A" or "-", don't break UI |
| **Calculation errors**: Completion rate edge cases (division by zero) | Safe math helpers, null checks, display "-" for invalid |
| **Mobile UX**: Complex table hard to view on small screens | Horizontal scroll, card view alternative, responsive breakpoints |

### Technical Decisions

#### Why not use a chart library for the main view?
- **Pro**: Visual appeal, easier to spot trends
- **Con**: 132 nodes × 16 metrics = too dense for charts
- **Decision**: Use table as primary view, add optional chart for monthly trends

#### Why aggregate on client vs server?
- **Pro (client)**: Flexible filtering, no backend changes, works with Supabase anon key
- **Con (client)**: Initial load time, memory usage
- **Decision**: Client-side aggregation with caching, consider server-side if performance issues

#### Why keep old BizDataSnapshot type?
- **Pro**: Backward compatibility, gradual migration
- **Con**: Code duplication, confusion
- **Decision**: Mark as deprecated, remove after migration complete

#### Fone vs Tuwei: Separate views or side-by-side?
- **Option A**: Toggle between fone/tuwei (simpler UI)
- **Option B**: Side-by-side comparison (more info density)
- **Decision**: Default to comparison view (side-by-side), allow toggle to single view

### Data Flow Diagram

```
┌─────────────────┐
│  Supabase DB    │
│  edu_biz_report │ (9,656 rows)
│  edu_biz_       │ (1,848 rows)
│  monthly_plan   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ bizDataService  │
│ - fetchBizReport│
│ - fetchMonthly  │
│ - aggregate     │
│ - buildTree     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BizData Page   │
│  State:         │
│  - period       │
│  - reportType   │
│  - metric       │
│  - expandedNodes│
└────────┬────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
    KPICardGrid   ComparisonTabs  MetricSelector  HierarchicalTable
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                        │
                        ▼
                 ComparisonCell
                 (actual vs budget vs tuwei vs yoy)
```

### Pseudo-code

#### Data Fetching
```typescript
async function loadBizData(period: string, reportTypes: ('fone' | 'tuwei')[]) {
  // Fetch fone data
  const foneData = await supabase
    .from('edu_biz_report')
    .select('*')
    .eq('report_type', 'fone')
    .eq('period_type', 'cumulative')
    .eq('period', period)
    .order('sort_order')

  // Fetch tuwei data
  const tuweiData = await supabase
    .from('edu_biz_report')
    .select('*')
    .eq('report_type', 'tuwei')
    .eq('period_type', 'cumulative')
    .eq('period', period)
    .order('sort_order')

  // Fetch monthly plans
  const monthlyPlans = await supabase
    .from('edu_biz_monthly_plan')
    .select('*')
    .order('sort_order')

  // Aggregate by node
  const nodes = aggregateByNode(foneData, tuweiData, monthlyPlans)

  // Build hierarchy tree
  const tree = buildHierarchyTree(nodes)

  return tree
}
```

#### Aggregation Logic
```typescript
function aggregateByNode(fone, tuwei, plans) {
  const nodeMap = new Map<string, BizDataNode>()

  // Process fone data
  for (const row of fone) {
    if (!nodeMap.has(row.node_name)) {
      nodeMap.set(row.node_name, createEmptyNode(row))
    }
    const node = nodeMap.get(row.node_name)!
    if (!node.metrics[row.metric_category]) {
      node.metrics[row.metric_category] = {}
    }
    node.metrics[row.metric_category].actual = row.actual_value
    node.metrics[row.metric_category].budget_fone = row.budget_value
    node.metrics[row.metric_category].completion_fone = row.completion_rate
    node.metrics[row.metric_category].diff_fone = row.diff_value
    node.metrics[row.metric_category].yoy = row.yoy_value
  }

  // Process tuwei data
  for (const row of tuwei) {
    const node = nodeMap.get(row.node_name)
    if (node && node.metrics[row.metric_category]) {
      node.metrics[row.metric_category].budget_tuwei = row.budget_value
      node.metrics[row.metric_category].completion_tuwei = row.completion_rate
      node.metrics[row.metric_category].diff_tuwei = row.diff_value
    }
  }

  // Process monthly plans
  for (const plan of plans) {
    const node = nodeMap.get(plan.node_name)
    if (node && node.metrics[plan.metric_category]) {
      if (!node.metrics[plan.metric_category].monthly_plan) {
        node.metrics[plan.metric_category].monthly_plan = {}
      }
      node.metrics[plan.metric_category].monthly_plan![plan.month] = plan.plan_value
    }
  }

  return Array.from(nodeMap.values())
}
```

#### Hierarchy Tree Building
```typescript
function buildHierarchyTree(nodes: BizDataNode[]) {
  // Sort by sort_order
  nodes.sort((a, b) => a.sort_order - b.sort_order)

  // Group by hierarchy levels
  const rootNodes = nodes.filter(n => n.hierarchy.is_aggregated && n.hierarchy.aggregation_level === 'total')
  const centerNodes = nodes.filter(n => n.hierarchy.center_region && !n.hierarchy.business_segment)
  const segmentNodes = nodes.filter(n => n.hierarchy.business_segment && !n.hierarchy.report_level1)
  const level1Nodes = nodes.filter(n => n.hierarchy.report_level1 && !n.hierarchy.report_level2)
  const level2Nodes = nodes.filter(n => n.hierarchy.report_level2)

  // Build parent-child relationships
  // (Implementation depends on exact hierarchy logic)

  return {
    root: rootNodes,
    centers: centerNodes,
    segments: segmentNodes,
    level1: level1Nodes,
    level2: level2Nodes,
  }
}
```

## Next Steps

After user approves, execute:

```bash
/ccg:execute .claude/plan/biz-data-redesign.md
```

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (external model call failed)
- GEMINI_SESSION: N/A (external model call failed)

**Note**: External model analysis was attempted but failed. This plan is based on Claude's direct analysis of the codebase and requirements.
