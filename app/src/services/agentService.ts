// Agent Service Core

import type { LLMConfig } from '@/lib/llmConfig'
import type { Skill, SkillContext, Message, ToolCall, SkillResult } from './agent/types'
import { SkillRegistry } from './agent/skillRegistry'
import { ConversationMemory } from './agent/memory'
import { streamLLMResponse, callLLM } from './agent/llmStream'
import { EchoSkill } from './agent/skills/echoSkill'
import { BusinessAnalysisSkill } from './agent/skills/businessAnalysisSkill'
import { ReportGenerationSkill } from './agent/skills/reportGenerationSkill'

export class AgentService {
  private config: LLMConfig
  private skillRegistry: SkillRegistry
  private memory: ConversationMemory
  private context: SkillContext

  constructor(config: LLMConfig, context?: SkillContext) {
    this.config = config
    this.skillRegistry = new SkillRegistry()
    this.memory = new ConversationMemory()
    this.context = context || {}

    // Register default skills
    this.registerSkill(new EchoSkill())
    this.registerSkill(new BusinessAnalysisSkill())
    this.registerSkill(new ReportGenerationSkill())

    console.log('[AgentService] Initialized with provider:', config.provider)
  }

  /**
   * Register a skill
   */
  registerSkill(skill: Skill) {
    this.skillRegistry.register(skill)
  }

  /**
   * Send a message and get streaming response
   */
  async *sendMessage(userMessage: string): AsyncGenerator<string> {
    // Add user message to history
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }
    this.memory.addMessage(userMsg)

    // Detect if we need to use a skill
    yield '🤔 正在思考...\n\n'

    let skillCall: ToolCall | null = null
    try {
      skillCall = await this.detectSkillCall(userMessage)
    } catch (error) {
      console.error('[AgentService] Skill detection failed:', error)
      // Fallback to direct LLM response
    }

    if (skillCall) {
      // Execute skill and stream response
      yield* this.executeSkillAndRespond(skillCall)
    } else {
      // Direct LLM response
      yield* this.streamDirectResponse(userMessage)
    }
  }

  /**
   * Detect if a skill should be called based on user message
   */
  private async detectSkillCall(message: string): Promise<ToolCall | null> {
    const skills = this.skillRegistry.getAll()
    if (skills.length === 0) {
      return null
    }

    const systemPrompt = this.buildSkillDetectionPrompt()

    try {
      const response = await callLLM(this.config, systemPrompt, message, { responseFormat: 'json' })
      console.log('[AgentService] Skill detection response:', response)

      const parsed = JSON.parse(response)

      if (parsed.use_skill && parsed.skill_name) {
        // Validate skill exists
        const skill = this.skillRegistry.get(parsed.skill_name)
        if (!skill) {
          console.warn('[AgentService] Skill not found:', parsed.skill_name)
          return null
        }

        // Enhance parameters with context
        const enhancedParams = this.enhanceParameters(parsed.parameters, message)

        console.log('[AgentService] Detected skill call:', parsed.skill_name, 'with params:', enhancedParams)

        return {
          skillName: parsed.skill_name,
          parameters: enhancedParams,
          status: 'pending',
        }
      }
    } catch (error) {
      console.error('[AgentService] Failed to parse skill detection response:', error)
      // Fallback: try pattern matching for common queries
      return this.fallbackSkillDetection(message)
    }

    return null
  }

  /**
   * Enhance parameters with additional context
   */
  private enhanceParameters(params: Record<string, any>, message: string): Record<string, any> {
    const enhanced = { ...params }

    // Auto-detect current period if not specified
    if (!enhanced.period) {
      if (message.includes('本月')) {
        const now = new Date()
        enhanced.period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      } else if (message.includes('上月')) {
        const now = new Date()
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
        enhanced.period = `${lastMonth.getFullYear()}${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
      }
    }

    // Default report_type to fone if not specified
    if (!enhanced.report_type) {
      enhanced.report_type = 'fone'
    }

    // Ensure query_type is valid
    if (enhanced.query_type && !['summary', 'comparison', 'drill_down', 'trend'].includes(enhanced.query_type)) {
      console.warn('[AgentService] Invalid query_type:', enhanced.query_type, '- defaulting to summary')
      enhanced.query_type = 'summary'
    }

    return enhanced
  }

  /**
   * Fallback skill detection using pattern matching
   * This is used when LLM-based detection fails
   */
  private fallbackSkillDetection(message: string): ToolCall | null {
    const lowerMsg = message.toLowerCase()

    // Pattern: echo command
    if (lowerMsg.startsWith('echo ')) {
      console.log('[AgentService] Fallback: detected echo command')
      return {
        skillName: 'echo',
        parameters: { message: message.substring(5) },
        status: 'pending',
      }
    }

    // Pattern: report generation keywords
    const reportKeywords = ['生成报告', '导出', '下载', 'pdf', 'excel', '报表']
    const hasReportKeyword = reportKeywords.some(kw => lowerMsg.includes(kw))

    if (hasReportKeyword) {
      let format = 'pdf'
      if (lowerMsg.includes('excel') || lowerMsg.includes('表格') || lowerMsg.includes('xls')) {
        format = 'excel'
      }

      const title = '经营分析报告'

      console.log('[AgentService] Fallback: detected report_generation', { format, title })

      return {
        skillName: 'report_generation',
        parameters: {
          format,
          title,
          data: '{}', // Empty data, will need to be filled from context
        },
        status: 'pending',
      }
    }

    // Pattern: business analysis keywords
    const analysisKeywords = ['分析', '营收', '利润', '达成率', '中心', '经营', '数据', '表现', '趋势', '对比', '比较']
    const hasAnalysisKeyword = analysisKeywords.some(kw => message.includes(kw))

    if (hasAnalysisKeyword) {
      // Detect query type
      let queryType = 'summary'
      if (message.includes('趋势') || message.includes('变化') || message.includes('增长')) {
        queryType = 'trend'
      } else if (message.includes('对比') || message.includes('比较') || message.includes('排名') || message.includes('哪个')) {
        queryType = 'comparison'
      } else if (message.includes('详细') || message.includes('下钻') || message.includes('具体')) {
        queryType = 'drill_down'
      }

      // Extract period (e.g., "202603", "2026年3月", "1月到3月")
      let period: string | undefined
      const rangeMatch = message.match(/(\d{1,2})月?[到至\-~](\d{1,2})月/)
      if (rangeMatch) {
        // Period range: "1月到3月" → "202601-202603"
        const now = new Date()
        const year = now.getFullYear()
        const startMonth = String(rangeMatch[1]).padStart(2, '0')
        const endMonth = String(rangeMatch[2]).padStart(2, '0')
        period = `${year}${startMonth}-${year}${endMonth}`
      } else {
        const periodMatch = message.match(/(\d{4})年?(\d{1,2})月?/) || message.match(/(\d{6})/)
        period = periodMatch ? (periodMatch[3] || `${periodMatch[1]}${String(periodMatch[2]).padStart(2, '0')}`) : undefined
      }

      // Extract report type
      let reportType: 'fone' | 'tuwei' = 'fone'
      if (message.includes('突围') || message.includes('考核')) {
        reportType = 'tuwei'
      }

      // Extract metric category
      let metricCategory: string | undefined
      if (message.includes('营收') || message.includes('收入')) {
        metricCategory = 'revenue'
      } else if (message.includes('利润')) {
        metricCategory = 'pretax_profit'
      } else if (message.includes('毛利率')) {
        metricCategory = 'gross_margin'
      } else if (message.includes('人工成本率')) {
        metricCategory = 'labor_cost_rate'
      }

      // Extract node name for drill_down
      const nodeMatch = message.match(/([\u4e00-\u9fa5]+中心)/)
      const nodeName = nodeMatch ? nodeMatch[1] : undefined

      console.log('[AgentService] Fallback detection: business_analysis', {
        queryType,
        period,
        reportType,
        metricCategory,
        nodeName
      })

      return {
        skillName: 'business_analysis',
        parameters: {
          query_type: queryType,
          period,
          report_type: reportType,
          metric_category: metricCategory,
          node_name: nodeName,
        },
        status: 'pending',
      }
    }

    console.log('[AgentService] Fallback: no skill detected')
    return null
  }

  /**
   * Build prompt for skill detection
   */
  private buildSkillDetectionPrompt(): string {
    const skillList = this.skillRegistry.buildSkillList()

    return `你是一个智能助手，可以使用以下技能来帮助用户：

${skillList}

根据用户的问题，判断是否需要使用技能。

## 示例（Few-Shot Learning）

### 需要使用技能的情况：

用户: "分析一下2026年3月的经营情况"
返回: {"use_skill": true, "skill_name": "business_analysis", "parameters": {"query_type": "summary", "period": "202603", "report_type": "fone"}}

用户: "对比各中心的营收表现"
返回: {"use_skill": true, "skill_name": "business_analysis", "parameters": {"query_type": "comparison", "report_type": "fone"}}

用户: "餐饮中心的详细数据"
返回: {"use_skill": true, "skill_name": "business_analysis", "parameters": {"query_type": "drill_down", "node_name": "餐饮中心", "report_type": "fone"}}

用户: "看看本月的利润情况"
返回: {"use_skill": true, "skill_name": "business_analysis", "parameters": {"query_type": "summary", "metric_category": "pretax_profit", "report_type": "fone"}}

用户: "物业中心和餐饮中心哪个表现更好？"
返回: {"use_skill": true, "skill_name": "business_analysis", "parameters": {"query_type": "comparison", "report_type": "fone"}}

用户: "2026年1月到3月的营收趋势"
返回: {"use_skill": true, "skill_name": "business_analysis", "parameters": {"query_type": "trend", "period": "202601-202603", "metric_category": "revenue", "report_type": "fone"}}

用户: "突围考核的达成情况"
返回: {"use_skill": true, "skill_name": "business_analysis", "parameters": {"query_type": "summary", "report_type": "tuwei"}}

用户: "生成一份PDF报告"
返回: {"use_skill": true, "skill_name": "report_generation", "parameters": {"format": "pdf", "title": "经营分析报告", "data": "{}"}}

用户: "导出Excel报表"
返回: {"use_skill": true, "skill_name": "report_generation", "parameters": {"format": "excel", "title": "经营数据报表", "data": "{}"}}

用户: "echo hello"
返回: {"use_skill": true, "skill_name": "echo", "parameters": {"message": "hello"}}

### 不需要使用技能的情况：

用户: "你好"
返回: {"use_skill": false}

用户: "你能做什么？"
返回: {"use_skill": false}

用户: "今天天气怎么样？"
返回: {"use_skill": false}

用户: "谢谢"
返回: {"use_skill": false}

用户: "这个数据是什么意思？"
返回: {"use_skill": false}

## 规则

1. **经营数据分析** - 使用 business_analysis 技能：
   - 关键词：分析、营收、利润、达成率、中心、经营、数据、表现、对比、趋势
   - query_type 判断：
     * "分析"/"总览"/"整体"/"情况" → summary
     * "对比"/"比较"/"排名"/"哪个更好" → comparison
     * "详细"/"下钻"/"具体" → drill_down
     * "趋势"/"变化"/"增长" → trend
   - period 提取：
     * "2026年3月" → "202603"
     * "3月" → "202603"（当前年份）
     * "1月到3月" → "202601-202603"
     * "本月" → 当前年月
   - report_type 判断：
     * "突围"/"考核" → "tuwei"
     * 默认 → "fone"
   - metric_category 提取：
     * "营收"/"收入" → "revenue"
     * "利润" → "pretax_profit"
     * "毛利率" → "gross_margin"
     * "人工成本率" → "labor_cost_rate"
   - node_name 提取：
     * 提取具体的中心或节点名称（如"餐饮中心"、"物业中心"）

2. **报告生成** - 使用 report_generation 技能：
   - 关键词：生成报告、导出、下载、PDF、Excel
   - format 判断：
     * "PDF" → "pdf"
     * "Excel"/"表格" → "excel"
   - title: 从用户消息中提取或使用默认值
   - data: 需要从之前的分析结果中获取（通常需要先调用 business_analysis）

3. **Echo 测试** - 使用 echo 技能：
   - 用户消息以 "echo" 开头

4. **闲聊对话** - 不使用技能：
   - 打招呼、感谢、一般性问题
   - 询问能力（"你能做什么"）
   - 解释性问题（"这是什么意思"）

5. **参数完整性**：
   - 尽可能从用户消息中提取所有相关参数
   - 如果无法确定某个参数，可以省略（系统会使用默认值）

6. **输出格式**：
   - 严格返回 JSON 格式
   - 不要包含任何解释性文字
   - 确保 JSON 格式正确（可解析）

重要：只返回 JSON，不要包含任何其他文字。`
  }

  /**
   * Execute skill and generate natural language response
   */
  private async *executeSkillAndRespond(toolCall: ToolCall): AsyncGenerator<string> {
    yield `🔧 正在使用技能: **${toolCall.skillName}**\n\n`

    const skill = this.skillRegistry.get(toolCall.skillName)
    if (!skill) {
      yield `❌ 错误：技能 "${toolCall.skillName}" 不存在\n`
      return
    }

    // Validate parameters
    const validation = skill.validateParameters(toolCall.parameters)
    if (!validation.valid) {
      yield `❌ 参数错误：\n${validation.errors.join('\n')}\n`
      return
    }

    try {
      toolCall.status = 'pending'
      const result = await skill.execute(toolCall.parameters, this.context)
      toolCall.status = 'success'
      toolCall.result = result

      if (!result.success) {
        yield `⚠️ 技能执行失败: ${result.message}\n`

        // Save failed tool call to memory
        const assistantMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `技能执行失败: ${result.message}`,
          timestamp: Date.now(),
          toolCalls: [toolCall],
        }
        this.memory.addMessage(assistantMsg)
        return
      }

      yield `✅ 技能执行成功\n\n`

      // Generate natural language response based on skill result
      const responsePrompt = this.buildResponsePrompt(toolCall.skillName, result)

      let fullResponse = ''
      for await (const chunk of this.streamDirectResponse(responsePrompt, true)) {
        fullResponse += chunk
        yield chunk
      }

      // Save successful tool call with result to memory
      const assistantMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
        toolCalls: [toolCall],
      }
      this.memory.addMessage(assistantMsg)

    } catch (error) {
      toolCall.status = 'error'
      toolCall.error = error instanceof Error ? error.message : String(error)
      yield `❌ 技能执行失败: ${toolCall.error}\n`

      // Save error to memory
      const assistantMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `技能执行失败: ${toolCall.error}`,
        timestamp: Date.now(),
        toolCalls: [toolCall],
      }
      this.memory.addMessage(assistantMsg)
    }
  }

  /**
   * Build prompt for generating natural language response from skill result
   */
  private buildResponsePrompt(skillName: string, result: SkillResult): string {
    return `你刚刚使用了 "${skillName}" 技能，获得了以下数据：

${JSON.stringify(result.data, null, 2)}

请根据这些数据，生成一段自然、易懂的分析报告。要求：

1. 用通俗的语言描述关键发现
2. 突出重要指标和趋势
3. 如果有异常或需要关注的点，请指出
4. 给出建议或洞察
5. 不要直接输出 JSON 数据，要转换为自然语言
6. 使用 Markdown 格式，适当使用加粗、列表等

请开始你的分析：`
  }

  /**
   * Stream direct LLM response (no skill)
   */
  private async *streamDirectResponse(message: string, isSkillResponse: boolean = false): AsyncGenerator<string> {
    const systemPrompt = isSkillResponse
      ? '你是一个专业的数据分析师，擅长将数据转换为易懂的分析报告。'
      : '你是一个友好、专业的智能助手，可以回答各种问题。如果用户询问经营数据分析相关的问题，请告诉他们你可以使用专门的分析工具来帮助他们。'

    // Get recent conversation history for context
    const history = this.memory.getRecentMessages(5).map((msg: Message) => ({
      role: msg.role,
      content: msg.content,
    }))

    try {
      let fullResponse = ''

      for await (const chunk of streamLLMResponse(this.config, systemPrompt, message, history)) {
        if (!chunk.done && chunk.content) {
          fullResponse += chunk.content
          yield chunk.content
        }
      }

      // Save assistant response to memory
      if (fullResponse) {
        const assistantMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: fullResponse,
          timestamp: Date.now(),
        }
        this.memory.addMessage(assistantMsg)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      yield `\n\n❌ 错误: ${errorMsg}\n`

      if (errorMsg.includes('401') || errorMsg.includes('403')) {
        yield '\n💡 提示：请检查设置页面中的 API Key 是否正确配置。\n'
      }
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Message[] {
    return this.memory.getMessages()
  }

  /**
   * Clear conversation history
   */
  clearConversation() {
    this.memory.clear()
    console.log('[AgentService] Conversation cleared')
  }

  /**
   * Update configuration (when settings change)
   */
  updateConfig(config: LLMConfig) {
    this.config = config
    console.log('[AgentService] Configuration updated:', config.provider)
  }

  /**
   * Update context (e.g., access token)
   */
  updateContext(context: Partial<SkillContext>) {
    this.context = { ...this.context, ...context }
  }
}
