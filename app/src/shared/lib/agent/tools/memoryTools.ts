import type { RegisteredTool } from '@/shared/lib/agent/types'
import {
  forgetAssistantMemory,
  getAssistantMemorySource,
  listAssistantMemoryNamespaces,
  recallAssistantMemory,
  storeAssistantMemory,
} from '@/shared/lib/agent/memory/memoryStore'
import type { MemoryCategory } from '@/shared/lib/agent/memory/types'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

function asCategories(value: unknown): MemoryCategory[] | undefined {
  const values = asStringArray(value)
  if (!values) return undefined
  return values.filter((item): item is MemoryCategory =>
    item === 'core' || item === 'daily' || item === 'conversation' || item === 'custom'
  )
}

export const recallMemoryTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'Search local long-term assistant memory for user preferences, decisions, prior context, and saved facts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query.' },
          namespaces: {
            type: 'array',
            description: 'Optional memory namespaces such as working.user.preference or high.business_context.',
            items: { type: 'string' },
          },
          categories: {
            type: 'array',
            description: 'Optional categories to search.',
            items: { type: 'string', enum: ['core', 'daily', 'conversation', 'custom'] },
          },
          limit: { type: 'number', description: 'Maximum number of memory records to return.' },
        },
        required: ['query'],
      },
    },
  },
  async execute(args) {
    const results = await recallAssistantMemory({
      query: asString(args.query),
      namespaces: asStringArray(args.namespaces),
      categories: asCategories(args.categories),
      limit: typeof args.limit === 'number' ? args.limit : 6,
    })
    return JSON.stringify({
      memories: results.map((result) => ({
        id: result.entry.id,
        namespace: result.entry.namespace,
        category: result.entry.category,
        title: result.entry.title,
        snippet: result.snippet,
        score: result.score,
        tags: result.entry.tags,
      })),
    }, null, 2)
  },
}

export const storeMemoryTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'store_memory',
      description: 'Store a durable local memory when the user explicitly asks you to remember something.',
      parameters: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Namespace, e.g. working.user.preference or high.decision.' },
          category: { type: 'string', description: 'Memory category.', enum: ['core', 'daily', 'conversation', 'custom'] },
          title: { type: 'string', description: 'Short memory title.' },
          content: { type: 'string', description: 'Full memory content.' },
          importance: { type: 'number', description: '0-100 importance score.' },
          tags: { type: 'array', description: 'Optional tags.', items: { type: 'string' } },
        },
        required: ['namespace', 'category', 'title', 'content'],
      },
    },
  },
  async execute(args) {
    const entry = await storeAssistantMemory({
      namespace: asString(args.namespace),
      category: asString(args.category, 'core') as MemoryCategory,
      title: asString(args.title),
      content: asString(args.content),
      importance: typeof args.importance === 'number' ? args.importance : 70,
      tags: asStringArray(args.tags),
    })
    return JSON.stringify({ stored: true, id: entry.id, namespace: entry.namespace, title: entry.title }, null, 2)
  },
}

export const forgetMemoryTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'forget_memory',
      description: 'Delete a local memory by id after the user explicitly asks to forget it.',
      parameters: {
        type: 'object',
        properties: {
          memory_id: { type: 'string', description: 'Memory id returned by recall_memory.' },
        },
        required: ['memory_id'],
      },
    },
  },
  async execute(args) {
    await forgetAssistantMemory(asString(args.memory_id))
    return JSON.stringify({ forgotten: true, id: asString(args.memory_id) }, null, 2)
  },
}

export const listMemoryNamespacesTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'list_memory_namespaces',
      description: 'List available local memory namespaces.',
      parameters: { type: 'object', properties: {} },
    },
  },
  async execute() {
    const namespaces = await listAssistantMemoryNamespaces()
    return JSON.stringify({ namespaces }, null, 2)
  },
}

export const fetchMemorySourceTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'fetch_memory_source',
      description: 'Fetch full source content for a memory id.',
      parameters: {
        type: 'object',
        properties: {
          memory_id: { type: 'string', description: 'Memory id returned by recall_memory.' },
        },
        required: ['memory_id'],
      },
    },
  },
  async execute(args) {
    const source = await getAssistantMemorySource(asString(args.memory_id))
    return JSON.stringify(source || { found: false }, null, 2)
  },
}

export const memoryTools = [
  recallMemoryTool,
  storeMemoryTool,
  forgetMemoryTool,
  listMemoryNamespacesTool,
  fetchMemorySourceTool,
]
