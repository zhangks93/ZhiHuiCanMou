import type { EduBizReport, EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import {
  aggregateByNode,
  buildOrgPath,
  buildOrgScopeKey,
  buildTreeWithAggregation,
  fetchBizReport,
  findHierarchyNodeByScopeKey,
  findHierarchyNodeMatches,
  getChildren,
  getNodeKind,
} from '@/features/biz-data/services/bizDataService'
import { DEFAULT_REPORT_METRICS } from '../reportCalculations'
import type { ReportType } from '../reportPackTypes'
import { FALLBACK_METRIC_LABELS } from './packConstants'

export function buildMetricLabelMap(reports: EduBizReport[]): Map<MetricCategory, string> {
  const labelMap = new Map<MetricCategory, string>()
  DEFAULT_REPORT_METRICS.forEach(metric => labelMap.set(metric, FALLBACK_METRIC_LABELS[metric]))
  reports.forEach(report => {
    if (!labelMap.has(report.metric_category)) {
      labelMap.set(report.metric_category, report.metric_category_cn)
    }
  })
  return labelMap
}

export function aggregateReportNodes(reports: EduBizReport[]): EnrichedBizDataNode[] {
  const foneReports = reports.filter(row => row.report_type === 'fone')
  const tuweiReports = reports.filter(row => row.report_type === 'tuwei')
  return aggregateByNode(foneReports, tuweiReports, [])
}

export function resolveRootNode(nodes: EnrichedBizDataNode[], nodeName: string, orgScopeKey?: string):
  | { ok: true; root: EnrichedBizDataNode | null; allNodes: EnrichedBizDataNode[] }
  | { ok: false; message: string; candidates?: unknown[] } {
  if (!nodes.length) return { ok: true, root: null, allNodes: [] }

  const allNodes = buildTreeWithAggregation(nodes)
  if (orgScopeKey) {
    const scopedRoot = findHierarchyNodeByScopeKey(nodes, orgScopeKey)
    if (!scopedRoot) return { ok: false, message: '未找到匹配 org_scope_key 的组织节点' }
    return {
      ok: true,
      root: allNodes.find(node => buildOrgScopeKey(node) === buildOrgScopeKey(scopedRoot)) ?? scopedRoot,
      allNodes,
    }
  }

  if (!nodeName.trim()) {
    const root = allNodes.find(node => getNodeKind(node) === 'total') ?? allNodes[0] ?? null
    return { ok: true, root, allNodes }
  }

  const matches = findHierarchyNodeMatches(nodes, nodeName)
  if (matches.length === 0) {
    return { ok: false, message: '未找到匹配的组织节点' }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      message: '匹配到多个组织节点，请提供更精确的 node_name',
      candidates: matches.slice(0, 20).map(match => ({
        node_name: match.node.node_name,
        org_scope_key: buildOrgScopeKey(match.node),
        org_path: buildOrgPath(match.node),
        node_kind: getNodeKind(match.node),
        match_type: match.matchType,
        org_hierarchy: match.node.orgHierarchy,
      })),
    }
  }

  const matchedName = matches[0].node.node_name
  return {
    ok: true,
    root: allNodes.find(node => node.node_name === matchedName) ?? matches[0].node,
    allNodes,
  }
}

export function flattenSubtree(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  if (!root) return []
  const result: EnrichedBizDataNode[] = []
  const visit = (node: EnrichedBizDataNode) => {
    result.push(node)
    getChildren(node, allNodes).forEach(visit)
  }
  visit(root)
  return result
}

export function collectSubtreeWithDepth(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], maxDepth?: number): Array<{
  node: EnrichedBizDataNode
  depth: number
}> {
  if (!root) return []
  const result: Array<{ node: EnrichedBizDataNode; depth: number }> = []
  const visit = (node: EnrichedBizDataNode, depth: number) => {
    if (maxDepth !== undefined && depth > maxDepth) return
    result.push({ node, depth })
    getChildren(node, allNodes).forEach(child => visit(child, depth + 1))
  }
  visit(root, 0)
  return result
}

export function findNodeByName(nodes: EnrichedBizDataNode[], nodeName: string): EnrichedBizDataNode | null {
  return nodes.find(node => node.node_name === nodeName) ?? null
}

export async function fetchReportPeriodSlices(params: {
  month: string
  previousMonth: string
  cumulativeToMonthPeriod: string
  schoolYearTargetPeriod: string
  reportTypes: ReportType[]
}): Promise<{
  monthReports: EduBizReport[]
  previousReports: EduBizReport[]
  cumulativeToMonthReports: EduBizReport[]
  schoolYearTargetReports: EduBizReport[]
}> {
  const [monthReports, previousReports, cumulativeToMonthReports, schoolYearTargetReports] = await Promise.all([
    fetchBizReport({ period: params.month, periodType: 'monthly', reportTypes: params.reportTypes }),
    fetchBizReport({ period: params.previousMonth, periodType: 'monthly', reportTypes: params.reportTypes }),
    fetchBizReport({ period: params.cumulativeToMonthPeriod, periodType: 'cumulative', reportTypes: params.reportTypes }),
    fetchBizReport({ period: params.schoolYearTargetPeriod, periodType: 'cumulative', reportTypes: params.reportTypes }),
  ])
  return { monthReports, previousReports, cumulativeToMonthReports, schoolYearTargetReports }
}
