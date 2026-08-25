import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { verifyToken } from '@clerk/backend'
import { ConfigService } from '@nestjs/config'

export type AuthedRequest = {
  headers: Record<string, unknown>
  auth?: { sub: string }
  userId: string
}

function headerValue(headers: object, name: string): unknown {
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name)
  if (!match) return undefined
  return (headers as Record<string, unknown>)[match]
}

function firstHeader(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null) return undefined
  const first = (value as Record<string, unknown>)['0']
  return typeof first === 'string' ? first : undefined
}

function bearerToken(headers: object): string | undefined {
  const header = firstHeader(headerValue(headers, 'authorization'))
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  return token || undefined
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const token = bearerToken(request.headers ?? {})
    if (!token) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: this.config.get<string>('CLERK_SECRET_KEY')!,
      })
      request.auth = { sub: payload.sub }
      request.userId = payload.sub
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
