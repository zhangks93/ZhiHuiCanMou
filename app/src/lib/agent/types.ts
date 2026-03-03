export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      enum?: string[]
    }>
    required?: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AgentStep {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'answer' | 'error'
  content: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]
  timestamp: number
}

export interface LLMResponse {
  text: string | null
  toolCalls: ToolCall[]
  reasoningContent?: string | null
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface AgentMemory {
  id: string
  content: string
  category: 'insight' | 'conclusion' | 'anomaly' | 'trend'
  keywords: string[]
  sessionId: string
  createdAt: number
}

// Internal conversation messages for the agent loop
export type AgentLLMMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[]; reasoningContent?: string | null }
  | { role: 'tool'; toolCallId: string; name: string; content: string }
