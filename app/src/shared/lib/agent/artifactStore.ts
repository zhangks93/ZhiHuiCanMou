import { invokeTauri, isTauriRuntime } from '@/shared/lib/tauri'
import type { ArtifactPayloadRecord, Conversation } from './types'

export function externalizeConversationArtifacts(
  conversations: Conversation[],
): { sanitizedConversations: Conversation[]; payloadRecords: ArtifactPayloadRecord[] } {
  const payloadRecords: ArtifactPayloadRecord[] = []

  const sanitizedConversations = conversations.map((conversation) => {
    const artifacts = conversation.memory?.artifacts
    if (!artifacts?.length) {
      return conversation
    }

    const sanitizedArtifacts = artifacts.map((artifact) => {
      if (!artifact.payload) {
        return artifact
      }

      const payloadRef = artifact.payloadRef || `${conversation.id}:${artifact.id}`
      payloadRecords.push({
        id: payloadRef,
        artifactId: artifact.id,
        conversationId: conversation.id,
        payload: artifact.payload,
        toolName: artifact.toolName,
        createdAt: artifact.createdAt,
      })

      return {
        ...artifact,
        payload: undefined,
        payloadRef,
      }
    })

    return {
      ...conversation,
      memory: conversation.memory
        ? {
            ...conversation.memory,
            artifacts: sanitizedArtifacts,
          }
        : conversation.memory,
    }
  })

  return {
    sanitizedConversations,
    payloadRecords,
  }
}

export async function getArtifactPayloadById(
  agentId: string,
  artifactId: string,
): Promise<ArtifactPayloadRecord | undefined> {
  if (!isTauriRuntime()) {
    return undefined
  }

  const record = await invokeTauri<ArtifactPayloadRecord | null>('agent_chat_get_artifact_payload', {
    agentId,
    artifactId,
  })

  return record ?? undefined
}
