import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'
import { mcpError } from './mcp.errors'
import { newConfirmToken, payloadHash, sha256Hex } from './mcp.hash'
import { McpSessionService } from './mcp.session.service'

const TTL_MS = 10 * 60 * 1000

export type ConfirmPreview = {
  code: 'needs_confirm'
  summary: string
  blast_radius: string
  confirm_token: string
  expires_at: string
}

@Injectable()
export class McpConfirmService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private sessions: McpSessionService,
  ) {}

  async preview(
    sessionId: string,
    clerkId: string,
    toolName: string,
    args: Record<string, unknown>,
    summary: string,
    blastRadius: string,
  ): Promise<ConfirmPreview> {
    const session = await this.sessions.touch(sessionId, clerkId)
    const user = await this.users.ensureFromClerk(clerkId)
    const raw = newConfirmToken()
    const expiresAt = new Date(Date.now() + TTL_MS)
    await this.prisma.mcpConfirmToken.create({
      data: {
        tokenHash: sha256Hex(raw),
        sessionId: session.id,
        userId: user.id,
        toolName,
        payloadHash: payloadHash(toolName, args),
        expiresAt,
      },
    })
    return {
      code: 'needs_confirm',
      summary,
      blast_radius: blastRadius,
      confirm_token: raw,
      expires_at: expiresAt.toISOString(),
    }
  }

  async spend(sessionId: string, clerkId: string, toolName: string, args: Record<string, unknown>) {
    const token = typeof args.confirm_token === 'string' ? args.confirm_token.trim() : ''
    if (!token) {
      mcpError('needs_confirm', 'This write needs a confirm_token from the preview')
    }
    const session = await this.sessions.touch(sessionId, clerkId)
    const user = await this.users.ensureFromClerk(clerkId)
    const hash = sha256Hex(token)
    const row = await this.prisma.mcpConfirmToken.findUnique({ where: { tokenHash: hash } })
    const expected = payloadHash(toolName, args)
    if (
      !row ||
      row.sessionId !== session.id ||
      row.userId !== user.id ||
      row.toolName !== toolName ||
      row.payloadHash !== expected
    ) {
      mcpError('invalid', 'Confirm token does not match this job')
    }
    if (row.spentAt) mcpError('invalid', 'Confirm token was already used')
    if (row.expiresAt.getTime() <= Date.now())
      mcpError('invalid', 'Confirm token expired. Preview again.')

    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.mcpConfirmToken.update({
        where: { id: row.id },
        data: { spentAt: now },
      }),
      this.prisma.mcpConfirmToken.updateMany({
        where: {
          sessionId: session.id,
          toolName,
          payloadHash: expected,
          spentAt: null,
          id: { not: row.id },
        },
        data: { spentAt: now },
      }),
    ])
  }
}
