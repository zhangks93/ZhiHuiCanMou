import { recallAssistantMemory } from './memoryStore'
import { MEMORY_AUTO_NAMESPACES, MEMORY_RUNTIME_CONTRACT } from './runtimePolicy'

const MAX_AUTO_MEMORY_RESULTS = 6
const MAX_AUTO_MEMORY_CHARS = 1800

export async function buildLongTermMemoryBlock(params: {
  latestUserQuery?: string
}): Promise<string> {
  const { latestUserQuery } = params

  try {
    const results = await recallAssistantMemory({
      query: latestUserQuery?.trim() || 'preference decision profile context',
      namespaces: MEMORY_AUTO_NAMESPACES,
      categories: ['core', 'custom', 'conversation'],
      limit: MAX_AUTO_MEMORY_RESULTS,
    })

    const lines: string[] = [
      MEMORY_RUNTIME_CONTRACT,
      '## Long-term Local Memory',
      '- These are selected high-signal memories from local storage.',
      '- Prefer them over guesses, but do not expose internal memory ids unless asked.',
    ]
    if (!results.length) {
      lines.push('- No relevant long-term memory was found for this turn.')
      return lines.join('\n')
    }

    let budget = MAX_AUTO_MEMORY_CHARS
    for (const result of results) {
      const namespace = result.entry.namespace
      const line = `- [${namespace}] ${result.entry.title}: ${result.snippet}`
      if (budget - line.length < 0) break
      lines.push(line)
      budget -= line.length
    }

    return lines.join('\n')
  } catch {
    return MEMORY_RUNTIME_CONTRACT
  }
}
