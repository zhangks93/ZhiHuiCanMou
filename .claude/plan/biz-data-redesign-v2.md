# Implementation Plan: BizData Page Redesign (v2)

## Task Type
- [x] Frontend (UI/UX + Data Integration)
- [x] Backend (Data Service Layer)
- [x] Fullstack (Complete Feature)

## Technical Solution

### Overview
Redesign the business data page to properly integrate `edu_org_hierarchy` and `edu_biz_report` tables, providing a hierarchical view with flexible filtering (fone/tuwei, cumulative/monthly) and extensible architecture for future chart visualization.

### Key Technical Decisions

1. **Hierarchy Mapping Strategy**
   - **Current Issue**: The existing implementation uses `aggregation_level` from `edu_biz_report` but doesn't leverage the `edu_org_hierarchy` table's level_1/level_2/level_3 structure
   - **Solution**: Create a JOIN query or service-layer merge between `edu_biz_report.node_name` and `edu_org_hierarchy.node_name` to enrich data with proper hierarchy levels
   - **Benefit**: Provides clearer organizational structure and enables level-based filtering/grouping

2. **Data Fetching Architecture**
   - **Option A (Recommended)**: Enhance `fetchBizReport` to LEFT JOIN with `edu_org_hierarchy` in a single query
   - **Option B**: Fetch separately and merge in service layer
   - **Decision**: Use Option A for better performance and data consistency

3. **Filter State Management**
   - Use React state for: `reportType` ('fone' | 'tuwei' | 'comparison'), `periodType` ('cumulative' | 'monthly'), `selectedPeriod` (string)
   - Existing components (ReportTypeToggle, PeriodSelector) are already created but not integrated

4. **Component Architecture for Extensibility**
   - Create a tab-based layout with `<Tabs>` component
   - Tab 1: "表格视图" (Table View) - current IntegratedComparisonTable
   - Tab 2: "图表视图" (Chart View) - placeholder for future implementation
   - This allows seamless addition of chart visualization without refactoring

5. **Table Display Modes**
   - **Comparison Mode** (default): Show both fone and tuwei side-by-side (current behavior)
   - **Fone Only Mode**: Show only year-initial budget columns
   - **Tuwei Only Mode**: Show only breakthrough target columns

## Implementation Steps

### Step 1: Update Database Query Layer
**File**: `app/src/services/bizDataService.ts`
**Action**: Modify `fetchBizReport` function

```typescript
// Add LEFT JOIN with edu_org_hierarchy to enrich data with hierarchy levels
export async function fetchBizReport(options: BizDataQueryOptions = {}) {
  // ... existing code ...

  let query = supabase
    .from('edu_biz_report')
    .select(`
      *,
      hierarchy:edu_org_hierarchy!inner(
        level_1,
        level_2,
        level_3,
        label
      )
    `)
    .eq('period_type', periodType)
    .order('sort_order')

  // ... rest of filters ...
}
```

**Expected Deliverable**: Enhanced query that returns hierarchy data alongside report data

---

### Step 2: Update Type Definitions
**File**: `app/src/lib/supabase.ts`
**Action**: Extend `EduBizReport` interface

```typescript
export interface EduBizReport {
  // ... existing fields ...

  // Add hierarchy join result
  hierarchy?: {
    level_1: string | null
    level_2: string | null
    level_3: string | null
    label: string | null
  }
}

// Add new type for enriched node with hierarchy
export interface EnrichedBizDataNode extends BizDataNode {
  orgHierarchy: {
    level_1: string | null
    level_2: string | null
    level_3: string | null
    label: string | null
  }
}
```

**Expected Deliverable**: Type-safe hierarchy data structure

---

### Step 3: Update Aggregation Logic
**File**: `app/src/services/bizDataService.ts`
**Action**: Modify `aggregateByNode` to preserve hierarchy data

```typescript
export function aggregateByNode(
  foneReports: EduBizReport[],
  tuweiReports: EduBizReport[],
  monthlyPlans: EduBizMonthlyPlan[]
): EnrichedBizDataNode[] {
  // ... existing aggregation logic ...

  // When creating node, also store orgHierarchy from the report
  const node: EnrichedBizDataNode = {
    ...existingNodeFields,
    orgHierarchy: row.hierarchy || {
      level_1: null,
      level_2: null,
      level_3: null,
      label: null
    }
  }
}
```

**Expected Deliverable**: Nodes enriched with organizational hierarchy

---

### Step 4: Update Hierarchy Tree Building
**File**: `app/src/services/bizDataService.ts`
**Action**: Refactor `buildHierarchyTree` to use `orgHierarchy` levels

```typescript
export function buildHierarchyTree(nodes: EnrichedBizDataNode[]): HierarchyTree {
  // Group by level_1 (e.g., "三大区域", "五大中心")
  const level1Groups = nodes.filter(n => n.orgHierarchy.level_1 && !n.orgHierarchy.level_2)

  // Group by level_2 (e.g., "东部区域", "北部区域")
  const level2Groups = nodes.filter(n => n.orgHierarchy.level_2 && !n.orgHierarchy.level_3)

  // Leaf nodes with level_3
  const level3Nodes = nodes.filter(n => n.orgHierarchy.level_3)

  return {
    total: nodes.filter(n => n.hierarchy.aggregation_level === 'total'),
    level1: level1Groups,
    level2: level2Groups,
    level3: level3Nodes,
    leafNodes: level3Nodes
  }
}
```

**Expected Deliverable**: Proper hierarchy tree based on edu_org_hierarchy levels

---

### Step 5: Update getChildren Logic
**File**: `app/src/services/bizDataService.ts`
**Action**: Refactor `getChildren` to traverse orgHierarchy

```typescript
export function getChildren(parentNode: EnrichedBizDataNode, allNodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  const { level_1, level_2, level_3 } = parentNode.orgHierarchy

  // If parent is level_1, return all level_2 nodes under it
  if (level_1 && !level_2) {
    return allNodes.filter(n =>
      n.orgHierarchy.level_1 === level_1 &&
      n.orgHierarchy.level_2 &&
      !n.orgHierarchy.level_3
    )
  }

  // If parent is level_2, return all level_3 nodes under it
  if (level_2 && !level_3) {
    return allNodes.filter(n =>
      n.orgHierarchy.level_2 === level_2 &&
      n.orgHierarchy.level_3
    )
  }

  return []
}
```

**Expected Deliverable**: Correct parent-child relationships based on hierarchy levels

---

### Step 6: Create View Mode Tabs Component
**File**: `app/src/components/BizData/ViewModeTabs.tsx` (NEW)
**Action**: Create tab component for table/chart switching

```typescript
interface ViewModeTabsProps {
  value: 'table' | 'chart'
  onChange: (value: 'table' | 'chart') => void
}

export function ViewModeTabs({ value, onChange }: ViewModeTabsProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <div className="flex gap-6">
        <button
          onClick={() => onChange('table')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            value === 'table'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          表格视图
        </button>
        <button
          onClick={() => onChange('chart')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            value === 'chart'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          图表视图
        </button>
      </div>
    </div>
  )
}
```

**Expected Deliverable**: Tab navigation component for view switching

---

### Step 7: Create Chart View Placeholder
**File**: `app/src/components/BizData/ChartView.tsx` (NEW)
**Action**: Create placeholder component for future chart implementation

```typescript
import { BarChart3 } from 'lucide-react'

interface ChartViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei' | 'comparison'
}

export function ChartView({ nodes, reportType }: ChartViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <BarChart3 size={64} className="text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-700 mb-2">图表视图</h3>
      <p className="text-sm text-gray-500 text-center max-w-md">
        图表可视化功能即将推出<br />
        将支持柱状图、折线图、饼图等多种展示形式
      </p>
      <div className="mt-4 text-xs text-gray-400">
        当前数据节点: {nodes.length} | 报表类型: {reportType === 'fone' ? '年初预算' : reportType === 'tuwei' ? '突围考核' : '对比视图'}
      </div>
    </div>
  )
}
```

**Expected Deliverable**: Placeholder for future chart implementation

---

### Step 8: Refactor Main BizData Page
**File**: `app/src/pages/BizData.tsx`
**Action**: Integrate all filter components and view mode tabs

```typescript
export function BizData() {
  // State management
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes] = useState<EnrichedBizDataNode[]>([])
  const [periodType, setPeriodType] = useState<'cumulative' | 'monthly'>('cumulative')
  const [reportType, setReportType] = useState<'fone' | 'tuwei' | 'comparison'>('comparison')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [availablePeriods, setAvailablePeriods] = useState<PeriodOption[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')

  // Load available periods on mount
  useEffect(() => {
    async function loadPeriods() {
      const periods = await fetchAvailablePeriods()
      setAvailablePeriods(periods)
      if (periods.length > 0) {
        setSelectedPeriod(periods[0].period)
      }
    }
    loadPeriods()
  }, [])

  // Load data when filters change
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const reportTypes = reportType === 'comparison' ? ['fone', 'tuwei'] : [reportType]

        const foneReports = reportTypes.includes('fone')
          ? await fetchBizReport({ periodType, reportTypes: ['fone'], period: selectedPeriod })
          : []

        const tuweiReports = reportTypes.includes('tuwei')
          ? await fetchBizReport({ periodType, reportTypes: ['tuwei'], period: selectedPeriod })
          : []

        const monthlyPlans = await fetchMonthlyPlan()
        const aggregated = aggregateByNode(foneReports, tuweiReports, monthlyPlans)
        setNodes(aggregated)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (selectedPeriod) {
      loadData()
    }
  }, [periodType, reportType, selectedPeriod])

  // ... rest of component with filter UI and conditional view rendering
}
```

**Expected Deliverable**: Fully integrated page with all filters and view modes

---

### Step 9: Update IntegratedComparisonTable
**File**: `app/src/components/BizData/IntegratedComparisonTable.tsx`
**Action**: Add support for reportType prop to conditionally show columns

```typescript
interface IntegratedComparisonTableProps {
  nodes: EnrichedBizDataNode[]
  allNodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei' | 'comparison'
}

export function IntegratedComparisonTable({ nodes, allNodes, reportType }: IntegratedComparisonTableProps) {
  // Conditionally render columns based on reportType
  const showFone = reportType === 'fone' || reportType === 'comparison'
  const showTuwei = reportType === 'tuwei' || reportType === 'comparison'

  // ... update column definitions to conditionally include fone/tuwei columns
}
```

**Expected Deliverable**: Table that adapts to selected report type

---

### Step 10: Add Filter Controls UI
**File**: `app/src/pages/BizData.tsx`
**Action**: Add filter bar with all controls

```typescript
return (
  <>
    <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" subtitle="2025学年 · 单位：万元" />

    {/* Filter Bar */}
    <div className="flex items-center justify-between mb-6 gap-4">
      <div className="flex items-center gap-4">
        <ReportTypeToggle value={reportType} onChange={setReportType} />
        <PeriodSelector
          value={selectedPeriod}
          options={availablePeriods}
          onChange={(period, type) => {
            setSelectedPeriod(period)
            setPeriodType(type)
          }}
        />
      </div>
    </div>

    {/* View Mode Tabs */}
    <ViewModeTabs value={viewMode} onChange={setViewMode} />

    {/* Conditional View Rendering */}
    {loading ? (
      <LoadingSpinner />
    ) : viewMode === 'table' ? (
      <IntegratedComparisonTable
        nodes={tree.level1}
        allNodes={nodes}
        reportType={reportType}
      />
    ) : (
      <ChartView nodes={nodes} reportType={reportType} />
    )}

    {/* Smart Insights (keep existing) */}
    {insights.length > 0 && <InsightsSection insights={insights} />}
  </>
)
```

**Expected Deliverable**: Complete filter UI with all controls

---

## Key Files to Modify

| File | Operation | Description |
|------|-----------|-------------|
| app/src/services/bizDataService.ts:25-74 | Modify | Update fetchBizReport to JOIN with edu_org_hierarchy |
| app/src/services/bizDataService.ts:158-245 | Modify | Update aggregateByNode to preserve orgHierarchy |
| app/src/services/bizDataService.ts:280-334 | Modify | Refactor buildHierarchyTree to use orgHierarchy levels |
| app/src/services/bizDataService.ts:339-372 | Modify | Update getChildren to traverse orgHierarchy |
| app/src/lib/supabase.ts:58-82 | Modify | Extend EduBizReport with hierarchy field |
| app/src/lib/supabase.ts:104-128 | Modify | Update BizDataNode or create EnrichedBizDataNode |
| app/src/components/BizData/ViewModeTabs.tsx | Create | New tab component for table/chart switching |
| app/src/components/BizData/ChartView.tsx | Create | New placeholder for chart visualization |
| app/src/pages/BizData.tsx:1-316 | Modify | Integrate filters, tabs, and conditional rendering |
| app/src/components/BizData/IntegratedComparisonTable.tsx:72-361 | Modify | Add reportType prop and conditional column rendering |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| **JOIN performance**: Joining edu_org_hierarchy might slow down queries | Use LEFT JOIN and ensure node_name is indexed in both tables. Monitor query performance. |
| **Data mismatch**: Some node_names in edu_biz_report might not exist in edu_org_hierarchy | Use LEFT JOIN (not INNER) to preserve all report data. Handle null hierarchy gracefully in UI. |
| **Period format inconsistency**: fone uses "<202603", tuwei uses "202601-202602-" | Don't filter by period in query when reportType is 'comparison'. Let service layer handle both formats. |
| **State management complexity**: Multiple filters create complex state dependencies | Use useEffect with proper dependency arrays. Consider useMemo for derived state. |
| **Type safety**: Extending types might break existing code | Create new EnrichedBizDataNode type instead of modifying BizDataNode. Gradual migration. |

---

## Testing Strategy

1. **Unit Tests** (Optional but recommended)
   - Test `aggregateByNode` with mock data
   - Test `buildHierarchyTree` with various hierarchy structures
   - Test `getChildren` parent-child relationships

2. **Integration Tests**
   - Test filter combinations (fone+cumulative, tuwei+monthly, etc.)
   - Test view mode switching (table ↔ chart)
   - Test hierarchy expansion/collapse

3. **Manual Testing Checklist**
   - [ ] Load page with default filters
   - [ ] Switch between fone/tuwei/comparison modes
   - [ ] Switch between cumulative/monthly periods
   - [ ] Expand/collapse hierarchy levels
   - [ ] Switch to chart view (should show placeholder)
   - [ ] Verify data accuracy against database
   - [ ] Test with missing hierarchy data (null levels)
   - [ ] Test performance with full dataset (9,699 rows)

---

## Future Enhancements (Out of Scope)

1. **Chart Visualization**
   - Implement actual charts using Recharts or Chart.js
   - Support multiple chart types (bar, line, pie)
   - Interactive chart tooltips and legends

2. **Advanced Filtering**
   - Filter by specific level_1/level_2/level_3 values
   - Multi-select metric categories
   - Date range picker for custom periods

3. **Export Functionality**
   - Export table to Excel
   - Export chart as PNG/PDF
   - Scheduled report generation

4. **Performance Optimization**
   - Implement virtual scrolling for large tables
   - Add data caching layer
   - Lazy load hierarchy levels

---

## Estimated Complexity

- **Backend Changes**: Medium (query modification, type updates)
- **Frontend Changes**: Medium-High (multiple component updates, state management)
- **Overall Complexity**: Medium
- **Estimated Time**: 4-6 hours for experienced developer

---

## Notes

- The existing components (ReportTypeToggle, PeriodSelector, ComparisonTabs) are already created but not integrated into the main page
- The current IntegratedComparisonTable already has good hierarchy support via TanStack Table
- The main work is connecting edu_org_hierarchy data and adding the filter UI
- Chart view is intentionally left as a placeholder for future implementation
- Consider adding loading states and error boundaries for better UX

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)

**Note**: External model analysis was attempted but the codeagent-wrapper tool is not available in this environment. This plan is based on Claude's direct analysis of the codebase and requirements.
