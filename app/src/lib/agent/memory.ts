import type { ChatSession, AgentMemory, ChatMessage } from './types'

const SESSIONS_KEY = 'chat_sessions'
const SESSION_MSG_PREFIX = 'chat_session_'
const MEMORIES_KEY = 'agent_memories'

// --- Session CRUD ---

export function loadSessions(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
  } catch { return [] }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function saveSession(session: ChatSession, messages: ChatMessage[]) {
  const sessions = loadSessions()
  const idx = sessions.findIndex(s => s.id === session.id)
  if (idx >= 0) sessions[idx] = session
  else sessions.unshift(session)
  saveSessions(sessions)
  localStorage.setItem(SESSION_MSG_PREFIX + session.id, JSON.stringify(messages))
}

export function loadSessionMessages(id: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(SESSION_MSG_PREFIX + id) || '[]')
  } catch { return [] }
}

export function deleteSession(id: string) {
  saveSessions(loadSessions().filter(s => s.id !== id))
  localStorage.removeItem(SESSION_MSG_PREFIX + id)
}

// --- Memory CRUD ---

export function loadMemories(): AgentMemory[] {
  try {
    return JSON.parse(localStorage.getItem(MEMORIES_KEY) || '[]')
  } catch { return [] }
}

function saveMemories(memories: AgentMemory[]) {
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories))
}

export function saveMemory(memory: AgentMemory) {
  const memories = loadMemories()
  memories.unshift(memory)
  saveMemories(memories)
}

export function deleteMemory(id: string) {
  saveMemories(loadMemories().filter(m => m.id !== id))
}

export function searchMemories(query: string): AgentMemory[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return loadMemories().filter(m => {
    const text = (m.content + ' ' + m.keywords.join(' ')).toLowerCase()
    return terms.some(t => text.includes(t))
  })
}
