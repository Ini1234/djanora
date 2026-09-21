import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'
import { mcpError } from './mcp.errors'

const IDLE_MS = 24 * 60 * 60 * 1000

@Injectable()
export class McpSessionService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
  ) {}

  async touch(sessionId: string, clerkId: string) {
    const user = await this.users.ensureFromClerk(clerkId)
    const now = new Date()
    const existing = await this.prisma.mcpSession.findUnique({ where: { id: sessionId } })
    if (!existing) {
      return this.prisma.mcpSession.create({
        data: { id: sessionId, userId: user.id, clerkId, lastUsedAt: now },
      })
    }
    if (existing.userId !== user.id)
      mcpError('unauthorized', 'This connector session belongs to another account')
    const stale = now.getTime() - existing.lastUsedAt.getTime() > IDLE_MS
    return this.prisma.mcpSession.update({
      where: { id: sessionId },
      data: {
        lastUsedAt: now,
        clerkId,
        ...(stale ? { currentEventId: null } : {}),
      },
    })
  }

  async currentEventId(sessionId: string): Promise<string | null> {
    const row = await this.prisma.mcpSession.findUnique({
      where: { id: sessionId },
      select: { currentEventId: true, lastUsedAt: true },
    })
    if (!row) return null
    if (Date.now() - row.lastUsedAt.getTime() > IDLE_MS) return null
    return row.currentEventId
  }

  async setCurrentEvent(sessionId: string, clerkId: string, eventId: string | null) {
    await this.touch(sessionId, clerkId)
    return this.prisma.mcpSession.update({
      where: { id: sessionId },
      data: { currentEventId: eventId, lastUsedAt: new Date() },
    })
  }
}
