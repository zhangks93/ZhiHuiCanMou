// Tool Registry - Maps tool names to RegisteredTool instances
// Skills reference tools by name in skill.json; this registry resolves them.

import type { RegisteredTool } from '../types'
import { resolveOrgNodesTool } from './resolveOrgNodes'
import { queryWithHierarchyTool } from './queryWithHierarchy'
import { queryBusinessReportPackTool } from './queryBusinessReportPack'
import { queryMonthlyPlanTool } from './queryMonthlyPlan'
import { queryBizDataTool } from './queryBizData'
import { readFileTool } from './readFile'
import { auditBusinessReportTool } from './auditBusinessReport'

/** All available tools indexed by function name */
const toolMap: Record<string, RegisteredTool> = {
  resolve_org_nodes: resolveOrgNodesTool,
  query_with_hierarchy: queryWithHierarchyTool,
  query_business_report_pack: queryBusinessReportPackTool,
  query_monthly_plan: queryMonthlyPlanTool,
  query_biz_data: queryBizDataTool,
  audit_business_report: auditBusinessReportTool,
  read_file: readFileTool,
}

/**
 * Resolve tool names to RegisteredTool instances.
 * Throws if any tool name is not found.
 */
export function resolveTools(names: string[]): RegisteredTool[] {
  return names.map((name) => {
    const tool = toolMap[name]
    if (!tool) {
      throw new Error(
        `Unknown tool "${name}". Available tools: ${Object.keys(toolMap).join(', ')}`
      )
    }
    return tool
  })
}

/** Get all available tool names */
export function getAvailableToolNames(): string[] {
  return Object.keys(toolMap)
}
