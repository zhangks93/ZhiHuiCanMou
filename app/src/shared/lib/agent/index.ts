// lib/agent barrel export

export { ChatAgent } from './chatAgent'

// Agent registry
export {
  agentRegistry,
  getAgent,
  getEnabledAgents,
  hasAgent,
  getDefaultAgent,
  getAgentCount,
} from './registry'

// Skills (loaded agent definitions)
export { financialAnalysisAgent, allSkills } from './skills'

// Skill loader
export { loadSkill } from './skills/loader'
export type { SkillConfig } from './skills/loader'

// Conversation store
export {
  loadConversations,
  saveConversations,
  deletePersistedConversation,
  createConversation,
  deleteConversation,
} from './conversationStore'
export {
  buildConversationMemoryBlock,
  compactConversation,
  getRecentMessagesForPrompt,
} from './conversationMemory'
export {
  getArtifactPayloadById,
} from './artifactStore'

// Types
export type {
  ChatMessage,
  ToolCallRecord,
  ToolDefinition,
  RegisteredTool,
  Conversation,
  ConversationMemory,
  ConversationArtifact,
  ArtifactPayloadRecord,
  ConversationTaskState,
  ConversationContext,
  FinancialAnalysisSessionContext,
  FinancialAnalysisRuntimeDataContext,
  FinancialAnalysisRuntimeMetric,
  ChatStreamChunk,
  AgentDefinition,
  AgentIcon,
  AgentRegistry,
} from './types'
