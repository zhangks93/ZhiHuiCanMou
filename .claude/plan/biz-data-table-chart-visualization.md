# Implementation Plan: Business Data Table & Chart Visualization

## Task Type
- [x] Frontend (React + TypeScript)
- [x] Fullstack (Frontend + Data Integration)

## Technical Solution

### Overview
Implement comprehensive data visualization for the business data page (`BizData.tsx`) with:
1. **Filter-driven data fetching**: Use existing filters to query `edu_biz_report` with `edu_org_hierarchy` JOIN
2. **Table visualization**: Implement using `@tanstack/react-table` v8 with hierarchical data display
3. **Chart visualization**: Implement using `recharts` with multiple chart types

### Architecture Decisions

**Data Flow:**
```
User Filters (ReportType, PeriodType, Month)
  ↓
fetchBizReport() + fetchMonthlyPlan()
  ↓
aggregateByNode() → EnrichedBizDataNode[]
  ↓
buildHierarchyTree() → HierarchyTree
  ↓
├─→ TableView (react-table)
└─→ ChartView (recharts)
```

**Component Structure:**
```
BizData.tsx (main page)
├─ Filter Bar (existing)
├─ ViewModeTabs (new: Table/Chart toggle)
├─ TableView (new)
│  ├─ MetricSelector (new: select which metrics to display)
│  ├─ HierarchyToggle (new: expand/collapse hierarchy)
│  └─ DataTable (react-table implementation)
└─ ChartView (enhanced)
   ├─ ChartTypeSelector (new: Bar/Line/Pie)
   ├─ MetricSelector (reuse)
   └─ Chart Component (recharts)
```

## Implementation Steps

### Step 1: Install Dependencies
**Deliverable**: Add recharts to package.json

```bash
cd app && npm install recharts
```

**Files Modified:**
- `app/package.json`

---

### Step 2: Create Metric Selector Component
**Deliverable**: Reusable component for selecting which metrics to display

**File**: `app/src/components/BizData/MetricSelector.tsx`

```typescript
interface MetricSelectorProps {
  selectedMetrics: MetricCategory[]
  onChange: (metrics: MetricCategory[]) => void
  availableMetrics: MetricCategory[]
}

export function MetricSelector({ selectedMetrics, onChange, availableMetrics }: MetricSelectorProps) {
  // Multi-select dropdown for metrics
  // Default: revenue, pretax_profit, gross_margin
  // Display Chinese labels from metric_category_cn
}
```

**Key Features:**
- Multi-select dropdown with checkboxes
- Display Chinese metric names
- Default selection: revenue, pretax_profit, gross_margin
- Limit to 6 metrics max for readability

---

### Step 3: Create View Mode Toggle Component
**Deliverable**: Toggle between Table and Chart views

**File**: `app/src/components/BizData/ViewModeToggle.tsx`

```typescript
interface ViewModeToggleProps {
  value: 'table' | 'chart'
  onChange: (mode: 'table' | 'chart') => void
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  // Two-button toggle: 表格视图 | 图表视图
  // Icons: Table2, BarChart3 from lucide-react
}
```

---

### Step 4: Implement Table View with react-table
**Deliverable**: Hierarchical table with expandable rows

**File**: `app/src/components/BizData/TableView.tsx`

```typescript
interface TableViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
}

export function TableView({ nodes, reportType, selectedMetrics }: TableViewProps) {
  // Use @tanstack/react-table v8
  // Column structure:
  // - node_name (fixed left, with expand/collapse icon)
  // - For each selected metric:
  //   - actual_value
  //   - budget_value (fone or tuwei based on reportType)
  //   - completion_rate
  //   - diff_value
  //   - yoy_value

  const columns = useMemo(() => [
    {
      accessorKey: 'node_name',
      header: '业务单元',
      cell: ({ row }) => (
        <div style={{ paddingLeft: `${row.depth * 20}px` }}>
          {row.getCanExpand() && (
            <button onClick={row.getToggleExpandedHandler()}>
              {row.getIsExpanded() ? '▼' : '▶'}
            </button>
          )}
          {row.original.node_name}
        </div>
      ),
    },
    ...selectedMetrics.flatMap(metric => [
      {
        accessorKey: `metrics.${metric}.actual`,
        header: `${METRIC_LABELS[metric]} - 实际`,
        cell: ({ getValue }) => fmt(getValue()),
      },
      {
        accessorKey: `metrics.${metric}.budget_${reportType}`,
        header: `${METRIC_LABELS[metric]} - 预算`,
        cell: ({ getValue }) => fmt(getValue()),
      },
      {
        accessorKey: `metrics.${metric}.completion_${reportType}`,
        header: `${METRIC_LABELS[metric]} - 完成率`,
        cell: ({ getValue }) => fmtPct(getValue()),
      },
    ]),
  ], [selectedMetrics, reportType])

  const table = useReactTable({
    data: nodes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => getChildren(row, nodes), // Use existing getChildren from bizDataService
  })

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        {/* Render table with sticky header */}
      </table>
    </div>
  )
}
```

**Key Features:**
- Hierarchical rows with expand/collapse
- Sticky header for scrolling
- Color-coded completion rates (red < 70%, yellow 70-90%, green > 90%)
- Responsive column widths
- Export to CSV button (future enhancement)

---

### Step 5: Enhance Chart View with Recharts
**Deliverable**: Multiple chart types for data visualization

**File**: `app/src/components/BizData/ChartView.tsx` (replace existing)

```typescript
interface ChartViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
}

export function ChartView({ nodes, reportType, selectedMetrics }: ChartViewProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar')
  const [hierarchyLevel, setHierarchyLevel] = useState<'total' | 'centers' | 'segments'>('centers')

  // Filter nodes based on hierarchy level
  const tree = buildHierarchyTree(nodes)
  const displayNodes = hierarchyLevel === 'total' ? tree.total :
                       hierarchyLevel === 'centers' ? tree.centers :
                       tree.segments

  // Prepare chart data
  const chartData = displayNodes.map(node => ({
    name: node.node_name,
    ...selectedMetrics.reduce((acc, metric) => ({
      ...acc,
      [`${metric}_actual`]: node.metrics[metric]?.actual,
      [`${metric}_budget`]: node.metrics[metric]?.[`budget_${reportType}`],
    }), {}),
  }))

  return (
    <div className="space-y-4">
      {/* Chart Type Selector */}
      <div className="flex gap-2">
        <button onClick={() => setChartType('bar')}>柱状图</button>
        <button onClick={() => setChartType('line')}>折线图</button>
        <button onClick={() => setChartType('pie')}>饼图</button>
      </div>

      {/* Hierarchy Level Selector */}
      <div className="flex gap-2">
        <button onClick={() => setHierarchyLevel('total')}>总计</button>
        <button onClick={() => setHierarchyLevel('centers')}>中心级</button>
        <button onClick={() => setHierarchyLevel('segments')}>板块级</button>
      </div>

      {/* Chart Rendering */}
      {chartType === 'bar' && (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            {selectedMetrics.map((metric, idx) => (
              <Bar key={metric} dataKey={`${metric}_actual`} fill={COLORS[idx]} name={METRIC_LABELS[metric]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartType === 'line' && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {selectedMetrics.map((metric, idx) => (
              <Line key={metric} type="monotone" dataKey={`${metric}_actual`} stroke={COLORS[idx]} name={METRIC_LABELS[metric]} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {chartType === 'pie' && selectedMetrics.length === 1 && (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey={`${selectedMetrics[0]}_actual`}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              fill="#8884d8"
              label
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

**Key Features:**
- Three chart types: Bar, Line, Pie
- Hierarchy level selector (total/centers/segments)
- Color-coded metrics
- Responsive sizing
- Tooltips with detailed info
- Legend for metric identification

---

### Step 6: Create Chart Type Selector Component
**Deliverable**: Reusable component for selecting chart type

**File**: `app/src/components/BizData/ChartTypeSelector.tsx`

```typescript
interface ChartTypeSelectorProps {
  value: 'bar' | 'line' | 'pie'
  onChange: (type: 'bar' | 'line' | 'pie') => void
}

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  // Three-button toggle with icons
  // BarChart3, LineChart, PieChart from lucide-react
}
```

---

### Step 7: Create Hierarchy Level Selector Component
**Deliverable**: Component for selecting which hierarchy level to display

**File**: `app/src/components/BizData/HierarchyLevelSelector.tsx`

```typescript
interface HierarchyLevelSelectorProps {
  value: 'total' | 'centers' | 'segments' | 'all'
  onChange: (level: 'total' | 'centers' | 'segments' | 'all') => void
}

export function HierarchyLevelSelector({ value, onChange }: HierarchyLevelSelectorProps) {
  // Four-button toggle: 总计 | 中心级 | 板块级 | 全部
}
```

---

### Step 8: Integrate Components into BizData.tsx
**Deliverable**: Updated main page with table and chart views

**File**: `app/src/pages/BizData.tsx`

```typescript
export function BizData() {
  // ... existing state ...
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricCategory[]>([
    'revenue',
    'pretax_profit',
    'gross_margin',
  ])

  // ... existing data loading ...

  return (
    <>
      <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" subtitle="2025学年 · 单位：万元" />

      {/* Filter Bar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <ReportTypeToggle value={reportType} onChange={setReportType} />
        <PeriodTypeToggle value={periodType} onChange={setPeriodType} />
        <MonthSelector value={selectedMonth} options={availableMonths} onChange={setSelectedMonth} />
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Metric Selector */}
      <div className="mb-4">
        <MetricSelector
          selectedMetrics={selectedMetrics}
          onChange={setSelectedMetrics}
          availableMetrics={ALL_METRICS}
        />
      </div>

      {/* View Content */}
      {viewMode === 'table' ? (
        <TableView nodes={nodes} reportType={reportType} selectedMetrics={selectedMetrics} />
      ) : (
        <ChartView nodes={nodes} reportType={reportType} selectedMetrics={selectedMetrics} />
      )}

      {/* Smart Insights (existing) */}
      {insights.length > 0 && (
        <div className="mt-6">
          {/* ... existing insights rendering ... */}
        </div>
      )}
    </>
  )
}
```

---

### Step 9: Add Metric Labels Constants
**Deliverable**: Centralized metric label mapping

**File**: `app/src/lib/constants.ts` (new file)

```typescript
import type { MetricCategory } from './supabase'

export const METRIC_LABELS: Record<MetricCategory, string> = {
  revenue: '营业收入',
  catering_expense: '餐饮支出',
  material_cost: '物资销售成本',
  gross_profit: '毛利额',
  gross_margin: '毛利率',
  labor_cost: '人力成本',
  other_expense: '其他支出',
  external_revenue: '营业外收入',
  external_expense: '营业外支出',
  pretax_profit: '税前利润',
  pretax_margin: '税前利润率',
  headcount: '职工人数',
  per_capita_revenue: '人均营收',
  labor_cost_rate: '人力成本率',
  revenue_creation: '一元创收',
  profit_creation: '一元创利',
}

export const ALL_METRICS: MetricCategory[] = [
  'revenue',
  'pretax_profit',
  'gross_profit',
  'gross_margin',
  'labor_cost',
  'labor_cost_rate',
  'headcount',
  'per_capita_revenue',
  'revenue_creation',
  'profit_creation',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_revenue',
  'external_expense',
  'pretax_margin',
]

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]
```

---

### Step 10: Add Formatting Utilities
**Deliverable**: Enhanced formatting functions

**File**: `app/src/lib/format.ts` (new file)

```typescript
export function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '-'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + suffix
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return (v * 100).toFixed(1) + '%'
}

export function getCompletionColor(rate: number | null | undefined): string {
  if (rate == null) return 'text-gray-400'
  if (rate >= 0.9) return 'text-success-600'
  if (rate >= 0.7) return 'text-warning-600'
  return 'text-error-600'
}

export function getCompletionBgColor(rate: number | null | undefined): string {
  if (rate == null) return 'bg-gray-100'
  if (rate >= 0.9) return 'bg-success-100'
  if (rate >= 0.7) return 'bg-warning-100'
  return 'bg-error-100'
}
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| app/package.json | Modify | Add recharts dependency |
| app/src/pages/BizData.tsx | Modify | Integrate table/chart views, add view mode toggle |
| app/src/components/BizData/TableView.tsx | Create | Hierarchical table with react-table |
| app/src/components/BizData/ChartView.tsx | Replace | Enhanced chart view with recharts |
| app/src/components/BizData/MetricSelector.tsx | Create | Multi-select metric picker |
| app/src/components/BizData/ViewModeToggle.tsx | Create | Table/Chart view toggle |
| app/src/components/BizData/ChartTypeSelector.tsx | Create | Bar/Line/Pie chart type selector |
| app/src/components/BizData/HierarchyLevelSelector.tsx | Create | Hierarchy level filter |
| app/src/lib/constants.ts | Create | Metric labels and colors |
| app/src/lib/format.ts | Create | Formatting utilities |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| **Performance**: 9,699 rows may cause table lag | - Implement virtualization with @tanstack/react-virtual<br>- Default to collapsed hierarchy<br>- Limit initial render to top 2 levels |
| **Chart readability**: Too many metrics/nodes | - Limit metric selection to 6 max<br>- Default to centers level (not all nodes)<br>- Add hierarchy level filter |
| **Data consistency**: Different period formats for fone/tuwei | - Already handled in fetchBizReport()<br>- Use period parameter correctly per report type |
| **Mobile responsiveness**: Large tables don't fit | - Horizontal scroll with sticky first column<br>- Consider separate mobile layout |
| **Color accessibility**: Chart colors may not be distinguishable | - Use high-contrast color palette<br>- Add patterns/textures for colorblind users |

---

## Testing Strategy

1. **Unit Tests**:
   - Test metric selector with various selections
   - Test table column generation logic
   - Test chart data transformation

2. **Integration Tests**:
   - Test filter changes trigger correct data fetch
   - Test view mode switching preserves state
   - Test hierarchy expand/collapse

3. **Visual Tests**:
   - Verify table renders correctly with real data
   - Verify charts display correctly for each type
   - Verify responsive behavior on mobile

4. **Performance Tests**:
   - Measure table render time with 9,699 rows
   - Measure chart render time with 100+ nodes
   - Profile memory usage during interactions

---

## Future Enhancements

1. **Export functionality**: Export table to CSV/Excel
2. **Advanced filtering**: Filter by hierarchy level, metric thresholds
3. **Comparison mode**: Side-by-side comparison of different periods
4. **Drill-down**: Click chart segments to drill into details
5. **Custom metrics**: User-defined calculated metrics
6. **Saved views**: Save and load custom metric/filter combinations

---

## SESSION_ID (for /ccg:execute use)

N/A - Multi-model analysis not available on this system. This plan was created using single-model comprehensive analysis.
