// 组织节点定位 Tool — 在组织范围不清晰时使用

import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

interface OrgRow {
  node_name: string
  level_0: string | null
  level_1: string | null
  level_2: string | null
}

function inferCanonicalScope(rows: OrgRow[]) {
  const level0Values = new Set(rows.map(row => row.level_0).filter(Boolean))
  const level1Values = new Set(rows.map(row => row.level_1).filter(Boolean))
  const level2Values = new Set(rows.map(row => row.level_2).filter(Boolean))

  return {
    level_0: level0Values.size === 1 ? [...level0Values][0] : null,
    level_1: level1Values.size === 1 ? [...level1Values][0] : null,
    level_2: level2Values.size === 1 ? [...level2Values][0] : null,
  }
}

export const resolveOrgNodesTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'resolve_org_nodes',
      description: '当用户给出的组织名称存在歧义时，定位匹配的组织节点或层级范围。支持按 level_0、level_1、level_2、node_name 或任意层级模糊匹配，返回候选节点、分组汇总和建议过滤方式。',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '组织名称关键词，支持模糊匹配，如“广州餐饮”“物业”“深圳”“餐饮中心”等。',
          },
          level: {
            type: 'string',
            description: '指定在哪个层级匹配：level_0、level_1、level_2、node_name，或 any（默认）。',
            enum: ['level_0', 'level_1', 'level_2', 'node_name', 'any'],
          },
        },
        required: ['keyword'],
      },
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const keyword = args.keyword as string
    const level = (args.level as string) || 'any'

    if (!keyword || keyword.trim() === '') {
      return JSON.stringify({ error: '请提供组织名称关键词' })
    }

    const { data, error } = await supabase
      .from('edu_org_hierarchy')
      .select('node_name, level_0, level_1, level_2')
      .or(
        level === 'any'
          ? `level_0.ilike.%${keyword}%,level_1.ilike.%${keyword}%,level_2.ilike.%${keyword}%,node_name.ilike.%${keyword}%`
          : level === 'level_0'
            ? `level_0.ilike.%${keyword}%`
            : level === 'level_1'
              ? `level_1.ilike.%${keyword}%`
              : level === 'level_2'
                ? `level_2.ilike.%${keyword}%`
                : `node_name.ilike.%${keyword}%`,
      )
      .order('node_name')
      .limit(100)

    if (error) {
      throw new Error(`组织节点查询失败: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        message: `未找到匹配“${keyword}”的组织节点`,
        suggestion: '请尝试更短的关键词，如“餐饮”“物业”“广州”等。',
      })
    }

    const rows = data as OrgRow[]
    const groupedMap = new Map<string, { level_0: string | null; level_2s: Set<string>; count: number }>()
    for (const row of rows) {
      const groupKey = row.level_1 || '未分类'
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, { level_0: row.level_0, level_2s: new Set(), count: 0 })
      }
      const group = groupedMap.get(groupKey)!
      if (row.level_2) group.level_2s.add(row.level_2)
      group.count += 1
    }

    const groupedSummary = Array.from(groupedMap.entries()).map(([level1, group]) => ({
      level_0: group.level_0,
      level_1: level1,
      level_2_list: [...group.level_2s],
      node_count: group.count,
    }))

    const canonicalScope = inferCanonicalScope(rows)

    return JSON.stringify({
      keyword,
      match_count: rows.length,
      suggested_filter_mode: rows.length === 1 ? 'node_name' : canonicalScope.level_2 ? 'level_2' : canonicalScope.level_1 ? 'level_1' : 'node_name',
      canonical_scope: canonicalScope,
      top_matches: rows.slice(0, 8).map(row => ({
        node_name: row.node_name,
        level_0: row.level_0,
        level_1: row.level_1,
        level_2: row.level_2,
      })),
      grouped_summary: groupedSummary,
      guidance: rows.length === 1
        ? '可直接使用该 node_name 查询经营数据。'
        : '若匹配较多，优先使用 level_1 或 level_2 过滤；如需精确查询，再使用具体 node_name。',
    }, null, 2)
  },
}
