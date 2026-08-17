import {
  Controller,
  Headers,
  Query,
  UnauthorizedException,
  MessageEvent,
  Sse,
} from '@nestjs/common'
import { Observable, map } from 'rxjs'
import { verifyToken } from '@clerk/backend'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { SseService } from './sse.service'

function bearerToken(authorization?: string): string | undefined {
  if (!authorization) return undefined
  const [scheme, token] = authorization.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined
  return token
}

@Controller('sse')
export class SseController {
  constructor(
    private readonly sseService: SseService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * GET /api/sse/stream
   * The Next BFF sends Authorization. Query `token` is a fallback only.
   */
  @Sse('stream')
  async stream(
    @Headers('authorization') authorization?: string,
    @Query('token') queryToken?: string,
  ): Promise<Observable<MessageEvent>> {
    const token = bearerToken(authorization) ?? queryToken
    if (!token) throw new UnauthorizedException('Missing token')

    const payload = await verifyToken(token, {
      secretKey: this.config.get<string>('CLERK_SECRET_KEY')!,
    }).catch(() => {
      throw new UnauthorizedException('Invalid token')
    })

    const user = await this.prisma.user.findUnique({
      where: { clerkId: payload.sub },
      select: { id: true },
    })
    if (!user) throw new UnauthorizedException('User not found')

    return this.sseService.subscribe(user.id).pipe(map((data) => ({ data })))
  }
}
