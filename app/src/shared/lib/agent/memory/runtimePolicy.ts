export const MEMORY_TOOL_NAMES = [
  'recall_memory',
  'store_memory',
  'forget_memory',
  'list_memory_namespaces',
  'fetch_memory_source',
] as const

export const MEMORY_AUTO_NAMESPACES = [
  'working.user.preference',
  'working.user.profile',
  'high.preference',
  'high.decision',
  'high.business_context',
]

export const MEMORY_RUNTIME_CONTRACT = [
  '## Memory Runtime Contract',
  '- Long-term memory is a shared runtime capability available to every agent.',
  '- Use recall_memory when user preferences, prior decisions, profile context, or historical business context may affect the answer.',
  '- Store memory only when the user explicitly asks you to remember something or states a durable preference/decision.',
  '- Forget memory only when the user explicitly asks to forget it or provides a memory id for deletion.',
  '- Do not expose internal memory ids unless the user is managing memory.',
].join('\n')
