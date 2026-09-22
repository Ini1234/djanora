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
import { sanitizeSheetContext } from './assistant.sheet'
import { sha256Hex } from '../mcp/mcp.hash'
import {
  confirmTokensIn,
  emptyTranscript,
  makeStoredMessage,
  parseTranscript,
  withoutConfirmTokens,
  withTranscriptIdentity,
  type ChatTranscript,
  type StoredChatMessage,
} from './assistant.transcript'
import {
  importConfirmMessage,
  isAlreadyDone,
  isJobFailure,
  jobFailureCopy,
  jobResultCode,
} from './assistant.copy'
import { isUnusedAssistantThread, nextThreadTitle } from './assistant.title'

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
    const threads = await this.prisma.assistantThread.findMany({
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
    return threads.filter((thread) => !isUnusedAssistantThread(thread))
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
    const messages = await this.hideSettledConfirms(transcript.messages)
    if (messages !== transcript.messages) {
      transcript.messages = messages
      await this.saveTranscript(thread.transcriptKey, transcript)
    }
    return this.presentThread(thread, messages)
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
    const messages = await this.hideSettledConfirms(transcript.messages)
    return this.presentThread(updated, messages)
  }

  async postMessage(
    clerkId: string,
    threadId: string,
    content: string,
    pageContext?: PageContext,
    sheetContext?: unknown,
  ) {
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
      sheetContext: sanitizeSheetContext(sheetContext),
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
        title:
          nextThreadTitle({
            userMessage: text,
            currentTitle: thread.title,
            jobs: turn.jobs,
          }) ?? thread.title,
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
    const transcript = await this.loadTranscript(
      thread.transcriptKey,
      thread.userId,
      thread.sessionId,
    )
    transcript.messages = withoutConfirmTokens(transcript.messages, new Set([input.confirmToken]))
    if (isAlreadyDone(result)) {
      await this.saveTranscript(thread.transcriptKey, transcript)
      return { thread: this.presentThread(thread, transcript.messages), result }
    }
    const content = isJobFailure(result)
      ? jobFailureCopy(jobResultCode(result) ?? 'unavailable')
      : importConfirmMessage(input.tool, result)
    transcript.messages.push(
      makeStoredMessage('assistant', content, { jobs: [input.tool], result }),
    )
    await this.saveTranscript(thread.transcriptKey, transcript)
    const updated = await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: {
        title:
          nextThreadTitle({
            userMessage: '',
            currentTitle: thread.title,
            jobs: [input.tool],
          }) ?? thread.title,
        updatedAt: new Date(),
      },
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

  private async hideSettledConfirms(messages: StoredChatMessage[]) {
    const tokens = confirmTokensIn(messages)
    if (!tokens.length) return messages
    const hashes = tokens.map((token) => sha256Hex(token))
    const rows = await this.prisma.mcpConfirmToken.findMany({
      where: { tokenHash: { in: hashes } },
      select: { tokenHash: true, spentAt: true, expiresAt: true },
    })
    const settledHashes = new Set(
      rows
        .filter((row) => row.spentAt || row.expiresAt.getTime() <= Date.now())
        .map((row) => row.tokenHash),
    )
    if (!settledHashes.size) return messages
    const settled = new Set(tokens.filter((token, index) => settledHashes.has(hashes[index])))
    return withoutConfirmTokens(messages, settled)
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
