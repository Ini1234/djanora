'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import type { UserMe } from '@/lib/api.types'

export function JoinInviteActions({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const returnTo = `/events/join/${token}`
  const authQuery = `redirect_url=${encodeURIComponent(returnTo)}`

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false

    proxyClient
      .post<{ eventId: string }>(`/events/invites/${token}/accept`)
      .catch(async (err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status !== 401) throw err
        await new Promise((resolve) => setTimeout(resolve, 500))
        return proxyClient.post<{ eventId: string }>(`/events/invites/${token}/accept`)
      })
      .then(async ({ data }) => {
        if (cancelled) return
        const eventPath = `/events/${data.eventId}`
        try {
          const { data: me } = await proxyClient.get<UserMe>('/users/me')
          if (!me.onboardingCompletedAt) {
            router.replace(`/onboarding?next=${encodeURIComponent(eventPath)}`)
            return
          }
        } catch {
          router.replace(`/onboarding?next=${encodeURIComponent(eventPath)}`)
          return
        }
        router.replace(eventPath)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(
          typeof msg === 'string'
            ? msg
            : 'This invite is invalid or was sent to a different email.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [signedIn, token, router])

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {error}
        </p>
        {signedIn && (
          <Link
            href="/events"
            className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
          >
            Back to events
          </Link>
        )}
      </div>
    )
  }

  if (signedIn) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <Loader2
          className="animate-spin"
          size={18}
          style={{ color: 'var(--color-brand-primary)' }}
        />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Joining event…
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Sign in with the email this invite was sent to. New here? Create an account first.
      </p>
      <Link
        href={`/sign-in?${authQuery}`}
        className="flex h-11 items-center justify-center rounded-xl text-sm font-semibold"
        style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
      >
        Sign in
      </Link>
      <Link
        href={`/sign-up?${authQuery}`}
        className="flex h-11 items-center justify-center rounded-xl text-sm font-semibold"
        style={{
          background: 'transparent',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
        }}
      >
        Create account
      </Link>
    </div>
  )
}
