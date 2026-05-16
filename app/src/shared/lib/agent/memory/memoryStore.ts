import { invokeTauri, isTauriRuntime } from '@/shared/lib/tauri'
import type {
  AssistantMemoryEntry,
  AssistantMemoryHealth,
  AssistantMemoryInput,
  AssistantMemoryRecallQuery,
  AssistantMemoryRecallResult,
  AssistantMemorySource,
} from './types'

function assertTauriMemoryAvailable() {
  if (!isTauriRuntime()) {
    throw new Error('长期记忆仅支持本地客户端，请在桌面端使用。')
  }
}

export async function storeAssistantMemory(input: AssistantMemoryInput): Promise<AssistantMemoryEntry> {
  assertTauriMemoryAvailable()
  return invokeTauri<AssistantMemoryEntry>('assistant_memory_store', { input })
}

export async function recallAssistantMemory(
  query: AssistantMemoryRecallQuery,
): Promise<AssistantMemoryRecallResult[]> {
  assertTauriMemoryAvailable()
  return invokeTauri<AssistantMemoryRecallResult[]>('assistant_memory_recall', { query })
}

export async function getAssistantMemory(memoryId: string): Promise<AssistantMemoryEntry | null> {
  assertTauriMemoryAvailable()
  return invokeTauri<AssistantMemoryEntry | null>('assistant_memory_get', { memoryId })
}

export async function getAssistantMemorySource(memoryId: string): Promise<AssistantMemorySource | null> {
  assertTauriMemoryAvailable()
  return invokeTauri<AssistantMemorySource | null>('assistant_memory_get_source', { memoryId })
}

export async function forgetAssistantMemory(memoryId: string): Promise<void> {
  assertTauriMemoryAvailable()
  await invokeTauri('assistant_memory_forget', { memoryId })
}

export async function listAssistantMemoryNamespaces(): Promise<string[]> {
  assertTauriMemoryAvailable()
  return invokeTauri<string[]>('assistant_memory_list_namespaces')
}

export async function getAssistantMemoryHealth(): Promise<AssistantMemoryHealth> {
  assertTauriMemoryAvailable()
  return invokeTauri<AssistantMemoryHealth>('assistant_memory_health')
}
