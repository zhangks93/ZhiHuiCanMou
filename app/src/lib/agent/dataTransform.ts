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

/**
 * Convert EnrichedBizDataNode to Agent-friendly format
 */
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

/**
 * Check if a node is an aggregated node (not a leaf node)
 */
export function isAggregatedNode(node: EnrichedBizDataNode): boolean {
  const { level_1, level_2, level_3 } = node.orgHierarchy
  const isAgg = (
    (level_1 && !level_2 && !level_3 && node.node_name === level_1) ||
    (level_1 && level_2 && !level_3 && node.node_name === level_2) ||
    (level_1 && level_2 && level_3 && node.node_name === level_3)
  )
  return !!isAgg
}

/**
 * Get the aggregation level of a node
 */
export function getAggregationLevel(node: EnrichedBizDataNode): 'level_1' | 'level_2' | 'level_3' | null {
  if (!isAggregatedNode(node)) return null
  const { level_1, level_2, level_3 } = node.orgHierarchy
  if (level_1 && !level_2 && !level_3) return 'level_1'
  if (level_1 && level_2 && !level_3) return 'level_2'
  if (level_1 && level_2 && level_3) return 'level_3'
  return null
}

/**
 * Flatten metrics for LLM consumption (compact text representation)
 */
export function flattenMetricsForLLM(
  nodes: AgentBizDataNode[],
  metricCategory: MetricCategory
): string {
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
