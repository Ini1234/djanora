import {
  Controller, Get, Query, Req, Res, UnauthorizedException,
  MessageEvent, Sse,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { Observable, map } from 'rxjs'
import { verifyToken } from '@clerk/backend'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { SseService } from './sse.service'

@Controller('sse')
export class SseController {
  constructor(
    private readonly sseService: SseService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * GET /api/sse/stream?token=<clerk_jwt>
   * Browser EventSource can't set headers, so the token comes as a query param.
   */
  @Sse('stream')
  async stream(
    @Query('token') token: string,
    @Req() _req: Request,
    @Res() res: Response,
  ): Promise<Observable<MessageEvent>> {
    if (!token) throw new UnauthorizedException('Missing token')

    const payload = await verifyToken(token, {
      secretKey: this.config.get<string>('CLERK_SECRET_KEY')!,
    }).catch(() => { throw new UnauthorizedException('Invalid token') })

    const user = await this.prisma.user.findUnique({
      where: { clerkId: payload.sub },
      select: { id: true },
    })
    if (!user) throw new UnauthorizedException('User not found')

    // Keep connection alive — close on client disconnect
    res.on('close', () => { /* finalize() in subscribe() handles cleanup */ })

    return this.sseService.subscribe(user.id).pipe(
      map((data) => ({ data } as MessageEvent)),
    )
  }
}
