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
        items?: { type: string }
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
  createdAt: number
  updatedAt: number
}
