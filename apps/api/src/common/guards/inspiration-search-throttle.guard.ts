import { ExecutionContext, Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class InspirationSearchThrottleGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const q = context.switchToHttp().getRequest<{ query?: { q?: string } }>().query?.q
    return !q || String(q).trim() === ''
  }
}
