export type MemoryCategory = 'core' | 'daily' | 'conversation' | 'custom'

export interface AssistantMemoryInput {
  namespace: string
  category: MemoryCategory
  title: string
  content: string
  importance?: number
  sourceAgentId?: string
  sourceConversationId?: string
  sourceMessageId?: string
  tags?: string[]
}

export interface AssistantMemoryEntry {
  id: string
  namespace: string
  category: MemoryCategory
  title: string
  content: string
  importance: number
  sourceAgentId?: string | null
  sourceConversationId?: string | null
  sourceMessageId?: string | null
  contentSha: string
  filePath: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface AssistantMemoryRecallQuery {
  query: string
  namespaces?: string[]
  categories?: MemoryCategory[]
  limit?: number
}

export interface AssistantMemoryRecallResult {
  entry: AssistantMemoryEntry
  score: number
  snippet: string
}

export interface AssistantMemorySource {
  memoryId: string
  content: string
  filePath: string
  contentSha: string
}

export interface AssistantMemoryHealth {
  memoryCount: number
  sourceCount: number
  vaultPath: string
}
