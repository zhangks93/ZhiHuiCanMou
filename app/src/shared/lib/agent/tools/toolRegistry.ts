// Tool Registry - Maps tool names to RegisteredTool instances
// Skills reference tools by name in skill.json; this registry resolves them.

import type { RegisteredTool } from '../types'
import { resolveOrgNodesTool } from './resolveOrgNodes'
import { queryWithHierarchyTool } from './queryWithHierarchy'
import { queryBizDataTool } from './queryBizData'
import { readFileTool } from './readFile'
import {
  fetchMemorySourceTool,
  forgetMemoryTool,
  listMemoryNamespacesTool,
  recallMemoryTool,
  storeMemoryTool,
} from './memoryTools'
import {
  feishuAuthStatusTool,
  feishuCliHealthTool,
  feishuReadTool,
  feishuWriteConfirmTool,
  feishuWritePreviewTool,
} from './feishuTools'

/** All available tools indexed by function name */
const toolMap: Record<string, RegisteredTool> = {
  resolve_org_nodes: resolveOrgNodesTool,
  query_with_hierarchy: queryWithHierarchyTool,
  query_biz_data: queryBizDataTool,
  read_file: readFileTool,
  recall_memory: recallMemoryTool,
  store_memory: storeMemoryTool,
  forget_memory: forgetMemoryTool,
  list_memory_namespaces: listMemoryNamespacesTool,
  fetch_memory_source: fetchMemorySourceTool,
  feishu_cli_health: feishuCliHealthTool,
  feishu_auth_status: feishuAuthStatusTool,
  feishu_read: feishuReadTool,
  feishu_write_preview: feishuWritePreviewTool,
  feishu_write_confirm: feishuWriteConfirmTool,
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
