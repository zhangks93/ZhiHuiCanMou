// Agent Service Core

import type { LLMConfig } from '@/lib/llmConfig'
import type { Skill, SkillContext, Message, ToolCall, SkillResult } from './agent/types'
import { SkillRegistry } from './agent/skillRegistry'
import { ConversationMemory } from './agent/memory'
import { streamLLMResponse, callLLM } from './agent/llmStream'
import { EchoSkill } from './agent/skills/echoSkill'
import { BusinessAnalysisSkill } from './agent/skills/businessAnalysisSkill'

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
      const parsed = JSON.parse(response)

      if (parsed.use_skill && parsed.skill_name) {
        console.log('[AgentService] Detected skill call:', parsed.skill_name)
        return {
          skillName: parsed.skill_name,
          parameters: parsed.parameters || {},
          status: 'pending',
        }
      }
    } catch (error) {
      console.error('[AgentService] Failed to parse skill detection response:', error)
    }

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

如果需要使用技能，返回 JSON 格式：
{
  "use_skill": true,
  "skill_name": "技能名称",
  "parameters": {
    "参数名": "参数值"
  }
}

如果不需要使用技能（例如：闲聊、打招呼、一般性问题），返回：
{
  "use_skill": false
}

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
