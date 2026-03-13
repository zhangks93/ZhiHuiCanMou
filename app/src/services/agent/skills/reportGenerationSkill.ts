// Report Generation Skill - 生成 PDF/Excel 报告

import { Skill, type SkillParameter, type SkillResult, type SkillContext } from '../../agent/types'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

export class ReportGenerationSkill extends Skill {
  name = 'report_generation'
  description = '生成经营分析报告，支持 PDF 和 Excel 格式。可以将分析结果导出为可下载的报告文件。'

  parameters: SkillParameter[] = [
    {
      name: 'format',
      description: '报告格式: pdf 或 excel',
      required: true,
      type: 'string',
    },
    {
      name: 'title',
      description: '报告标题',
      required: true,
      type: 'string',
    },
    {
      name: 'data',
      description: '报告数据（JSON 格式）',
      required: true,
      type: 'string',
    },
    {
      name: 'report_type',
      description: '报表类型: fone 或 tuwei',
      required: false,
      type: 'string',
    },
  ]

  async execute(params: Record<string, any>, _context: SkillContext): Promise<SkillResult> {
    const format = params.format as string
    const title = params.title as string
    const dataStr = params.data as string
    const reportType = params.report_type as string | undefined

    try {
      // Parse data
      let data: any
      try {
        data = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr
      } catch (e) {
        return {
          success: false,
          message: '数据格式错误，无法解析 JSON',
          data: null,
        }
      }

      if (format === 'pdf') {
        return this.generatePDF(title, data, reportType)
      } else if (format === 'excel') {
        return this.generateExcel(title, data, reportType)
      } else {
        return {
          success: false,
          message: `不支持的格式: ${format}，请使用 pdf 或 excel`,
          data: null,
        }
      }
    } catch (error) {
      console.error('[ReportGenerationSkill] Error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : '报告生成失败',
        data: null,
      }
    }
  }

  /**
   * Generate PDF report
   */
  private generatePDF(title: string, data: any, reportType?: string): SkillResult {
    try {
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(18)
      doc.text(title, 20, 20)

      // Add report type
      if (reportType) {
        doc.setFontSize(12)
        doc.text(`报表类型: ${reportType === 'fone' ? '年初预算' : '突围考核'}`, 20, 30)
      }

      // Add timestamp
      doc.setFontSize(10)
      doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 20, 40)

      let yPosition = 50

      // Add overall summary if available
      if (data.overall) {
        doc.setFontSize(14)
        doc.text('整体情况', 20, yPosition)
        yPosition += 10

        doc.setFontSize(10)
        if (data.overall.revenue) {
          doc.text(`营收实际: ${this.formatNumber(data.overall.revenue.actual)} 万元`, 30, yPosition)
          yPosition += 7
          doc.text(`营收预算: ${this.formatNumber(data.overall.revenue.budget)} 万元`, 30, yPosition)
          yPosition += 7
          doc.text(`营收达成率: ${this.formatPercent(data.overall.revenue.completion)}`, 30, yPosition)
          yPosition += 10
        }

        if (data.overall.profit) {
          doc.text(`利润实际: ${this.formatNumber(data.overall.profit.actual)} 万元`, 30, yPosition)
          yPosition += 7
          doc.text(`利润预算: ${this.formatNumber(data.overall.profit.budget)} 万元`, 30, yPosition)
          yPosition += 7
          doc.text(`利润达成率: ${this.formatPercent(data.overall.profit.completion)}`, 30, yPosition)
          yPosition += 10
        }
      }

      // Add centers data if available
      if (data.centers && Array.isArray(data.centers)) {
        doc.setFontSize(14)
        doc.text('各中心表现', 20, yPosition)
        yPosition += 10

        doc.setFontSize(9)
        data.centers.slice(0, 10).forEach((center: any) => {
          if (yPosition > 270) {
            doc.addPage()
            yPosition = 20
          }

          doc.text(`${center.name}:`, 30, yPosition)
          yPosition += 6
          doc.text(`  营收: ${this.formatNumber(center.revenue?.actual)} 万元 (${this.formatPercent(center.revenue?.completion)})`, 35, yPosition)
          yPosition += 6
          doc.text(`  利润: ${this.formatNumber(center.profit?.actual)} 万元 (${this.formatPercent(center.profit?.completion)})`, 35, yPosition)
          yPosition += 8
        })
      }

      // Add trend data if available
      if (data.trend && Array.isArray(data.trend)) {
        if (yPosition > 200) {
          doc.addPage()
          yPosition = 20
        }

        doc.setFontSize(14)
        doc.text('趋势分析', 20, yPosition)
        yPosition += 10

        doc.setFontSize(9)
        data.trend.forEach((item: any) => {
          if (yPosition > 270) {
            doc.addPage()
            yPosition = 20
          }

          doc.text(`${item.period}: 营收 ${this.formatNumber(item.revenue)} 万元, 利润 ${this.formatNumber(item.profit)} 万元`, 30, yPosition)
          yPosition += 6
        })
      }

      // Generate blob
      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)

      return {
        success: true,
        message: 'PDF 报告生成成功',
        data: {
          format: 'pdf',
          url,
          filename: `${title}_${Date.now()}.pdf`,
        },
      }
    } catch (error) {
      console.error('[ReportGenerationSkill] PDF generation error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'PDF 生成失败',
        data: null,
      }
    }
  }

  /**
   * Generate Excel report
   */
  private generateExcel(title: string, data: any, reportType?: string): SkillResult {
    try {
      const workbook = XLSX.utils.book_new()

      // Create summary sheet
      if (data.overall) {
        const summaryData = [
          ['报告标题', title],
          ['报表类型', reportType === 'fone' ? '年初预算' : '突围考核'],
          ['生成时间', new Date().toLocaleString('zh-CN')],
          [],
          ['指标', '实际值', '预算值', '达成率', '差异'],
        ]

        if (data.overall.revenue) {
          summaryData.push([
            '营收',
            data.overall.revenue.actual,
            data.overall.revenue.budget,
            data.overall.revenue.completion,
            data.overall.revenue.diff,
          ])
        }

        if (data.overall.profit) {
          summaryData.push([
            '利润',
            data.overall.profit.actual,
            data.overall.profit.budget,
            data.overall.profit.completion,
            data.overall.profit.diff,
          ])
        }

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(workbook, summarySheet, '总览')
      }

      // Create centers sheet
      if (data.centers && Array.isArray(data.centers)) {
        const centersData = [
          ['中心名称', '营收实际', '营收预算', '营收达成率', '利润实际', '利润预算', '利润达成率', '毛利率', '人工成本率'],
        ]

        data.centers.forEach((center: any) => {
          centersData.push([
            center.name,
            center.revenue?.actual || 0,
            center.revenue?.budget || 0,
            center.revenue?.completion || 0,
            center.profit?.actual || 0,
            center.profit?.budget || 0,
            center.profit?.completion || 0,
            center.margin || 0,
            center.laborCostRate || 0,
          ])
        })

        const centersSheet = XLSX.utils.aoa_to_sheet(centersData)
        XLSX.utils.book_append_sheet(workbook, centersSheet, '各中心数据')
      }

      // Create trend sheet
      if (data.trend && Array.isArray(data.trend)) {
        const trendData = [
          ['期间', '营收', '利润', '毛利率', '人工成本率', '营收环比增长', '利润环比增长'],
        ]

        data.trend.forEach((item: any) => {
          trendData.push([
            item.period,
            item.revenue || 0,
            item.profit || 0,
            item.margin || 0,
            item.laborCostRate || 0,
            item.revenueGrowth || 0,
            item.profitGrowth || 0,
          ])
        })

        const trendSheet = XLSX.utils.aoa_to_sheet(trendData)
        XLSX.utils.book_append_sheet(workbook, trendSheet, '趋势分析')
      }

      // Generate blob
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(excelBlob)

      return {
        success: true,
        message: 'Excel 报告生成成功',
        data: {
          format: 'excel',
          url,
          filename: `${title}_${Date.now()}.xlsx`,
        },
      }
    } catch (error) {
      console.error('[ReportGenerationSkill] Excel generation error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Excel 生成失败',
        data: null,
      }
    }
  }

  /**
   * Format number with thousand separators
   */
  private formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-'
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  }

  /**
   * Format percentage
   */
  private formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-'
    return `${(value * 100).toFixed(2)}%`
  }
}
