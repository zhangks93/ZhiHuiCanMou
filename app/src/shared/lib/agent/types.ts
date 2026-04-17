// Agent Core Types

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  /** Tool calls made during this message (assistant only) */
  toolCalls?: ToolCallRecord[]
  /** If this message is still being streamed */
  streaming?: boolean
  /** Thinking/reasoning content (from reasoning models) */
  thinking?: string
}

/** Yield types from ChatAgent.chat() AsyncGenerator */
export type ChatStreamChunk =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; toolCall: ToolCallRecord }
  | { type: 'tool_result'; toolCall: ToolCallRecord }

export interface ToolCallRecord {
  id: string
  name: string
  arguments: Record<string, unknown>
  status: 'calling' | 'success' | 'error'
  result?: string
  error?: string
  artifactId?: string
}

export interface FinancialAnalysisRuntimeMetric {
  key: string
  label?: string
}

export interface FinancialAnalysisRuntimeDataContext {
  latestMonthlyPeriod?: string
  latestCumulativePeriod?: string
  monthlyPeriods: string[]
  cumulativePeriods: string[]
  monthlyPlanMonths: string[]
  reportTypes: string[]
  metrics: FinancialAnalysisRuntimeMetric[]
  orgLevel1: string[]
  sheetCodes: { code: string; label: string }[]
  fetchedAt: number
}

export interface FinancialAnalysisSessionContext {
  scope?: {
    mode?: 'node_name' | 'level_1' | 'level_2' | 'all'
    nodeNames?: string[]
    level_0?: string
    level_1?: string
    level_2?: string
    confidence?: 'high' | 'medium' | 'low'
  }
  time?: {
    periodType?: 'monthly' | 'cumulative'
    period?: string
    comparePeriod?: string
    confidence?: 'high' | 'medium' | 'low'
  }
  reportType?: 'fone' | 'tuwei'
  intent?: {
    goal?: 'data_lookup' | 'exception_scan' | 'comparison' | 'report' | 'trend' | 'plan_vs_actual' | 'qa'
  }
  metrics?: {
    primary?: string[]
    secondary?: string[]
  }
  reportMode?: {
    templateLoaded?: boolean
    templatePath?: string
    workflowLoaded?: boolean
    metricsLoaded?: boolean
    reportGenerationLoaded?: boolean
    analysisMethodLoaded?: boolean
    chartGuidanceLoaded?: boolean
    loadedPaths?: string[]
    chartOutputMode?: 'structured_chart_spec_json'
  }
  dataContext?: FinancialAnalysisRuntimeDataContext
  lastResolvedAt: number
}

export interface ConversationTaskState {
  currentTask?: string
  latestAssistantSummary?: string
  loadedReferences?: string[]
  lastToolNames?: string[]
}

export interface ConversationArtifact {
  id: string
  toolName: string
  title: string
  summary: string
  payload?: string
  payloadRef?: string
  createdAt: number
  sourceMessageId: string
}

export interface ArtifactPayloadRecord {
  id: string
  artifactId: string
  conversationId: string
  payload: string
  toolName: string
  createdAt: number
}

export interface ConversationMemory {
  version: 1
  rollingSummary?: string
  taskState?: ConversationTaskState
  artifacts?: ConversationArtifact[]
  lastCompactedAt?: number
}

export interface ConversationContext {
  version: 1
  financialAnalysis?: FinancialAnalysisSessionContext
}

/** OpenAI-compatible function/tool definition */
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, {
        type: string
        description: string
        enum?: string[]
        items?: { type: string; enum?: string[] }
        minItems?: number
      }>
      required?: string[]
    }
  }
}

/** Tool executor function */
export type ToolExecutor = (args: Record<string, unknown>) => Promise<string>

/** Registered tool = definition + executor */
export interface RegisteredTool {
  definition: ToolDefinition
  execute: ToolExecutor
}

/** Conversation session */
export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  memory?: ConversationMemory
  context?: ConversationContext
  createdAt: number
  updatedAt: number
}

/** Agent icon type - can be emoji or icon component */
export interface AgentIcon {
  type: 'emoji' | 'lucide' | 'image'
  value: string
}

/** Agent definition configuration */
export interface AgentDefinition {
  /** Unique identifier for the agent */
  id: string
  /** Display name */
  name: string
  /** Brief description shown in agent selector */
  description: string
  /** Extended description shown in empty states */
  tagline?: string
  /** Icon configuration */
  icon: AgentIcon
  /** System prompt for this agent */
  systemPrompt: string
  /** Tool names declared by the skill; runtime modules resolve/register implementations lazily */
  tools: string[]
  /** Quick prompt suggestions shown in empty state */
  quickPrompts: string[]
  /** Accent color for the agent (CSS variable or hex) */
  color: string
  /** Whether the agent is enabled */
  enabled?: boolean
}

/** Registry of all available agents */
export interface AgentRegistry {
  /** Map of agent ID to agent definition */
  agents: Record<string, AgentDefinition>
  /** Default agent ID when no agent is selected */
  defaultAgentId: string
}
