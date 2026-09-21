import { HttpException, HttpStatus, Injectable } from '@nestjs/common'

const WINDOW_MS = 60_000
const TURN_LIMIT = 20
const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LIMIT = 200

type Bucket = { start: number; count: number }

@Injectable()
export class AssistantRateLimitService {
  private readonly minute = new Map<string, Bucket>()
  private readonly day = new Map<string, Bucket>()

  hit(clerkId: string) {
    this.bump(
      this.minute,
      clerkId,
      WINDOW_MS,
      TURN_LIMIT,
      'Too many chat turns. Try again in a minute.',
    )
    this.bump(this.day, clerkId, DAY_MS, DAY_LIMIT, 'Daily Djan limit reached. Try again tomorrow.')
  }

  private bump(
    map: Map<string, Bucket>,
    clerkId: string,
    windowMs: number,
    limit: number,
    message: string,
  ) {
    const now = Date.now()
    const bucket = map.get(clerkId)
    if (!bucket || now - bucket.start >= windowMs) {
      map.set(clerkId, { start: now, count: 1 })
      return
    }
    bucket.count += 1
    if (bucket.count > limit) {
      throw new HttpException({ code: 'rate_limited', message }, HttpStatus.TOO_MANY_REQUESTS)
    }
  }
}
