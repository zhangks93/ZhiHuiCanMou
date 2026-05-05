import type { ChatMessage, Conversation, ConversationArtifact, ConversationMemory, ToolCallRecord } from './types'

const MAX_PROMPT_MESSAGES = 8
const MAX_STORED_MESSAGES = 20
const MAX_SUMMARY_CHARS = 3200
const MAX_CONTENT_SNIPPET = 240
const MAX_SUMMARY_LINES = 12
const MAX_ARTIFACTS = 24
const MAX_ARTIFACT_PAYLOAD = 50000
const MAX_BUSINESS_REPORT_PACK_ARTIFACT_PAYLOAD = 1000000
const MAX_MEMORY_ARTIFACT_LINES = 4
const MAX_QUERY_TOKENS = 12

function cleanText(value: string | undefined, maxChars = MAX_CONTENT_SNIPPET): string | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned) return undefined
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}...` : cleaned
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function truncateSummary(summary: string): string {
  if (summary.length <= MAX_SUMMARY_CHARS) return summary
  return `[earlier_summary_truncated]\n${summary.slice(-MAX_SUMMARY_CHARS)}`
}

function tokenize(text: string | undefined): string[] {
  if (!text) return []
  return Array.from(new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}_]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  )).slice(0, MAX_QUERY_TOKENS)
}

function summarizeArchivedMessages(messages: ChatMessage[]): string {
  if (!messages.length) return ''

  const userGoals: string[] = []
  const assistantFindings: string[] = []
  const toolNames = new Set<string>()

  for (const message of messages) {
    const content = cleanText(message.content)

    if (message.role === 'user' && content) {
      userGoals.push(content)
    }

    if (message.role === 'assistant' && content) {
      assistantFindings.push(content)
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      for (const name of unique(message.toolCalls.map((toolCall) => toolCall.name))) {
        toolNames.add(name)
      }
    }

    if (userGoals.length + assistantFindings.length >= MAX_SUMMARY_LINES) break
  }

  const lines: string[] = ['## Conversation Summary']
  if (userGoals.length) {
    lines.push('### User Goals')
    for (const goal of userGoals.slice(-4)) {
      lines.push(`- ${goal}`)
    }
  }
  if (assistantFindings.length) {
    lines.push('### Key Findings')
    for (const finding of assistantFindings.slice(-4)) {
      lines.push(`- ${finding}`)
    }
  }
  if (toolNames.size) {
    lines.push('### Tools Used')
    lines.push(`- ${Array.from(toolNames).join(', ')}`)
  }

  return lines.join('\n')
}

function buildArtifactTitle(toolCall: ToolCallRecord): string {
  const args = Object.entries(toolCall.arguments)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .slice(0, 2)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ')

  return args ? `${toolCall.name} (${args})` : toolCall.name
}

function buildArtifactSummary(toolCall: ToolCallRecord): string {
  return cleanText(toolCall.result, 320) || `${toolCall.name} result captured`
}

function shouldCaptureArtifact(toolCall: ToolCallRecord): boolean {
  if (toolCall.status !== 'success' || !toolCall.result) return false
  if (toolCall.name === 'read_file') return true
  return toolCall.result.length > 600 || ['query_with_hierarchy', 'query_business_report_pack', 'query_biz_data', 'resolve_org_nodes'].includes(toolCall.name)
}

function upsertArtifacts(
  previousArtifacts: ConversationArtifact[] | undefined,
  assistantMessage: ChatMessage | undefined,
): { artifacts: ConversationArtifact[] | undefined; toolCalls: ToolCallRecord[] | undefined } {
  if (!assistantMessage?.toolCalls?.length) {
    return {
      artifacts: previousArtifacts,
      toolCalls: assistantMessage?.toolCalls,
    }
  }

  const nextArtifacts = [...(previousArtifacts || [])]
  const nextToolCalls = assistantMessage.toolCalls.map((toolCall) => {
    if (!shouldCaptureArtifact(toolCall)) {
      return toolCall
    }

    const artifactId = toolCall.artifactId || crypto.randomUUID()
    const payloadMaxChars = toolCall.name === 'query_business_report_pack'
      ? MAX_BUSINESS_REPORT_PACK_ARTIFACT_PAYLOAD
      : MAX_ARTIFACT_PAYLOAD
    const artifact: ConversationArtifact = {
      id: artifactId,
      toolName: toolCall.name,
      title: buildArtifactTitle(toolCall),
      summary: buildArtifactSummary(toolCall),
      payload: cleanText(toolCall.result, payloadMaxChars),
      createdAt: Date.now(),
      sourceMessageId: assistantMessage.id,
    }

    const existingIndex = nextArtifacts.findIndex((item) => item.id === artifactId)
    if (existingIndex >= 0) {
      nextArtifacts[existingIndex] = artifact
    } else {
      nextArtifacts.unshift(artifact)
    }

    return {
      ...toolCall,
      artifactId,
      result: cleanText(toolCall.result, 800),
    }
  })

  return {
    artifacts: nextArtifacts.slice(0, MAX_ARTIFACTS),
    toolCalls: nextToolCalls,
  }
}

function buildTaskState(messages: ChatMessage[], previous?: ConversationMemory['taskState']): ConversationMemory['taskState'] {
  const latestUser = [...messages].reverse().find((message) => message.role === 'user')
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const assistantToolCalls = latestAssistant?.toolCalls || []

  const loadedReferences = unique([
    ...(previous?.loadedReferences || []),
    ...assistantToolCalls
      .filter((toolCall) => toolCall.status === 'success' && toolCall.name === 'read_file')
      .map((toolCall) => {
        const path = toolCall.arguments.path
        return typeof path === 'string' ? path : undefined
      }),
  ]).sort()

  const lastToolNames = unique(assistantToolCalls.map((toolCall) => toolCall.name))

  return {
    currentTask: cleanText(latestUser?.content),
    latestAssistantSummary: cleanText(latestAssistant?.content, 320),
    loadedReferences: loadedReferences.length ? loadedReferences : previous?.loadedReferences,
    lastToolNames: lastToolNames.length ? lastToolNames : previous?.lastToolNames,
  }
}

function mergeRollingSummary(previousSummary: string | undefined, archivedMessages: ChatMessage[]): string | undefined {
  const newChunk = summarizeArchivedMessages(archivedMessages)
  if (!newChunk) return previousSummary
  return truncateSummary([previousSummary, newChunk].filter(Boolean).join('\n\n'))
}

function scoreArtifactRelevance(artifact: ConversationArtifact, query: string | undefined): number {
  const queryTokens = tokenize(query)
  if (!queryTokens.length) {
    return artifact.createdAt
  }

  const haystack = `${artifact.title} ${artifact.summary} ${artifact.toolName}`.toLowerCase()
  let score = 0

  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 10
    }
  }

  if (haystack.includes('read_file') && queryTokens.some((token) => ['模板', 'report', 'workflow', 'metrics', 'reference'].includes(token))) {
    score += 5
  }

  return score * 1_000_000_000 + artifact.createdAt
}

function selectRelevantArtifacts(artifacts: ConversationArtifact[] | undefined, query?: string): ConversationArtifact[] {
  if (!artifacts?.length) return []
  return [...artifacts]
    .sort((a, b) => scoreArtifactRelevance(b, query) - scoreArtifactRelevance(a, query))
    .slice(0, MAX_MEMORY_ARTIFACT_LINES)
}

export function buildConversationMemoryBlock(memory?: ConversationMemory, query?: string): string {
  if (!memory) return ''

  const lines: string[] = []

  if (memory.rollingSummary) {
    lines.push(memory.rollingSummary)
  }

  const taskState = memory.taskState
  if (taskState) {
    lines.push('## Active Task State')
    if (taskState.currentTask) {
      lines.push(`- current_task: ${taskState.currentTask}`)
    }
    if (taskState.latestAssistantSummary) {
      lines.push(`- latest_assistant_summary: ${taskState.latestAssistantSummary}`)
    }
    if (taskState.loadedReferences?.length) {
      lines.push(`- loaded_references: ${taskState.loadedReferences.join(', ')}`)
    }
    if (taskState.lastToolNames?.length) {
      lines.push(`- recent_tools: ${taskState.lastToolNames.join(', ')}`)
    }
    lines.push('- note: prefer this memory block over re-reading older chat turns unless the user explicitly changes direction.')
  }

  const relevantArtifacts = selectRelevantArtifacts(memory.artifacts, query)
  if (relevantArtifacts.length) {
    lines.push('## Relevant Retrieved Artifacts')
    for (const artifact of relevantArtifacts) {
      lines.push(`- ${artifact.title}: ${artifact.summary}`)
    }
    lines.push('- note: these are the most relevant prior large-tool summaries for the current user request; reuse them before repeating the same heavy query.')
  }

  return lines.join('\n')
}

export function getRecentMessagesForPrompt(messages: ChatMessage[], limit = MAX_PROMPT_MESSAGES): ChatMessage[] {
  return messages.slice(-limit)
}

export function compactConversation(conversation: Conversation): Conversation {
  const { messages, memory } = conversation
  const latestAssistantIndex = [...messages].reverse().findIndex((message) => message.role === 'assistant')
  const latestAssistant = latestAssistantIndex >= 0
    ? messages[messages.length - 1 - latestAssistantIndex]
    : undefined
  const artifactUpdate = upsertArtifacts(memory?.artifacts, latestAssistant)
  const normalizedMessages = latestAssistant
    ? messages.map((message) => {
        if (message.id !== latestAssistant.id) return message
        return {
          ...message,
          toolCalls: artifactUpdate.toolCalls,
        }
      })
    : messages

  if (normalizedMessages.length <= MAX_STORED_MESSAGES) {
    return {
      ...conversation,
      messages: normalizedMessages,
      memory: {
        version: 1,
        rollingSummary: memory?.rollingSummary,
        taskState: buildTaskState(normalizedMessages, memory?.taskState),
        artifacts: artifactUpdate.artifacts,
        lastCompactedAt: memory?.lastCompactedAt,
      },
    }
  }

  const archivedMessages = normalizedMessages.slice(0, normalizedMessages.length - MAX_STORED_MESSAGES)
  const recentMessages = normalizedMessages.slice(-MAX_STORED_MESSAGES)

  return {
    ...conversation,
    messages: recentMessages,
    memory: {
      version: 1,
      rollingSummary: mergeRollingSummary(memory?.rollingSummary, archivedMessages),
      taskState: buildTaskState(recentMessages, memory?.taskState),
      artifacts: artifactUpdate.artifacts,
      lastCompactedAt: Date.now(),
    },
  }
}
