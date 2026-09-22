import { verifyToken } from '@clerk/backend'
import type { ConfigService } from '@nestjs/config'
import { clerkVerifyOptions } from './clerk-auth'

/** Read a Clerk subject from an optional Bearer token. Invalid tokens are ignored. */
export async function optionalClerkSub(
  authorization: string | undefined,
  config: ConfigService,
): Promise<string | undefined> {
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
  if (!token) return undefined
  try {
    const payload = await verifyToken(token, clerkVerifyOptions(config))
    return payload.sub
  } catch {
    return undefined
  }
}
