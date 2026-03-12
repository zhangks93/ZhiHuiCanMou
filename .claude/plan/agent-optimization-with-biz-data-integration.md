# Implementation Plan: Agent System Optimization with Business Data Integration

## Task Type
- [x] Backend (→ Codex)
- [ ] Frontend (→ Gemini)
- [x] Fullstack (→ Parallel)

## Technical Solution

Based on analysis of the current Agent system and business data query logic, the optimization will focus on:

1. **Hierarchical Data Query Integration**: The current `query_biz_data` tool already implements hierarchical aggregation logic in `tools.ts` (lines 414-540), but the Agent prompt and tool execution need better alignment with the `bizDataService.ts` patterns used in the UI layer.

2. **Service Layer Consistency**: The UI uses `bizDataService.ts` with functions like `buildTreeWithAggregation()`, `getChildren()`, and `aggregateByNode()`, while the Agent tool has its own implementation in `buildHierarchyAggregation()`. These should be unified.

3. **Query Optimization**: The Agent should leverage the same efficient query patterns as the business data page, including:
   - Automatic hierarchy enrichment with `edu_org_hierarchy` table
   - Multi-level aggregation (level_1, level_2, level_3, leaf nodes)
   - Proper handling of fone/tuwei report type merging
   - Pagination for large datasets

## Implementation Steps

### Step 1: Refactor Agent Tool to Use Shared Service Layer
**Deliverable**: Unified business data query logic

**Changes**:
- Modify `app/src/lib/agent/tools.ts` `queryBizData()` function (lines 266-412)
- Import and use `fetchBizReport()`, `aggregateByNode()`, and `buildTreeWithAggregation()` from `bizDataService.ts`
- Remove duplicate aggregation logic in `buildHierarchyAggregation()` (lines 414-540)
- Ensure the tool returns the same enriched data structure as the UI

**Pseudo-code**:
```typescript
// In tools.ts
import {
  fetchBizReport,
  aggregateByNode,
  buildTreeWithAggregation,
  fetchMonthlyPlan
} from '@/services/bizDataService'

async function queryBizData(args: Args): Promise<string> {
  const includeHierarchy = args.include_hierarchy !== 'false'

  // Use shared service layer
  const options = {
    period: coerceString(args.period),
    periodType: (coerceString(args.period_type) || 'cumulative') as 'cumulative' | 'monthly',
    reportTypes: args.report_type ? [args.report_type as 'fone' | 'tuwei'] : ['fone', 'tuwei'],
    sheetCodes: args.sheet_code ? [coerceString(args.sheet_code)] : undefined,
  }

  // Fetch data using shared service
  const reportData = await fetchBizReport(options)

  // Apply filters (node_name, metric_category)
  let filteredData = reportData
  if (args.node_name) {
    filteredData = filteredData.filter(r =>
      r.node_name.includes(coerceString(args.node_name))
    )
  }
  if (args.metric_category) {
    filteredData = filteredData.filter(r =>
      r.metric_category === coerceString(args.metric_category)
    )
  }

  // If hierarchy not requested, return raw data
  if (!includeHierarchy) {
    return JSON.stringify({ total: filteredData.length, data: filteredData })
  }

  // Aggregate by node (merge fone/tuwei)
  const foneData = filteredData.filter(r => r.report_type === 'fone')
  const tuweiData = filteredData.filter(r => r.report_type === 'tuwei')
  const monthlyPlan = await fetchMonthlyPlan() // Optional

  const nodes = aggregateByNode(foneData, tuweiData, monthlyPlan)

  // Build hierarchy with aggregation
  const allNodes = buildTreeWithAggregation(nodes)

  // Transform to Agent-friendly format with aggregation metadata
  const enrichedNodes = allNodes.map(node => ({
    node_name: node.node_name,
    org_hierarchy: node.orgHierarchy,
    is_aggregated: isAggregatedNode(node),
    aggregation_level: getAggregationLevel(node),
    metrics: node.metrics,
    sort_order: node.sort_order,
  }))

  return JSON.stringify({
    summary: {
      total_nodes: enrichedNodes.length,
      leaf_nodes: enrichedNodes.filter(n => !n.is_aggregated).length,
      level_1_nodes: enrichedNodes.filter(n => n.aggregation_level === 'level_1').length,
      level_2_nodes: enrichedNodes.filter(n => n.aggregation_level === 'level_2').length,
      level_3_nodes: enrichedNodes.filter(n => n.aggregation_level === 'level_3').length,
    },
    data: enrichedNodes,
  })
}

// Helper functions
function isAggregatedNode(node: EnrichedBizDataNode): boolean {
  const { level_1, level_2, level_3 } = node.orgHierarchy
  return (
    (level_1 && !level_2 && !level_3 && node.node_name === level_1) ||
    (level_1 && level_2 && !level_3 && node.node_name === level_2) ||
    (level_1 && level_2 && level_3 && node.node_name === level_3)
  )
}

function getAggregationLevel(node: EnrichedBizDataNode): string | null {
  if (!isAggregatedNode(node)) return null
  const { level_1, level_2, level_3 } = node.orgHierarchy
  if (level_1 && !level_2 && !level_3) return 'level_1'
  if (level_1 && level_2 && !level_3) return 'level_2'
  if (level_1 && level_2 && level_3) return 'level_3'
  return null
}
```

### Step 2: Update Agent System Prompt for Hierarchical Query Patterns
**Deliverable**: Enhanced prompt with clear hierarchical query guidance

**Changes**:
- Update `app/src/lib/agent/prompt.ts` (lines 1-283)
- Add concrete query examples showing how to leverage hierarchical data
- Clarify when to use `include_hierarchy=true` (default) vs `false`
- Add guidance on filtering by `aggregation_level` in the returned data

**Pseudo-code**:
```typescript
// In prompt.ts - Add to "数据查询最佳实践" section (around line 48)

**层级查询模式（重要）：**

1. **全景分析模式**（推荐用于首次查询）
   - 不传任何筛选条件，获取完整层级树
   - 返回数据包含 level_1/level_2/level_3 聚合节点 + 叶子节点
   - 示例：`query_biz_data({ period_type: "cumulative", metric_category: "revenue" })`
   - 返回结构：
     ```json
     {
       "summary": { "total_nodes": 200, "level_1_nodes": 5, "level_2_nodes": 20, "level_3_nodes": 50, "leaf_nodes": 125 },
       "data": [
         { "node_name": "后勤管理中心", "is_aggregated": true, "aggregation_level": "level_1", "metrics": {...} },
         { "node_name": "教育园特色餐饮", "is_aggregated": true, "aggregation_level": "level_2", "metrics": {...} },
         { "node_name": "具体业务单元", "is_aggregated": false, "aggregation_level": null, "metrics": {...} }
       ]
     }
     ```

2. **层级钻取模式**（用于下钻分析）
   - 先查询 level_1 聚合节点，识别问题中心
   - 再通过 `node_name` 参数筛选该中心的下级节点
   - 示例：
     - 第一步：`query_biz_data({ metric_category: "revenue" })` → 发现"后勤管理中心"营收偏低
     - 第二步：`query_biz_data({ metric_category: "revenue", node_name: "后勤管理中心" })` → 获取该中心所有下级节点

3. **指标聚焦模式**（用于单一指标深度分析）
   - 传 `metric_category` 参数，获取特定指标的完整层级树
   - 减少数据量，提高查询效率
   - 示例：`query_biz_data({ metric_category: "pretax_profit", period_type: "cumulative" })`

4. **版本对比模式**（用于预算达成率分析）
   - 不传 `report_type`，自动返回 fone 和 tuwei 合并数据
   - 每个节点包含 `budget_fone`, `budget_tuwei`, `completion_fone`, `completion_tuwei`
   - 可直接对比年初预算与考核目标的达成情况

**数据处理技巧：**
- 筛选特定层级：根据 `aggregation_level` 字段过滤（"level_1" / "level_2" / "level_3" / null）
- 识别聚合节点：`is_aggregated === true` 表示该节点是聚合计算的结果
- 追踪层级关系：通过 `org_hierarchy` 字段的 `level_1`, `level_2`, `level_3` 追踪父子关系
- 指标访问：`metrics[metric_category]` 包含 `actual`, `budget_fone`, `budget_tuwei`, `completion_fone`, `completion_tuwei`, `diff_fone`, `diff_tuwei`, `yoy`
```

### Step 3: Add Helper Functions for Data Transformation
**Deliverable**: Utility functions for Agent-specific data formatting

**Changes**:
- Add new file `app/src/lib/agent/dataTransform.ts`
- Implement functions to convert `EnrichedBizDataNode` to Agent-friendly format
- Add functions to flatten hierarchical data for LLM consumption

**Pseudo-code**:
```typescript
// New file: app/src/lib/agent/dataTransform.ts
import type { EnrichedBizDataNode, MetricCategory } from '@/lib/supabase'

export interface AgentBizDataNode {
  node_name: string
  org_hierarchy: {
    level_1: string | null
    level_2: string | null
    level_3: string | null
    label: string | null
  }
  is_aggregated: boolean
  aggregation_level: 'level_1' | 'level_2' | 'level_3' | null
  metrics: Record<string, {
    actual: number | null
    budget_fone: number | null
    budget_tuwei: number | null
    completion_fone: number | null
    completion_tuwei: number | null
    diff_fone: number | null
    diff_tuwei: number | null
    yoy: number | null
  }>
  sort_order: number
}

export function toAgentFormat(nodes: EnrichedBizDataNode[]): AgentBizDataNode[] {
  return nodes.map(node => ({
    node_name: node.node_name,
    org_hierarchy: node.orgHierarchy,
    is_aggregated: isAggregatedNode(node),
    aggregation_level: getAggregationLevel(node),
    metrics: node.metrics,
    sort_order: node.sort_order,
  }))
}

export function isAggregatedNode(node: EnrichedBizDataNode): boolean {
  const { level_1, level_2, level_3 } = node.orgHierarchy
  return (
    (level_1 && !level_2 && !level_3 && node.node_name === level_1) ||
    (level_1 && level_2 && !level_3 && node.node_name === level_2) ||
    (level_1 && level_2 && level_3 && node.node_name === level_3)
  )
}

export function getAggregationLevel(node: EnrichedBizDataNode): 'level_1' | 'level_2' | 'level_3' | null {
  if (!isAggregatedNode(node)) return null
  const { level_1, level_2, level_3 } = node.orgHierarchy
  if (level_1 && !level_2 && !level_3) return 'level_1'
  if (level_1 && level_2 && !level_3) return 'level_2'
  if (level_1 && level_2 && level_3) return 'level_3'
  return null
}

export function flattenMetricsForLLM(
  nodes: AgentBizDataNode[],
  metricCategory: MetricCategory
): string {
  // Create a compact text representation for LLM consumption
  const lines: string[] = []

  nodes.forEach(node => {
    const metric = node.metrics[metricCategory]
    if (!metric) return

    const level = node.aggregation_level || 'leaf'
    const actual = metric.actual?.toFixed(2) || 'N/A'
    const budgetFone = metric.budget_fone?.toFixed(2) || 'N/A'
    const completionFone = metric.completion_fone
      ? `${(metric.completion_fone * 100).toFixed(1)}%`
      : 'N/A'

    lines.push(
      `[${level}] ${node.node_name}: 实际=${actual}, 预算=${budgetFone}, 达成率=${completionFone}`
    )
  })

  return lines.join('\n')
}
```

### Step 4: Update Tool Definition with Enhanced Description
**Deliverable**: Clearer tool documentation for LLM

**Changes**:
- Update `TOOL_DEFINITIONS` in `app/src/lib/agent/tools.ts` (lines 6-22)
- Add explicit examples of query patterns
- Clarify the return data structure

**Pseudo-code**:
```typescript
// In tools.ts - Update query_biz_data definition
{
  name: 'query_biz_data',
  description: `查询教育后勤经营数据（edu_biz_report: 11,477条）。

**核心特性：默认自动返回完整层级聚合数据**
- 一次查询获取 level_1（5个中心）/level_2（约20个板块）/level_3（约50个单元）聚合节点 + 叶子节点（153个）
- 每个节点包含 org_hierarchy（level_1/level_2/level_3/label）和聚合标识（is_aggregated, aggregation_level）
- 支持25个指标类别（营收、利润、成本、人效等）
- 自动合并 fone（年初预算）和 tuwei（考核目标）两个版本

**返回数据结构：**
{
  "summary": {
    "total_nodes": 200,
    "leaf_nodes": 125,
    "level_1_nodes": 5,
    "level_2_nodes": 20,
    "level_3_nodes": 50
  },
  "data": [
    {
      "node_name": "后勤管理中心",
      "is_aggregated": true,
      "aggregation_level": "level_1",
      "org_hierarchy": { "level_1": "后勤管理中心", "level_2": null, "level_3": null, "label": "中心餐饮业务" },
      "metrics": {
        "revenue": {
          "actual": 50000,
          "budget_fone": 48000,
          "budget_tuwei": 52000,
          "completion_fone": 1.04,
          "completion_tuwei": 0.96,
          "diff_fone": 2000,
          "diff_tuwei": -2000,
          "yoy": 45000
        }
      }
    }
  ]
}

**查询模式：**
1. 全景分析：不传筛选条件，获取所有层级完整数据
2. 指标聚焦：传 metric_category，获取特定指标的层级树
3. 层级钻取：传 node_name，获取特定中心/板块的下级节点
4. 版本对比：不传 report_type，自动返回 fone 和 tuwei 合并数据

**使用建议：**
- 首次查询：传 metric_category 聚焦关键指标（如 revenue, pretax_profit）
- 下钻分析：根据 aggregation_level 筛选特定层级，再通过 node_name 钻取
- 数据量控制：传 metric_category 参数可大幅减少返回数据量`,
  parameters: {
    // ... existing parameters
  }
}
```

### Step 5: Add Integration Tests
**Deliverable**: Test coverage for hierarchical query logic

**Changes**:
- Create test file `app/src/lib/agent/__tests__/tools.test.ts`
- Test `queryBizData()` with various parameter combinations
- Verify hierarchy aggregation correctness
- Test data transformation functions

**Pseudo-code**:
```typescript
// New file: app/src/lib/agent/__tests__/tools.test.ts
import { describe, it, expect, vi } from 'vitest'
import { queryBizData } from '../tools'
import * as bizDataService from '@/services/bizDataService'

describe('queryBizData', () => {
  it('should return hierarchical data by default', async () => {
    // Mock service layer
    vi.spyOn(bizDataService, 'fetchBizReport').mockResolvedValue([...])
    vi.spyOn(bizDataService, 'aggregateByNode').mockReturnValue([...])
    vi.spyOn(bizDataService, 'buildTreeWithAggregation').mockReturnValue([...])

    const result = await queryBizData({ metric_category: 'revenue' })
    const parsed = JSON.parse(result)

    expect(parsed.summary).toBeDefined()
    expect(parsed.summary.level_1_nodes).toBeGreaterThan(0)
    expect(parsed.data).toBeInstanceOf(Array)
    expect(parsed.data[0]).toHaveProperty('is_aggregated')
    expect(parsed.data[0]).toHaveProperty('aggregation_level')
  })

  it('should return raw data when include_hierarchy is false', async () => {
    vi.spyOn(bizDataService, 'fetchBizReport').mockResolvedValue([...])

    const result = await queryBizData({
      metric_category: 'revenue',
      include_hierarchy: 'false'
    })
    const parsed = JSON.parse(result)

    expect(parsed.data[0]).not.toHaveProperty('is_aggregated')
  })

  it('should filter by node_name', async () => {
    // Test node_name filtering logic
  })

  it('should merge fone and tuwei data correctly', async () => {
    // Test fone/tuwei merging logic
  })
})
```

### Step 6: Update Agent Memory to Store Hierarchical Insights
**Deliverable**: Enhanced memory system for hierarchical analysis

**Changes**:
- Update `app/src/lib/agent/memory.ts` to support hierarchical context
- Add metadata fields for storing aggregation level and org hierarchy
- Implement memory retrieval that considers hierarchical relationships

**Pseudo-code**:
```typescript
// In memory.ts - Enhance AgentMemory interface
export interface AgentMemory {
  id: string
  content: string
  category: 'insight' | 'conclusion' | 'anomaly' | 'trend'
  keywords: string[]
  sessionId: string
  createdAt: number
  // New fields for hierarchical context
  metadata?: {
    node_name?: string
    aggregation_level?: 'level_1' | 'level_2' | 'level_3' | null
    org_hierarchy?: {
      level_1?: string
      level_2?: string
      level_3?: string
    }
    metric_category?: string
    period?: string
  }
}

// Enhanced search that considers hierarchy
export function searchMemoriesWithHierarchy(
  query: string,
  hierarchyContext?: { level_1?: string; level_2?: string; level_3?: string }
): AgentMemory[] {
  const baseResults = searchMemories(query)

  if (!hierarchyContext) return baseResults

  // Boost results that match the hierarchical context
  return baseResults.sort((a, b) => {
    const aScore = calculateHierarchyScore(a, hierarchyContext)
    const bScore = calculateHierarchyScore(b, hierarchyContext)
    return bScore - aScore
  })
}

function calculateHierarchyScore(
  memory: AgentMemory,
  context: { level_1?: string; level_2?: string; level_3?: string }
): number {
  let score = 0
  const memHierarchy = memory.metadata?.org_hierarchy

  if (!memHierarchy) return score

  if (context.level_1 && memHierarchy.level_1 === context.level_1) score += 3
  if (context.level_2 && memHierarchy.level_2 === context.level_2) score += 2
  if (context.level_3 && memHierarchy.level_3 === context.level_3) score += 1

  return score
}
```

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| app/src/lib/agent/tools.ts:266-540 | Modify | Refactor queryBizData to use shared service layer, remove duplicate aggregation logic |
| app/src/lib/agent/prompt.ts:48-160 | Modify | Add hierarchical query patterns and examples |
| app/src/lib/agent/dataTransform.ts | Create | New utility file for Agent-specific data transformation |
| app/src/lib/agent/tools.ts:6-22 | Modify | Update query_biz_data tool definition with enhanced description |
| app/src/lib/agent/__tests__/tools.test.ts | Create | Integration tests for hierarchical query logic |
| app/src/lib/agent/memory.ts | Modify | Enhance memory system with hierarchical context support |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing Agent queries | Add comprehensive tests before refactoring; maintain backward compatibility by keeping `include_hierarchy` parameter |
| Performance degradation with large datasets | Leverage existing pagination logic in bizDataService; add query result caching |
| Data structure mismatch between UI and Agent | Use shared TypeScript types from `@/lib/supabase`; create transformation layer in `dataTransform.ts` |
| LLM confusion with complex hierarchical data | Provide clear examples in prompt; implement `flattenMetricsForLLM()` helper for compact representation |
| Memory system overhead | Implement lazy loading for hierarchy metadata; add memory cleanup for old sessions |

## Testing Strategy

1. **Unit Tests**: Test individual transformation functions (`isAggregatedNode`, `getAggregationLevel`, `toAgentFormat`)
2. **Integration Tests**: Test `queryBizData()` with various parameter combinations against real Supabase data
3. **End-to-End Tests**: Test Agent responses to hierarchical queries in the UI
4. **Performance Tests**: Measure query time with/without hierarchy aggregation for large datasets
5. **Regression Tests**: Ensure existing Agent queries still work after refactoring

## Success Criteria

1. Agent can query and analyze hierarchical business data in a single call
2. Query response time < 3 seconds for typical hierarchical queries
3. Agent correctly identifies and drills down from level_1 → level_2 → level_3 → leaf nodes
4. Memory system stores and retrieves hierarchical context
5. All existing Agent functionality remains intact
6. Test coverage > 80% for new code

## SESSION_ID (for /ccg:execute use)

Since ace-tool MCP is not available and we're not using external model calls, no SESSION_ID is needed for this implementation.

---

**Implementation Notes:**
- This plan focuses on unifying the Agent's business data query logic with the proven patterns from the UI layer
- The key insight is that `bizDataService.ts` already implements robust hierarchical aggregation - we should reuse it rather than maintain duplicate logic
- The Agent prompt needs concrete examples of hierarchical query patterns to guide the LLM effectively
- Adding a transformation layer (`dataTransform.ts`) keeps the service layer clean while providing Agent-specific formatting
