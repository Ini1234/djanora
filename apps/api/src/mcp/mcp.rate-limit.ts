import { Injectable } from '@nestjs/common'
import { mcpError } from './mcp.errors'

const WINDOW_MS = 60_000
const CHEAP_LIMIT = 60
const GATED_LIMIT = 10

type Bucket = { windowStart: number; count: number }

@Injectable()
export class McpRateLimitService {
  private readonly cheap = new Map<string, Bucket>()
  private readonly gated = new Map<string, Bucket>()

  hit(clerkId: string, gated: boolean) {
    const map = gated ? this.gated : this.cheap
    const limit = gated ? GATED_LIMIT : CHEAP_LIMIT
    const now = Date.now()
    const bucket = map.get(clerkId)
    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      map.set(clerkId, { windowStart: now, count: 1 })
      return
    }
    bucket.count += 1
    if (bucket.count > limit)
      mcpError('rate_limited', 'Too many connector requests. Try again in a minute.')
  }
}
