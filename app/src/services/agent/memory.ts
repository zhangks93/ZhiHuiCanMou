// Conversation Memory Management

import type { Message } from './types'

const MEMORY_KEY = 'agent_conversation_history'
const MAX_MESSAGES = 100 // Maximum messages to keep in memory

export class ConversationMemory {
  private messages: Message[] = []

  constructor() {
    this.loadFromStorage()
  }

  addMessage(message: Message) {
    this.messages.push(message)

    // Prune old messages if exceeding limit
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES)
    }

    this.saveToStorage()
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  getRecentMessages(count: number): Message[] {
    return this.messages.slice(-count)
  }

  clear() {
    this.messages = []
    this.saveToStorage()
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(MEMORY_KEY)
      if (stored) {
        this.messages = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error)
      this.messages = []
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(this.messages))
    } catch (error) {
      console.error('Failed to save conversation history:', error)
    }
  }

  // Build context for LLM from recent messages
  buildContext(maxMessages: number = 10): string {
    const recent = this.getRecentMessages(maxMessages)
    return recent
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')
  }
}
