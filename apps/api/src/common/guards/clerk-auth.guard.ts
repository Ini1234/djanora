import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { createClerkClient } from '@clerk/backend'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private clerk: ReturnType<typeof createClerkClient>

  constructor(private config: ConfigService) {
    this.clerk = createClerkClient({
      secretKey: this.config.get<string>('CLERK_SECRET_KEY'),
    })
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    const authHeader = request.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.split(' ')[1]

    try {
      const payload = await this.clerk.verifyToken(token)
      request.auth = payload
      request.userId = payload.sub
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
