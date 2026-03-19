// 组织节点定位 Tool — 先定位组织，再查经营数据

import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

export const resolveOrgNodesTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'resolve_org_nodes',
      description: '根据用户描述的组织名称，从组织层级表中定位匹配的业务节点。在查询经营数据之前，必须先调用此工具确定要查询哪些节点。支持按任意层级关键词模糊匹配（如"广州餐饮"、"物业中心"、"集团"、"深圳"等）。返回匹配节点的名称列表及其层级归属，供后续经营数据查询使用。',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '组织名称关键词，支持模糊匹配。如"广州餐饮"、"物业"、"深圳"、"集团"、"餐饮中心"等。',
          },
          level: {
            type: 'string',
            description: '指定在哪个层级匹配：level_0（集团级，如智汇后勤集团）、level_1（中心级，如餐饮中心）、level_2（板块/区域级，如广州餐饮）、level_3（项目级）、node_name（末级节点）、any（任意层级，默认）',
            enum: ['level_0', 'level_1', 'level_2', 'level_3', 'node_name', 'any'],
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
      .select('node_name, level_0, level_1, level_2, level_3, label')
      .or(
        level === 'any'
          ? `level_0.ilike.%${keyword}%,level_1.ilike.%${keyword}%,level_2.ilike.%${keyword}%,level_3.ilike.%${keyword}%,node_name.ilike.%${keyword}%`
          : level === 'level_0'
            ? `level_0.ilike.%${keyword}%`
            : level === 'level_1'
              ? `level_1.ilike.%${keyword}%`
              : level === 'level_2'
                ? `level_2.ilike.%${keyword}%`
                : level === 'level_3'
                  ? `level_3.ilike.%${keyword}%`
                  : `node_name.ilike.%${keyword}%`,
      )
      .order('node_name')
      .limit(100)

    if (error) {
      throw new Error(`组织节点查询失败: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        message: `未找到匹配"${keyword}"的组织节点`,
        suggestion: '请尝试更短的关键词，如只输入"餐饮"、"物业"、"广州"等',
      })
    }

    // Group by level_0 + level_1 for summary
    const byLevel1 = new Map<string, { level_0: string | null; level_2s: Set<string>; nodes: string[] }>()
    for (const row of data) {
      const l1 = row.level_1 || '未分类'
      if (!byLevel1.has(l1)) {
        byLevel1.set(l1, { level_0: row.level_0, level_2s: new Set(), nodes: [] })
      }
      const group = byLevel1.get(l1)!
      if (row.level_2) group.level_2s.add(row.level_2)
      group.nodes.push(row.node_name)
    }

    const grouped = Array.from(byLevel1.entries()).map(([l1, g]) => ({
      集团: g.level_0,
      一级组织: l1,
      二级组织列表: Array.from(g.level_2s),
      节点列表: g.nodes,
      节点数量: g.nodes.length,
    }))

    return JSON.stringify({
      匹配关键词: keyword,
      总节点数: data.length,
      分组汇总: grouped,
      全部节点名称: data.map(r => r.node_name),
      使用说明: '请将上述"节点列表"中的名称用于 query_with_hierarchy 的 node_name 参数（精确匹配），或使用 level_1/level_2 参数按层级过滤',
    }, null, 2)
  },
}
