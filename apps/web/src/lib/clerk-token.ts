import 'server-only'

import { verifyToken } from '@clerk/backend'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

/**
 * BFF session token for Nest.
 *
 * The browser never calls Clerk's /tokens endpoint. Page loads can still
 * refresh `__session` via Clerk middleware handshake (document requests only).
 * Same-origin fetch (`/api/proxy`, SSE) does not handshake, so when the
 * 60s cookie JWT is stale we mint a new one with the Clerk Backend API.
 * That JWT stays on the server — it is not sent back to the browser.
 */
const VERIFY_SKEW_MS = 7 * 24 * 60 * 60 * 1000
const mintCache = new Map<string, { jwt: string; expMs: number }>()

export function isSessionCookieName(name: string) {
  return name === '__session' || name.startsWith('__session_')
}

function decodePayload(jwt: string): { sid?: string; exp?: number } | null {
  try {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as { sid?: string; exp?: number }
  } catch {
    return null
  }
}

function sidFromJwt(jwt: string): string | null {
  const payload = decodePayload(jwt)
  return typeof payload?.sid === 'string' ? payload.sid : null
}

async function sessionCookieJwt(): Promise<string | null> {
  const store = await cookies()
  const match = store.getAll().find((c) => isSessionCookieName(c.name))
  return match?.value ?? null
}

async function mintForSession(sessionId: string): Promise<string | null> {
  const hit = mintCache.get(sessionId)
  if (hit && Date.now() < hit.expMs - 15_000) return hit.jwt

  try {
    const client = await clerkClient()
    const token = await client.sessions.getToken(sessionId)
    const expMs = (decodePayload(token.jwt)?.exp ?? 0) * 1000 || Date.now() + 60_000
    mintCache.set(sessionId, { jwt: token.jwt, expMs })
    return token.jwt
  } catch {
    mintCache.delete(sessionId)
    return null
  }
}

/** Mint a fresh session JWT from a (possibly expired) Clerk `__session` cookie. */
export async function mintFromSessionJwt(jwt: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null

  try {
    await verifyToken(jwt, { secretKey, clockSkewInMs: VERIFY_SKEW_MS })
  } catch {
    return null
  }

  const sid = sidFromJwt(jwt)
  if (!sid) return null
  return mintForSession(sid)
}

export function jwtExpiryDate(jwt: string): Date {
  const expMs = (decodePayload(jwt)?.exp ?? 0) * 1000
  return new Date(expMs > Date.now() ? expMs : Date.now() + 60_000)
}

export async function getClerkSessionId(): Promise<string | null> {
  const { sessionId } = await auth()
  if (sessionId) return sessionId

  const jwt = await sessionCookieJwt()
  if (!jwt) return null
  return sidFromJwt(jwt)
}

export async function getBackendClerkToken(): Promise<string | null> {
  const { getToken, sessionId } = await auth()
  const fromAuth = await getToken()
  if (fromAuth) return fromAuth
  if (sessionId) return mintForSession(sessionId)

  const jwt = await sessionCookieJwt()
  if (!jwt) return null
  return mintFromSessionJwt(jwt)
}
