import type { ChatSession, AgentMemory, ChatMessage } from './types'

const SESSIONS_KEY = 'chat_sessions'
const SESSION_MSG_PREFIX = 'chat_session_'
const MEMORIES_KEY = 'agent_memories'
const MAX_MEMORIES = 200
const MEMORY_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

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

/**
 * Similarity score between a candidate and existing memories.
 * Returns 0-1: 1 = identical, 0 = no overlap.
 */
function similarityScore(a: AgentMemory, b: AgentMemory): number {
  const aWords = new Set((a.content + ' ' + a.keywords.join(' ')).toLowerCase().split(/\W+/).filter(w => w.length > 1))
  const bWords = new Set((b.content + ' ' + b.keywords.join(' ')).toLowerCase().split(/\W+/).filter(w => w.length > 1))
  if (!aWords.size || !bWords.size) return 0
  let overlap = 0
  for (const w of aWords) { if (bWords.has(w)) overlap++ }
  return overlap / Math.max(aWords.size, bWords.size)
}

export function saveMemory(memory: AgentMemory) {
  let memories = loadMemories()

  // 1. Dedup: skip if a very similar memory already exists (>70% overlap)
  const isDuplicate = memories.some(m => similarityScore(m, memory) > 0.7)
  if (isDuplicate) return

  // 2. Prepend
  memories.unshift(memory)

  // 3. Evict: remove expired entries first, then cap at MAX_MEMORIES
  const cutoff = Date.now() - MEMORY_TTL_MS
  memories = memories.filter(m => m.createdAt > cutoff)
  if (memories.length > MAX_MEMORIES) {
    memories = memories.slice(0, MAX_MEMORIES)
  }

  saveMemories(memories)
}

export function deleteMemory(id: string) {
  saveMemories(loadMemories().filter(m => m.id !== id))
}

/**
 * Search memories by keyword with weighted scoring:
 * - Each term that matches scores +1 per hit (content hit = 2, keyword hit = 1)
 * - Results sorted by score descending
 */
export function searchMemories(query: string): AgentMemory[] {
  const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 1)
  if (!terms.length) return []

  const memories = loadMemories()
  const scored = memories.map(m => {
    const contentLower = m.content.toLowerCase()
    const keywordsLower = m.keywords.join(' ').toLowerCase()
    let score = 0
    for (const t of terms) {
      if (contentLower.includes(t)) score += 2
      if (keywordsLower.includes(t)) score += 1
    }
    return { memory: m, score }
  })

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ memory }) => memory)
    .slice(0, 10)
}

/**
 * Trim conversation history to keep a rolling window.
 * Keeps the first system-context message (if any) + last N user/assistant turns.
 * Tool result messages inside trimmed turns are also dropped.
 */
export function trimHistory<T extends { role: string }>(
  history: T[],
  maxTurns = 6,
): T[] {
  // A "user turn" = one user message + its assistant reply
  // We walk backward from the end, collecting pairs
  const result: T[] = []
  let turns = 0

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    result.unshift(msg)
    if (msg.role === 'user') {
      turns++
      if (turns >= maxTurns) break
    }
  }

  return result
}
