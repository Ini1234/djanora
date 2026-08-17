import { ExecutionContext, Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class InspirationSearchThrottleGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const q = context.switchToHttp().getRequest<{ query?: { q?: string } }>().query?.q
    return Promise.resolve(!q || String(q).trim() === '')
  }
}
