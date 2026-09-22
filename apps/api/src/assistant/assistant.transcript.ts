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

export function confirmTokensIn(messages: StoredChatMessage[]): string[] {
  const tokens: string[] = []
  for (const message of messages) {
    for (const card of confirmsOf(message)) {
      tokens.push(card.confirm_token)
    }
  }
  return tokens
}

export function withoutConfirmTokens(
  messages: StoredChatMessage[],
  tokens: Set<string>,
): StoredChatMessage[] {
  if (tokens.size === 0) return messages
  let changed = false
  const next = messages.map((message) => {
    if (!isRecord(message.parts) || !Array.isArray(message.parts.confirms)) return message
    const confirms = message.parts.confirms.filter((item) => {
      return (
        !isRecord(item) || typeof item.confirm_token !== 'string' || !tokens.has(item.confirm_token)
      )
    })
    if (confirms.length === message.parts.confirms.length) return message
    changed = true
    const parts = { ...message.parts }
    if (confirms.length) parts.confirms = confirms
    else delete parts.confirms
    return { ...message, parts: Object.keys(parts).length ? parts : null }
  })
  return changed ? next : messages
}

function confirmsOf(message: StoredChatMessage): { confirm_token: string }[] {
  if (!isRecord(message.parts) || !Array.isArray(message.parts.confirms)) return []
  return message.parts.confirms.flatMap((item) => {
    if (!isRecord(item) || typeof item.confirm_token !== 'string' || !item.confirm_token) return []
    return [{ confirm_token: item.confirm_token }]
  })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
