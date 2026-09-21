import { randomUUID } from 'crypto'

export type StoredChatRole = 'user' | 'assistant'

export type StoredChatMessage = {
  id: string
  role: StoredChatRole
  content: string
  parts?: unknown
  createdAt: string
}

export type ChatTranscript = {
  version: 1
  userId: string
  sessionId: string
  messages: StoredChatMessage[]
}

export function emptyTranscript(userId: string, sessionId: string): ChatTranscript {
  return { version: 1, userId, sessionId, messages: [] }
}

export function parseTranscript(raw: Buffer | string): ChatTranscript {
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed.messages)) return emptyTranscript('', '')
    const userId = typeof parsed.userId === 'string' ? parsed.userId : ''
    const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : ''
    const messages = parsed.messages.flatMap((item) => {
      if (!isRecord(item)) return []
      if (item.role !== 'user' && item.role !== 'assistant') return []
      if (typeof item.content !== 'string') return []
      return [
        {
          id: typeof item.id === 'string' ? item.id : randomUUID(),
          role: item.role,
          content: item.content,
          parts: item.parts ?? null,
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        } satisfies StoredChatMessage,
      ]
    })
    return { version: 1, userId, sessionId, messages }
  } catch {
    return emptyTranscript('', '')
  }
}

export function withTranscriptIdentity(
  transcript: ChatTranscript,
  identity: { userId: string; sessionId: string },
): ChatTranscript | null {
  if (transcript.userId && transcript.userId !== identity.userId) return null
  if (transcript.sessionId && transcript.sessionId !== identity.sessionId) return null
  return { ...transcript, userId: identity.userId, sessionId: identity.sessionId }
}

export function makeStoredMessage(
  role: StoredChatRole,
  content: string,
  parts?: unknown,
): StoredChatMessage {
  return {
    id: randomUUID(),
    role,
    content,
    parts: parts ?? null,
    createdAt: new Date().toISOString(),
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
