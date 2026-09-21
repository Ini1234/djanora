import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { EventAccessService } from '../events/event-access.service'
import { McpSessionService } from '../mcp/mcp.session.service'
import { PrismaService } from '../prisma/prisma.service'
import { BlobStorageService, makeChatBlobName } from '../uploads/blob-storage.service'
import { UsersService } from '../users/users.service'
import { AssistantAgentService, type AgentTurn } from './assistant.agent'
import { AssistantRateLimitService } from './assistant.rate-limit'
import { sanitizePageContext, type PageContext } from './assistant.navigate'
import {
  emptyTranscript,
  makeStoredMessage,
  parseTranscript,
  withTranscriptIdentity,
  type ChatTranscript,
  type StoredChatMessage,
} from './assistant.transcript'

export type MessageParts = {
  confirms?: AgentTurn['confirms']
  citations?: AgentTurn['citations']
  jobs?: string[]
  navigations?: AgentTurn['navigations']
}

@Injectable()
export class AssistantService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private access: EventAccessService,
    private sessions: McpSessionService,
    private agent: AssistantAgentService,
    private rate: AssistantRateLimitService,
    private blobs: BlobStorageService,
  ) {}

  async listThreads(clerkId: string) {
    const user = await this.users.ensureFromClerk(clerkId)
    return this.prisma.assistantThread.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        sessionId: true,
        currentEventId: true,
        createdAt: true,
        updatedAt: true,
        currentEvent: { select: { id: true, title: true } },
      },
    })
  }

  async createThread(clerkId: string, eventId?: string) {
    const user = await this.users.ensureFromClerk(clerkId)
    const currentEventId = eventId ? await this.requireEvent(clerkId, eventId) : null
    const id = randomUUID()
    const sessionId = this.agent.sessionId(id)
    const transcriptKey = makeChatBlobName()
    await this.sessions.touch(sessionId, clerkId)
    if (currentEventId) {
      await this.sessions.setCurrentEvent(sessionId, clerkId, currentEventId)
    }
    const thread = await this.prisma.assistantThread.create({
      data: { id, userId: user.id, currentEventId, transcriptKey, sessionId },
      include: { currentEvent: { select: { id: true, title: true } } },
    })
    await this.saveTranscript(transcriptKey, emptyTranscript(user.id, sessionId))
    return this.presentThread(thread, [])
  }

  async getThread(clerkId: string, threadId: string) {
    const thread = await this.ownedThread(clerkId, threadId)
    const transcript = await this.loadTranscript(
      thread.transcriptKey,
      thread.userId,
      thread.sessionId,
    )
    return this.presentThread(thread, transcript.messages)
  }

  async deleteThread(clerkId: string, threadId: string) {
    const thread = await this.ownedThread(clerkId, threadId)
    await this.blobs.delete('chats', thread.transcriptKey)
    await this.prisma.assistantThread.delete({ where: { id: threadId } })
    return { ok: true }
  }

  async setThreadEvent(clerkId: string, threadId: string, eventId: string | null | undefined) {
    const thread = await this.ownedThread(clerkId, threadId)
    const currentEventId = eventId ? await this.requireEvent(clerkId, eventId) : null
    await this.sessions.setCurrentEvent(thread.sessionId, clerkId, currentEventId)
    const updated = await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: { currentEventId },
      include: { currentEvent: { select: { id: true, title: true } } },
    })
    const transcript = await this.loadTranscript(
      thread.transcriptKey,
      thread.userId,
      thread.sessionId,
    )
    return this.presentThread(updated, transcript.messages)
  }

  async postMessage(clerkId: string, threadId: string, content: string, pageContext?: PageContext) {
    this.rate.hit(clerkId)
    const thread = await this.ownedThread(clerkId, threadId)
    const user = await this.users.ensureFromClerk(clerkId)
    const text = content.trim()
    const transcript = await this.loadTranscript(
      thread.transcriptKey,
      thread.userId,
      thread.sessionId,
    )

    const turn = await this.agent.run({
      clerkId,
      threadId,
      activeMode: user.activeMode,
      userMessage: text,
      pageContext: sanitizePageContext(pageContext),
      history: transcript.messages.map((m) => ({
        role: m.role === 'user' ? 'USER' : 'ASSISTANT',
        content: m.content,
      })),
    })

    const parts: MessageParts = {
      confirms: turn.confirms,
      citations: turn.citations,
      jobs: turn.jobs,
      ...(turn.navigations.length ? { navigations: turn.navigations } : {}),
    }
    transcript.messages.push(
      makeStoredMessage('user', text),
      makeStoredMessage('assistant', turn.content, parts),
    )
    await this.saveTranscript(thread.transcriptKey, transcript)

    const currentEventId = await this.sessions.currentEventId(thread.sessionId)
    const updated = await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: {
        currentEventId,
        title: thread.title ?? text.slice(0, 80),
        updatedAt: new Date(),
      },
      include: { currentEvent: { select: { id: true, title: true } } },
    })
    return {
      thread: this.presentThread(updated, transcript.messages),
      usage: turn.usage,
      model: turn.model,
    }
  }

  async confirmJob(
    clerkId: string,
    threadId: string,
    input: { tool: string; args: Record<string, unknown>; confirmToken: string },
  ) {
    this.rate.hit(clerkId)
    const thread = await this.ownedThread(clerkId, threadId)
    const args = { ...input.args, confirm_token: input.confirmToken }
    const result = await this.agent.executeTool(clerkId, thread.sessionId, input.tool, args)
    const failed = isRecord(result) && typeof result.code === 'string' && result.code !== 'ok'
    const content = failed
      ? `Could not finish ${input.tool}: ${String(result.message ?? result.code)}`
      : `Confirmed: ${input.tool} ran.`
    const transcript = await this.loadTranscript(
      thread.transcriptKey,
      thread.userId,
      thread.sessionId,
    )
    transcript.messages.push(
      makeStoredMessage('assistant', content, { jobs: [input.tool], result }),
    )
    await this.saveTranscript(thread.transcriptKey, transcript)
    const updated = await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
      include: { currentEvent: { select: { id: true, title: true } } },
    })
    return { thread: this.presentThread(updated, transcript.messages), result }
  }

  private async requireEvent(clerkId: string, eventId: string) {
    await this.access.require(clerkId, eventId)
    return eventId
  }

  private async ownedThread(clerkId: string, threadId: string) {
    const user = await this.users.ensureFromClerk(clerkId)
    const thread = await this.prisma.assistantThread.findFirst({
      where: { id: threadId, userId: user.id },
      include: { currentEvent: { select: { id: true, title: true } } },
    })
    if (!thread) throw new NotFoundException('Chat not found')
    return thread
  }

  private async loadTranscript(
    transcriptKey: string,
    userId: string,
    sessionId: string,
  ): Promise<ChatTranscript> {
    const buf = await this.blobs.downloadBuffer('chats', transcriptKey)
    const parsed = buf ? parseTranscript(buf) : emptyTranscript(userId, sessionId)
    const owned = withTranscriptIdentity(parsed, { userId, sessionId })
    if (!owned) throw new NotFoundException('Chat not found')
    return owned
  }

  private async saveTranscript(transcriptKey: string, transcript: ChatTranscript) {
    await this.blobs.upload(
      'chats',
      transcriptKey,
      Buffer.from(JSON.stringify(transcript), 'utf8'),
      'application/json',
    )
  }

  private presentThread(
    thread: {
      id: string
      title: string | null
      sessionId: string
      currentEventId: string | null
      createdAt: Date
      updatedAt: Date
      currentEvent: { id: string; title: string } | null
    },
    messages: StoredChatMessage[],
  ) {
    return {
      id: thread.id,
      title: thread.title,
      sessionId: thread.sessionId,
      currentEventId: thread.currentEventId,
      currentEvent: thread.currentEvent,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      messages,
    }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
