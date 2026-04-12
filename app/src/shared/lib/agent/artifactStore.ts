import { createBrowserStore } from '@/shared/storage/createBrowserStore'
import type { ArtifactPayloadRecord, Conversation } from './types'

function getArtifactStorageKey(agentId: string): string {
  return `agent_artifact_payloads_${agentId}`
}

function getArtifactStore(agentId: string) {
  return createBrowserStore<ArtifactPayloadRecord[]>({
    key: getArtifactStorageKey(agentId),
    fallback: [],
    deserialize: (raw) => {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed as ArtifactPayloadRecord[] : null
    },
  })
}

export function loadArtifactPayloads(agentId: string): ArtifactPayloadRecord[] {
  try {
    return getArtifactStore(agentId).get()
  } catch {
    return []
  }
}

export function getArtifactPayloadById(agentId: string, artifactId: string): ArtifactPayloadRecord | undefined {
  return loadArtifactPayloads(agentId).find((record) => record.artifactId === artifactId)
}

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

export function saveArtifactPayloads(agentId: string, payloadRecords: ArtifactPayloadRecord[]): void {
  getArtifactStore(agentId).set(payloadRecords)
}
