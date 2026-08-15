import { clerkClient } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getClerkSessionId } from '@/lib/clerk-token'

export async function POST() {
  const sessionId = await getClerkSessionId()
  if (sessionId) {
    try {
      const client = await clerkClient()
      await client.sessions.revokeSession(sessionId)
    } catch {
      // Session may already be gone — still clear cookies below.
    }
  }

  const store = await cookies()
  for (const cookie of store.getAll()) {
    if (
      cookie.name.startsWith('__session') ||
      cookie.name.startsWith('__client') ||
      cookie.name.startsWith('__clerk')
    ) {
      store.delete(cookie.name)
    }
  }

  return NextResponse.json({ ok: true })
}
