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

// Tools
export { queryBizDataTool } from './tools/queryBizData'
export { queryWithHierarchyTool } from './tools/queryWithHierarchy'
export { queryMonthlyPlanTool } from './tools/queryMonthlyPlan'
export { resolveOrgNodesTool } from './tools/resolveOrgNodes'
export { readFileTool } from './tools/readFile'
export { resolveTools, getAvailableToolNames } from './tools/toolRegistry'

// Conversation store
export {
  loadConversations,
  saveConversations,
  createConversation,
  deleteConversation,
  getStorageKey,
} from './conversationStore'
export {
  buildConversationMemoryBlock,
  compactConversation,
  getRecentMessagesForPrompt,
} from './conversationMemory'
export {
  loadArtifactPayloads,
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
