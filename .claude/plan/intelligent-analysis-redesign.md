# Implementation Plan: Intelligent Analysis Page Redesign

## Requirements Restatement

重新设计智能分析页面，具体要求：

1. **Agent基础能力**: 参考 OpenClaw 的能力与架构设计
2. **经营分析Skill**: 将经营分析功能设计为独立的 Skill，数据查询参考现有经营数据页面的实现

## OpenClaw Architecture Analysis

基于研究，OpenClaw 的核心架构特点：

### Core Components
1. **Agent Runtime**: 长期运行的守护进程，连接 LLM 与工具/技能
2. **Skill System**: 模块化的工具/技能注册机制，每个 Skill 是独立的可执行单元
3. **Memory Management**: 基于文件的持久化内存，跟踪对话历史和系统状态
4. **Tool Integration**: 通用工具集成模式，支持 shell 命令、浏览器控制、文件管理等
5. **Observe-Plan-Act Loop**: 序列化的执行循环（观察 → 规划 → 行动）

### Key Design Patterns
- **Model-Agnostic**: 支持多种 LLM 提供商（Claude, GPT-4, DeepSeek, Gemini, Ollama）
- **Self-Hosted**: 数据保留在本地硬件，除非显式配置
- **Messaging Integration**: 通过消息应用（Slack, Telegram, Discord 等）访问
- **Autonomous Execution**: 能够执行 shell 命令、浏览网页、管理文件、控制日历

## Current Codebase Analysis

### Existing Business Data Implementation

**Key Files:**
- `app/src/pages/BizData.tsx` - 经营数据页面主组件
- `app/src/services/bizDataService.ts` - 数据查询与聚合服务
- `app/src/pages/AiAnalysis.tsx` - 当前智能分析页面（空白占位）

**Data Query Patterns:**
```typescript
// 从 Supabase 查询经营数据
fetchBizReport({
  period: '202603',
  periodType: 'cumulative',
  reportTypes: ['fone', 'tuwei']
})

// 聚合节点数据
aggregateByNode(foneReports, tuweiReports, monthlyPlans)

// 构建层级树
buildHierarchyTree(nodes)
```

**Key Data Tables:**
- `edu_biz_report` - 经营报表数据（11,477 rows）
- `edu_biz_monthly_plan` - 月度计划（1,498 rows）
- `edu_org_hierarchy` - 组织层级映射（153 rows）

**Metrics Available (25 categories):**
- 主报表: revenue, catering_expense, material_cost, gross_profit, gross_margin, labor_cost, pretax_profit, headcount, per_capita_revenue, labor_cost_rate, etc.
- 成本分析: labor_cost, salary, social_insurance, housing_fund, vehicle_expense, energy_expense, etc.

### Current Tauri Backend Structure

**Files:**
- `app/src-tauri/src/lib.rs` - Main Tauri application entry
- `app/src-tauri/Cargo.toml` - Rust dependencies

**Current Capabilities:**
- Deep link handling (Feishu OAuth)
- Plugin support (shell, opener, http, deep-link)

## Implementation Plan

### Phase 1: Design Agent Architecture (TypeScript-First, Inspired by OpenClaw)

**Objective**: Create a lightweight agent system in TypeScript, leveraging existing LLM infrastructure

**Architecture Decision: TypeScript Agent (Not Rust)**

基于以下原因，采用 TypeScript 实现 Agent：

1. **复用现有基础设施**: 已有完整的 `llmConfig.ts` 和 `llmService.ts`
2. **快速迭代**: TypeScript 开发速度更快，便于调试
3. **无需 Rust 学习曲线**: 团队可能更熟悉 TypeScript
4. **数据处理复用**: 直接使用 `bizDataService.ts` 的聚合逻辑
5. **配置联动**: 与设置页面无缝集成

**Components to Build:**

1. **Agent Core** (`app/src/services/agentService.ts`)
   - LLM client wrapper (复用 llmService.ts)
   - Tool/Skill registry
   - Execution loop (observe-plan-act)
   - Streaming response handler

2. **Skill System** (`app/src/services/agent/skills/`)
   - Skill interface definition
   - Skill registration mechanism
   - Skill execution context (access to Supabase, user auth)

3. **Tool Framework** (`app/src/services/agent/tools/`)
   - Web search tool (使用 Tavily API)
   - Business data query tool (复用 bizDataService)
   - Report generation tool
   - Data export tool

**Design Decisions:**
- Use **class-based design** for skills (TypeScript idiomatic)
- Support **streaming responses** via async generators
- Implement **async execution** with native Promises
- Store **conversation memory** in localStorage or IndexedDB
- **No Tauri backend changes needed** - pure frontend implementation

### Phase 2: Implement Business Analysis Skill

**Objective**: Create a dedicated Skill for business data analysis

**Skill Definition:**

```typescript
// app/src/services/agent/skills/businessAnalysisSkill.ts

import { fetchBizReport, fetchMonthlyPlan, aggregateByNode, buildHierarchyTree } from '@/services/bizDataService'
import type { EnrichedBizDataNode } from '@/lib/supabase'

export interface SkillParameter {
  name: string
  description: string
  required: boolean
  type: 'string' | 'number' | 'boolean'
}

export interface SkillResult {
  success: boolean
  data: any
  message: string
  visualizations?: {
    type: 'chart' | 'table' | 'card'
    data: any
  }[]
}

export interface SkillContext {
  accessToken?: string
  conversationHistory?: Message[]
}

export abstract class Skill {
  abstract name: string
  abstract description: string
  abstract parameters: SkillParameter[]

  abstract execute(params: Record<string, any>, context: SkillContext): Promise<SkillResult>
}

export class BusinessAnalysisSkill extends Skill {
  name = 'business_analysis'
  description = '分析教育后勤经营数据，支持按期间、报表类型、指标类别查询和聚合'

  parameters: SkillParameter[] = [
    {
      name: 'query_type',
      description: '查询类型: summary(总览), trend(趋势), comparison(对比), drill_down(下钻)',
      required: true,
      type: 'string',
    },
    {
      name: 'period',
      description: '期间，如 "202603"',
      required: false,
      type: 'string',
    },
    {
      name: 'report_type',
      description: '报表类型: fone(年初预算) 或 tuwei(突围考核)',
      required: false,
      type: 'string',
    },
    {
      name: 'metric_category',
      description: '指标类别: revenue, pretax_profit, gross_margin 等',
      required: false,
      type: 'string',
    },
    {
      name: 'node_name',
      description: '节点名称，用于下钻分析',
      required: false,
      type: 'string',
    },
  ]

  async execute(params: Record<string, any>, context: SkillContext): Promise<SkillResult> {
    const queryType = params.query_type as string
    const period = params.period as string | undefined
    const reportType = (params.report_type as 'fone' | 'tuwei') || 'fone'

    // 1. 查询 Supabase 数据
    const reports = await fetchBizReport({
      period,
      periodType: 'cumulative',
      reportTypes: [reportType],
    })

    const monthlyPlans = await fetchMonthlyPlan()

    // 2. 聚合数据（复用 bizDataService 逻辑）
    const foneReports = reportType === 'fone' ? reports : []
    const tuweiReports = reportType === 'tuwei' ? reports : []
    const aggregated = aggregateByNode(foneReports, tuweiReports, monthlyPlans)

    // 3. 根据 query_type 生成分析结果
    switch (queryType) {
      case 'summary':
        return this.generateSummary(aggregated, reportType)
      case 'trend':
        return this.generateTrendAnalysis(aggregated)
      case 'comparison':
        return this.generateComparison(aggregated, reportType)
      case 'drill_down':
        return this.generateDrillDown(aggregated, params)
      default:
        throw new Error(`Unknown query_type: ${queryType}`)
    }
  }

  private generateSummary(nodes: EnrichedBizDataNode[], reportType: 'fone' | 'tuwei'): SkillResult {
    const tree = buildHierarchyTree(nodes)
    const totalNode = tree.level1[0] // 假设第一个是总节点

    if (!totalNode) {
      return {
        success: false,
        message: '未找到总览数据',
        data: null,
      }
    }

    const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'
    const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'

    const summary = {
      revenue: {
        actual: totalNode.metrics.revenue?.actual,
        budget: totalNode.metrics.revenue?.[budgetField],
        completion: totalNode.metrics.revenue?.[completionField],
      },
      profit: {
        actual: totalNode.metrics.pretax_profit?.actual,
        budget: totalNode.metrics.pretax_profit?.[budgetField],
        completion: totalNode.metrics.pretax_profit?.[completionField],
      },
      margin: {
        actual: totalNode.metrics.gross_margin?.actual,
        budget: totalNode.metrics.gross_margin?.[budgetField],
      },
      laborCostRate: {
        actual: totalNode.metrics.labor_cost_rate?.actual,
        budget: totalNode.metrics.labor_cost_rate?.[budgetField],
      },
    }

    return {
      success: true,
      message: '总览分析完成',
      data: summary,
      visualizations: [
        {
          type: 'card',
          data: summary,
        },
      ],
    }
  }

  private generateTrendAnalysis(nodes: EnrichedBizDataNode[]): SkillResult {
    // TODO: 实现趋势分析
    return {
      success: true,
      message: '趋势分析功能开发中',
      data: null,
    }
  }

  private generateComparison(nodes: EnrichedBizDataNode[], reportType: 'fone' | 'tuwei'): SkillResult {
    const tree = buildHierarchyTree(nodes)
    const centers = tree.level1

    const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'

    const comparison = centers.map(center => ({
      name: center.node_name,
      revenue: center.metrics.revenue?.actual,
      revenueCompletion: center.metrics.revenue?.[completionField],
      profit: center.metrics.pretax_profit?.actual,
      profitCompletion: center.metrics.pretax_profit?.[completionField],
    }))

    return {
      success: true,
      message: '对比分析完成',
      data: comparison,
      visualizations: [
        {
          type: 'chart',
          data: comparison,
        },
      ],
    }
  }

  private generateDrillDown(nodes: EnrichedBizDataNode[], params: Record<string, any>): SkillResult {
    const nodeName = params.node_name as string
    const targetNode = nodes.find(n => n.node_name === nodeName)

    if (!targetNode) {
      return {
        success: false,
        message: `未找到节点: ${nodeName}`,
        data: null,
      }
    }

    return {
      success: true,
      message: `${nodeName} 下钻分析完成`,
      data: {
        node: targetNode,
        metrics: targetNode.metrics,
      },
    }
  }
}
```

**Analysis Functions:**

1. **Summary Analysis** - 总览分析
   - 总营收、利润、毛利率
   - 预算达成率
   - 同比增长
   - 关键指标卡片

2. **Trend Analysis** - 趋势分析
   - 月度趋势图
   - 同比/环比变化
   - 季节性模式

3. **Comparison Analysis** - 对比分析
   - 中心级对比
   - 实际 vs 预算
   - Fone vs Tuwei

4. **Drill-Down Analysis** - 下钻分析
   - 按组织层级下钻（level_1 → level_2 → level_3 → 叶子节点）
   - 指标明细
   - 成本结构分析

### Phase 3: Build React Chat Interface with Settings Integration

**Objective**: Create an interactive chat UI that integrates with Settings page configuration

**Components:**

1. **AiAnalysis Page** (`app/src/pages/AiAnalysis.tsx`)
   - Check LLM configuration on mount using `loadLLMConfig()`
   - Show configuration prompt if not configured
   - Initialize agent with loaded config
   - Handle configuration updates from Settings page

2. **ChatInterface** (`app/src/components/Agent/ChatInterface.tsx`)
   - Message list with user/assistant bubbles
   - Input field with send button
   - Streaming response indicator
   - Tool execution status display

3. **ConfigurationPrompt** (`app/src/components/Agent/ConfigurationPrompt.tsx`)
   - Display when LLM not configured
   - Guide user to Settings page
   - Show current provider status
   - Quick link to Settings

4. **MessageBubble** (`app/src/components/Agent/MessageBubble.tsx`)
   - User message (right-aligned, primary color)
   - Assistant message (left-aligned, gray background)
   - Markdown rendering for formatted responses
   - Code block syntax highlighting

5. **ToolExecutionIndicator** (`app/src/components/Agent/ToolExecutionIndicator.tsx`)
   - Show when agent is using a tool/skill
   - Display tool name and status (pending/success/error)
   - Animated loading state

6. **AnalysisResultCard** (`app/src/components/Agent/AnalysisResultCard.tsx`)
   - Render structured analysis results
   - Charts and tables for business data
   - Download button for reports

**Configuration Integration Flow:**

```typescript
// app/src/pages/AiAnalysis.tsx

import { loadLLMConfig } from '@/lib/llmConfig'
import { AgentService } from '@/services/agentService'

export function AiAnalysis() {
  const [config, setConfig] = useState(() => loadLLMConfig())
  const [agent, setAgent] = useState<AgentService | null>(null)

  // Initialize agent when config is available
  useEffect(() => {
    if (config) {
      const agentInstance = new AgentService(config)
      setAgent(agentInstance)
    }
  }, [config])

  // Listen for configuration updates from Settings page
  useEffect(() => {
    const handleConfigUpdate = () => {
      const newConfig = loadLLMConfig()
      setConfig(newConfig)
    }

    window.addEventListener('storage', handleConfigUpdate)
    return () => window.removeEventListener('storage', handleConfigUpdate)
  }, [])

  // Show configuration prompt if not configured
  if (!config) {
    return <ConfigurationPrompt />
  }

  return <ChatInterface agent={agent} config={config} />
}
```

**UI Flow:**

```
User opens AiAnalysis page
  ↓
Check loadLLMConfig()
  ↓
If not configured → Show ConfigurationPrompt
  ↓
User clicks "前往设置" → Navigate to Settings
  ↓
User configures OpenAI/Claude → Save config
  ↓
Return to AiAnalysis → Agent initialized
  ↓
User: "分析一下2026年3月的营收情况"
  ↓
Agent: [使用 business_analysis skill]
  ↓ (显示工具执行状态)
Tool: business_analysis(query_type="summary", period="202603", report_type="fone")
  ↓
Agent: "根据2026年3月的数据分析：
       - 总营收: 12,345万元
       - 预算达成率: 85.3%
       - 同比增长: +12.5%

       [显示图表和详细数据]"
```

### Phase 4: Implement Agent Service Core

**Objective**: Build the core agent service in TypeScript

**Agent Service Implementation:**

```typescript
// app/src/services/agentService.ts

import type { LLMConfig } from '@/lib/llmConfig'
import { BusinessAnalysisSkill } from './agent/skills/businessAnalysisSkill'
import { WebSearchSkill } from './agent/skills/webSearchSkill'
import type { Skill, SkillResult } from './agent/skills/businessAnalysisSkill'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  skillName: string
  parameters: Record<string, any>
  status: 'pending' | 'success' | 'error'
  result?: SkillResult
}

export class AgentService {
  private config: LLMConfig
  private skills: Map<string, Skill>
  private conversationHistory: Message[]

  constructor(config: LLMConfig) {
    this.config = config
    this.skills = new Map()
    this.conversationHistory = []

    // Register skills
    this.registerSkill(new BusinessAnalysisSkill())
    this.registerSkill(new WebSearchSkill(config.tavilyApiKey))
  }

  registerSkill(skill: Skill) {
    this.skills.set(skill.name, skill)
  }

  async sendMessage(userMessage: string): Promise<AsyncGenerator<string>> {
    // Add user message to history
    this.conversationHistory.push({
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    })

    // Determine if we need to use a skill
    const skillCall = await this.detectSkillCall(userMessage)

    if (skillCall) {
      // Execute skill and stream response
      return this.executeSkillAndRespond(skillCall)
    } else {
      // Direct LLM response
      return this.streamLLMResponse(userMessage)
    }
  }

  private async detectSkillCall(message: string): Promise<ToolCall | null> {
    // Use LLM to determine if a skill should be called
    const systemPrompt = this.buildSkillDetectionPrompt()
    const response = await this.callLLM(systemPrompt, message, { responseFormat: 'json' })

    try {
      const parsed = JSON.parse(response)
      if (parsed.use_skill) {
        return {
          skillName: parsed.skill_name,
          parameters: parsed.parameters,
          status: 'pending',
        }
      }
    } catch (e) {
      console.error('Failed to parse skill detection response:', e)
    }

    return null
  }

  private buildSkillDetectionPrompt(): string {
    const skillDescriptions = Array.from(this.skills.values())
      .map(skill => `- ${skill.name}: ${skill.description}`)
      .join('\n')

    return `你是一个智能助手，可以使用以下技能：

${skillDescriptions}

根据用户的问题，判断是否需要使用技能。如果需要，返回 JSON 格式：
{
  "use_skill": true,
  "skill_name": "技能名称",
  "parameters": { "参数名": "参数值" }
}

如果不需要使用技能，返回：
{
  "use_skill": false
}

只返回 JSON，不要其他内容。`
  }

  private async *executeSkillAndRespond(toolCall: ToolCall): AsyncGenerator<string> {
    yield `\n🔧 正在使用技能: ${toolCall.skillName}\n\n`

    const skill = this.skills.get(toolCall.skillName)
    if (!skill) {
      yield `❌ 技能 ${toolCall.skillName} 不存在\n`
      return
    }

    try {
      toolCall.status = 'pending'
      const result = await skill.execute(toolCall.parameters, {})
      toolCall.status = 'success'
      toolCall.result = result

      yield `✅ 技能执行成功\n\n`

      // Use LLM to generate natural language response based on skill result
      const responsePrompt = `根据以下数据分析结果，生成一段自然语言的分析报告：

${JSON.stringify(result.data, null, 2)}

要求：
1. 用通俗易懂的语言描述关键发现
2. 突出重要指标和趋势
3. 给出建议或洞察
4. 不要直接输出 JSON，要转换为自然语言`

      yield* this.streamLLMResponse(responsePrompt)

    } catch (error) {
      toolCall.status = 'error'
      yield `❌ 技能执行失败: ${error instanceof Error ? error.message : String(error)}\n`
    }
  }

  private async *streamLLMResponse(message: string): AsyncGenerator<string> {
    // Call LLM API with streaming
    const response = await this.callLLMStream(message)

    for await (const chunk of response) {
      yield chunk
    }
  }

  private async callLLM(systemPrompt: string, userMessage: string, options?: { responseFormat?: 'json' }): Promise<string> {
    // Implementation depends on provider
    if (this.config.provider === 'openai') {
      return this.callOpenAI(systemPrompt, userMessage, options)
    } else {
      return this.callClaude(systemPrompt, userMessage)
    }
  }

  private async *callLLMStream(message: string): AsyncGenerator<string> {
    // Implementation for streaming responses
    // Similar to callLLM but with streaming support
  }

  private async callOpenAI(systemPrompt: string, userMessage: string, options?: { responseFormat?: 'json' }): Promise<string> {
    // Reuse logic from llmService.ts
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        ...(options?.responseFormat === 'json' && { response_format: { type: 'json_object' } }),
      }),
    })

    const json = await response.json()
    return json.choices[0].message.content
  }

  private async callClaude(systemPrompt: string, userMessage: string): Promise<string> {
    // Similar to callOpenAI but for Claude API
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 2000,
      }),
    })

    const json = await response.json()
    return json.content[0].text
  }

  getConversationHistory(): Message[] {
    return this.conversationHistory
  }

  clearConversation() {
    this.conversationHistory = []
  }
}
```

### Phase 5: Add Additional Skills

**Objective**: Extend agent capabilities beyond business analysis

**Skills to Implement:**

1. **Web Search Skill** (`web_search.rs`)
   - Use Tavily API or DuckDuckGo
   - Return summarized search results
   - Cite sources

2. **Report Generation Skill** (`report_generator.rs`)
   - Generate PDF reports with charts
   - Generate Excel exports
   - Save to app data directory
   - Return download path

3. **Data Export Skill** (`data_export.rs`)
   - Export query results to CSV/Excel
   - Support custom filters
   - Include metadata

4. **Insight Generation Skill** (`insight_generator.rs`)
   - Analyze data patterns
   - Generate actionable insights
   - Highlight anomalies and trends

### Phase 6: Memory and Context Management

**Objective**: Implement conversation memory and context awareness

**Features:**

1. **Conversation History**
   - Store in SQLite database (app data directory)
   - Include user messages, assistant responses, tool calls
   - Support conversation threads

2. **Context Window Management**
   - Summarize old messages when context limit approached
   - Keep recent messages in full detail
   - Preserve important context (user preferences, current analysis scope)

3. **User Preferences**
   - Remember preferred report type (fone/tuwei)
   - Remember preferred metrics
   - Remember preferred visualization style

4. **Session State**
   - Track current analysis context (period, node, metrics)
   - Allow follow-up questions without repeating context
   - Support "drill down" and "go back" commands

## File Structure

```
app/
├── src/
│   ├── pages/
│   │   ├── AiAnalysis.tsx          # Main page (redesigned with config integration)
│   │   └── Settings.tsx            # Existing settings page (no changes needed)
│   ├── components/
│   │   └── Agent/
│   │       ├── ChatInterface.tsx
│   │       ├── ConfigurationPrompt.tsx
│   │       ├── MessageBubble.tsx
│   │       ├── MessageList.tsx
│   │       ├── InputArea.tsx
│   │       ├── ToolExecutionIndicator.tsx
│   │       └── AnalysisResultCard.tsx
│   ├── services/
│   │   ├── agentService.ts         # Agent core service
│   │   ├── bizDataService.ts       # Existing (no changes)
│   │   └── agent/
│   │       ├── skills/
│   │       │   ├── businessAnalysisSkill.ts
│   │       │   ├── webSearchSkill.ts
│   │       │   ├── reportGeneratorSkill.ts
│   │       │   └── dataExportSkill.ts
│   │       └── tools/
│   │           └── tavilySearch.ts
│   └── lib/
│       ├── llmConfig.ts            # Existing (no changes)
│       └── llmService.ts           # Existing (may extend for streaming)
└── .env                            # Only Supabase config needed
```

## Dependencies

### TypeScript (package.json)
```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "react-syntax-highlighter": "^15.5.0"
  }
}
```

**No Rust dependencies needed** - Pure TypeScript implementation

## Configuration Integration with Settings Page

**重要变更**: 智能分析页面将直接使用设置页面中配置的 LLM 信息，无需额外的环境变量。

### Existing Settings Infrastructure

项目已有完整的 LLM 配置系统：

**配置文件:**
- `app/src/lib/llmConfig.ts` - LLM 配置管理（localStorage 持久化）
- `app/src/lib/llmService.ts` - LLM API 调用服务
- `app/src/pages/Settings.tsx` - 设置页面 UI

**支持的提供商:**
- OpenAI (gpt-4o-mini)
- Claude (claude-sonnet-4-20250514)

**配置项:**
- Provider (openai/claude)
- API URL (支持自定义代理)
- API Key
- Model Name
- Tavily Search API Key (可选，用于联网搜索)

**存储格式:**
```typescript
interface LLMConfigStore {
  provider: 'openai' | 'claude'
  tavilyApiKey?: string
  providers: {
    openai?: { apiUrl: string; apiKey: string; model: string }
    claude?: { apiUrl: string; apiKey: string; model: string }
  }
}
```

### Integration Strategy

智能分析页面将：

1. **读取配置**: 使用 `loadLLMConfig()` 从 localStorage 读取当前激活的 LLM 配置
2. **配置检查**: 如果未配置，显示引导用户前往设置页面的提示
3. **动态切换**: 监听设置页面的配置更新事件，实时切换模型
4. **复用服务**: 使用现有的 `llmService.ts` 进行 API 调用

### No Environment Variables Needed

由于配置存储在 localStorage，不需要任何环境变量。用户通过设置页面 UI 配置即可。

## Implementation Steps

### Step 1: Setup Agent Core (1-2 days)
- [ ] Create `agentService.ts` with core agent logic
- [ ] Implement skill registry and execution
- [ ] Add conversation memory (localStorage/IndexedDB)
- [ ] Extend `llmService.ts` for streaming support
- [ ] Add skill detection logic using LLM

### Step 2: Implement Business Analysis Skill (1-2 days)
- [ ] Create `businessAnalysisSkill.ts`
- [ ] Implement summary analysis (复用 bizDataService)
- [ ] Implement comparison analysis
- [ ] Implement drill-down analysis
- [ ] Add unit tests for data processing

### Step 3: Build Chat Interface with Config Integration (2-3 days)
- [ ] Create `ConfigurationPrompt.tsx` component
- [ ] Update `AiAnalysis.tsx` with config loading
- [ ] Implement `ChatInterface.tsx` component
- [ ] Add message rendering with markdown
- [ ] Build tool execution indicator
- [ ] Create analysis result card with charts
- [ ] Add storage event listener for config updates

### Step 4: Integrate Frontend and Backend (1 day)
- [ ] Connect React to AgentService
- [ ] Handle streaming responses with async generators
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Test end-to-end flow

### Step 5: Add Additional Skills (2-3 days)
- [ ] Implement web search skill (Tavily API)
- [ ] Implement report generation skill (client-side PDF)
- [ ] Implement data export skill (CSV/Excel)
- [ ] Register all skills in agent

### Step 6: Polish and Optimize (1-2 days)
- [ ] Add conversation history UI
- [ ] Implement context management
- [ ] Add user preferences
- [ ] Optimize performance
- [ ] Add comprehensive error handling
- [ ] Add "前往设置" quick link when config missing

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM API costs accumulate quickly | High | Implement rate limiting, cache responses, use cheaper models for simple queries |
| Streaming responses may have latency | Medium | Implement chunked streaming with backpressure, add timeout configuration |
| Complex data aggregation in Rust may be error-prone | High | Port logic incrementally, add comprehensive unit tests, validate against TypeScript implementation |
| Supabase RLS policies may block agent queries | Medium | Pass access_token properly, test with different user roles, add fallback error messages |
| Memory management may consume excessive storage | Low | Implement conversation pruning, set retention limits, compress old conversations |
| PDF/Excel generation may fail on large datasets | Medium | Implement pagination, add file size limits, stream to disk |

## Success Criteria

1. ✅ Agent initializes successfully on page load
2. ✅ User can send messages and receive streaming responses
3. ✅ Business analysis skill can query and analyze Supabase data
4. ✅ Analysis results are displayed with charts and tables
5. ✅ Tool execution status is visible to user
6. ✅ Conversation history is persisted and retrievable
7. ✅ Reports can be generated and downloaded
8. ✅ No auth tokens are leaked in logs or error messages
9. ✅ Response time < 3s for simple queries, < 10s for complex analysis
10. ✅ UI is responsive and handles errors gracefully

## Testing Strategy

### Unit Tests (Rust)
- Test data aggregation logic
- Test Supabase query functions
- Test skill parameter parsing
- Test memory management

### Integration Tests (Rust)
- Test Tauri command invocation
- Test skill execution with mock LLM
- Test streaming response handling

### E2E Tests (Playwright)
- Test full chat flow from UI to agent
- Test business analysis queries
- Test report generation and download
- Test error scenarios

### Performance Tests
- Measure streaming latency
- Measure memory usage during long conversations
- Measure data aggregation performance with large datasets

## Architecture Decision: TypeScript-Only Implementation

**Selected Approach**: Pure TypeScript implementation (Alternative 1)

**Rationale:**
1. ✅ **复用现有基础设施**: 已有完整的 `llmConfig.ts` 和 `llmService.ts`
2. ✅ **与设置页面无缝集成**: 直接使用 localStorage 配置，无需环境变量
3. ✅ **快速开发**: TypeScript 开发速度快，便于迭代
4. ✅ **数据处理复用**: 直接使用 `bizDataService.ts` 的聚合逻辑
5. ✅ **无需 Tauri 后端改动**: 纯前端实现，降低复杂度

**Trade-offs:**
- ⚠️ 性能略低于 Rust（但对于当前数据量足够）
- ⚠️ 内存占用稍高（可通过优化缓解）

**Future Migration Path:**
如果未来性能成为瓶颈，可以将数据密集型操作（如大规模聚合）迁移到 Rust，保持 Agent 逻辑在 TypeScript。

## Next Steps

1. **User Confirmation**: Review this plan and confirm approach
2. **Prototype**: Build a minimal agent with one skill to validate architecture
3. **Iterate**: Implement skills incrementally, testing each one
4. **Polish**: Add UI polish, error handling, and optimization
5. **Deploy**: Test with real users and gather feedback

---

**Estimated Total Time**: 8-12 days (1.5-2 weeks)

**Priority**: High (core feature for intelligent analysis)

**Dependencies**:
- ✅ Supabase data access (already configured)
- ✅ LLM API access via Settings page (OpenAI or Anthropic)
- ⚠️ Optional: Tavily Search API (configured in Settings page)

**Key Advantages of This Approach:**
1. **零配置启动**: 用户只需在设置页面配置一次 LLM，即可使用智能分析
2. **配置统一管理**: 所有 AI 相关配置集中在设置页面
3. **实时配置切换**: 用户可以在设置页面切换 OpenAI/Claude，智能分析页面自动更新
4. **开发效率高**: 纯 TypeScript 实现，无需 Rust 编译，调试方便
5. **代码复用**: 最大化复用现有的 `bizDataService.ts` 和 `llmService.ts`

---

## Sources

Research for this plan was conducted using the following sources:

- [The Practical Guide to OpenClaw: Your Self-Hosted AI Assistant 2026](https://nerdleveltech.com/guides/openclaw-personal-ai-assistant)
- [Autonomous LLM Systems](https://www.emergentmind.com/topics/openclaw-agents)
- [OpenClaw: The Definitive Guide to the Autonomous AI Agent Revolution in 2026](https://www.optimum-web.com/blog/openclaw-autonomous-ai-agent-revolution-2026)
- [Ultimate Guide for Those Just Starting with AI Agents](https://cyberstrategyinstitute.com/openclaw-architecture-for-beginners-jan-2026/)
- [OpenClaw Architecture and Rapid Scaling](https://micheallanham.substack.com/p/openclaw-architecture-and-rapid-scaling)
- [How OpenClaw Works: Architecture, Skills, and Security Explained](https://www.mintmcp.com/blog/openclaw-works-architecture-skills-security)
- [OpenClaw Architecture, Explained](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)
