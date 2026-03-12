// Business Analysis Skill - 经营数据分析

import { Skill, type SkillParameter, type SkillResult, type SkillContext } from '../../agent/types'
import {
  fetchBizReport,
  fetchMonthlyPlan,
  aggregateByNode,
  buildHierarchyTree,
} from '@/services/bizDataService'
import type { EnrichedBizDataNode } from '@/lib/supabase'

export class BusinessAnalysisSkill extends Skill {
  name = 'business_analysis'
  description = '分析教育后勤经营数据，支持总览分析、对比分析、下钻分析。可以查询营收、利润、毛利率等关键指标。'

  parameters: SkillParameter[] = [
    {
      name: 'query_type',
      description: '查询类型: summary(总览分析), comparison(中心对比), drill_down(节点下钻)',
      required: true,
      type: 'string',
    },
    {
      name: 'period',
      description: '期间，如 "202603" 表示2026年3月累计数据',
      required: false,
      type: 'string',
    },
    {
      name: 'report_type',
      description: '报表类型: fone(年初预算) 或 tuwei(突围考核)，默认 fone',
      required: false,
      type: 'string',
    },
    {
      name: 'node_name',
      description: '节点名称，用于下钻分析时指定要分析的节点',
      required: false,
      type: 'string',
    },
  ]

  async execute(params: Record<string, any>, _context: SkillContext): Promise<SkillResult> {
    const queryType = params.query_type as string
    const period = params.period as string | undefined
    const reportType = (params.report_type as 'fone' | 'tuwei') || 'fone'
    const nodeName = params.node_name as string | undefined

    try {
      // 1. 查询 Supabase 数据
      console.log('[BusinessAnalysisSkill] Fetching data:', { period, reportType })

      const reports = await fetchBizReport({
        period,
        periodType: 'cumulative',
        reportTypes: [reportType],
      })

      if (!reports || reports.length === 0) {
        return {
          success: false,
          message: '未找到数据，请检查期间参数是否正确',
          data: null,
        }
      }

      const monthlyPlans = await fetchMonthlyPlan()

      // 2. 聚合数据
      const foneReports = reportType === 'fone' ? reports : []
      const tuweiReports = reportType === 'tuwei' ? reports : []
      const aggregated = aggregateByNode(foneReports, tuweiReports, monthlyPlans)

      console.log('[BusinessAnalysisSkill] Aggregated nodes:', aggregated.length)

      // 3. 根据 query_type 生成分析结果
      switch (queryType) {
        case 'summary':
          return this.generateSummary(aggregated, reportType)
        case 'comparison':
          return this.generateComparison(aggregated, reportType)
        case 'drill_down':
          return this.generateDrillDown(aggregated, nodeName, reportType)
        default:
          return {
            success: false,
            message: `不支持的查询类型: ${queryType}`,
            data: null,
          }
      }
    } catch (error) {
      console.error('[BusinessAnalysisSkill] Error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : '数据查询失败',
        data: null,
      }
    }
  }

  /**
   * 总览分析 - 显示整体经营情况
   */
  private generateSummary(nodes: EnrichedBizDataNode[], reportType: 'fone' | 'tuwei'): SkillResult {
    const tree = buildHierarchyTree(nodes)

    // 获取一级节点（中心级）
    const level1Nodes = tree.level1

    if (level1Nodes.length === 0) {
      return {
        success: false,
        message: '未找到汇总数据',
        data: null,
      }
    }

    // 计算总体数据（汇总所有一级节点）
    const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'
    const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'

    let totalRevenue = 0
    let totalBudgetRevenue = 0
    let totalProfit = 0
    let totalBudgetProfit = 0

    level1Nodes.forEach(node => {
      totalRevenue += node.metrics.revenue?.actual || 0
      totalBudgetRevenue += node.metrics.revenue?.[budgetField] || 0
      totalProfit += node.metrics.pretax_profit?.actual || 0
      totalBudgetProfit += node.metrics.pretax_profit?.[budgetField] || 0
    })

    const revenueCompletion = totalBudgetRevenue > 0 ? totalRevenue / totalBudgetRevenue : null
    const profitCompletion = totalBudgetProfit > 0 ? totalProfit / totalBudgetProfit : null

    // 构建分析数据
    const summary = {
      reportType: reportType === 'fone' ? '年初预算' : '突围考核',
      overall: {
        revenue: {
          actual: totalRevenue,
          budget: totalBudgetRevenue,
          completion: revenueCompletion,
          diff: totalRevenue - totalBudgetRevenue,
        },
        profit: {
          actual: totalProfit,
          budget: totalBudgetProfit,
          completion: profitCompletion,
          diff: totalProfit - totalBudgetProfit,
        },
      },
      centers: level1Nodes.map(node => ({
        name: node.node_name,
        revenue: {
          actual: node.metrics.revenue?.actual,
          budget: node.metrics.revenue?.[budgetField],
          completion: node.metrics.revenue?.[completionField],
        },
        profit: {
          actual: node.metrics.pretax_profit?.actual,
          budget: node.metrics.pretax_profit?.[budgetField],
          completion: node.metrics.pretax_profit?.[completionField],
        },
        margin: node.metrics.gross_margin?.actual,
        laborCostRate: node.metrics.labor_cost_rate?.actual,
      })),
    }

    return {
      success: true,
      message: '总览分析完成',
      data: summary,
      visualizations: [
        {
          type: 'card',
          data: summary.overall,
        },
        {
          type: 'table',
          data: summary.centers,
        },
      ],
    }
  }

  /**
   * 对比分析 - 对比各中心表现
   */
  private generateComparison(nodes: EnrichedBizDataNode[], reportType: 'fone' | 'tuwei'): SkillResult {
    const tree = buildHierarchyTree(nodes)
    const level1Nodes = tree.level1

    if (level1Nodes.length === 0) {
      return {
        success: false,
        message: '未找到中心数据',
        data: null,
      }
    }

    const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'

    // 按营收达成率排序
    const comparison = level1Nodes
      .map(node => ({
        name: node.node_name,
        revenue: node.metrics.revenue?.actual || 0,
        revenueCompletion: node.metrics.revenue?.[completionField] || 0,
        profit: node.metrics.pretax_profit?.actual || 0,
        profitCompletion: node.metrics.pretax_profit?.[completionField] || 0,
        margin: node.metrics.gross_margin?.actual || 0,
        laborCostRate: node.metrics.labor_cost_rate?.actual || 0,
      }))
      .sort((a, b) => b.revenueCompletion - a.revenueCompletion)

    // 找出表现最好和最差的中心
    const best = comparison[0]
    const worst = comparison[comparison.length - 1]

    return {
      success: true,
      message: '对比分析完成',
      data: {
        reportType: reportType === 'fone' ? '年初预算' : '突围考核',
        comparison,
        insights: {
          best: {
            name: best.name,
            revenueCompletion: best.revenueCompletion,
          },
          worst: {
            name: worst.name,
            revenueCompletion: worst.revenueCompletion,
          },
        },
      },
      visualizations: [
        {
          type: 'chart',
          data: comparison,
        },
      ],
    }
  }

  /**
   * 下钻分析 - 分析特定节点的详细情况
   */
  private generateDrillDown(
    nodes: EnrichedBizDataNode[],
    nodeName: string | undefined,
    reportType: 'fone' | 'tuwei'
  ): SkillResult {
    if (!nodeName) {
      return {
        success: false,
        message: '下钻分析需要指定 node_name 参数',
        data: null,
      }
    }

    const targetNode = nodes.find(n => n.node_name === nodeName)

    if (!targetNode) {
      return {
        success: false,
        message: `未找到节点: ${nodeName}`,
        data: null,
      }
    }

    const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'
    const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'

    // 提取关键指标
    const metrics = {
      revenue: {
        actual: targetNode.metrics.revenue?.actual,
        budget: targetNode.metrics.revenue?.[budgetField],
        completion: targetNode.metrics.revenue?.[completionField],
        yoy: targetNode.metrics.revenue?.yoy,
      },
      profit: {
        actual: targetNode.metrics.pretax_profit?.actual,
        budget: targetNode.metrics.pretax_profit?.[budgetField],
        completion: targetNode.metrics.pretax_profit?.[completionField],
      },
      margin: {
        actual: targetNode.metrics.gross_margin?.actual,
        budget: targetNode.metrics.gross_margin?.[budgetField],
      },
      laborCostRate: {
        actual: targetNode.metrics.labor_cost_rate?.actual,
        budget: targetNode.metrics.labor_cost_rate?.[budgetField],
      },
      headcount: {
        actual: targetNode.metrics.headcount?.actual,
        budget: targetNode.metrics.headcount?.[budgetField],
      },
    }

    return {
      success: true,
      message: `${nodeName} 下钻分析完成`,
      data: {
        nodeName,
        reportType: reportType === 'fone' ? '年初预算' : '突围考核',
        hierarchy: targetNode.orgHierarchy,
        metrics,
      },
      visualizations: [
        {
          type: 'card',
          data: metrics,
        },
      ],
    }
  }
}
