import { createHmac, timingSafeEqual } from 'crypto'

export type SiteSessionPayload = {
  siteId: string
  guestIds: string[]
  exp: number
}

export function signSiteSession(payload: SiteSessionPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function readSiteSession(
  token: string | undefined,
  secret: string,
): SiteSessionPayload | null {
  if (!token || !secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as SiteSessionPayload
    if (!payload?.siteId || !Array.isArray(payload.guestIds) || typeof payload.exp !== 'number') {
      return null
    }
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
