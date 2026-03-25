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

/** Agent icon type - can be emoji or icon component */
export interface AgentIcon {
  type: 'emoji' | 'lucide'
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
  /** List of tool definitions available to this agent */
  tools: RegisteredTool[]
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
