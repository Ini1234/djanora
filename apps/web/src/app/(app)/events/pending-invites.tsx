'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { proxyClient } from '@/lib/proxy-client'

interface PendingInvite {
  id: string
  token: string
  role: string
  event: { id: string; title: string }
  invitedBy: { firstName: string | null; lastName: string | null } | null
}

export function PendingEventInvites() {
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [pending, start] = useTransition()
  const router = useRouter()

  useEffect(() => {
    proxyClient
      .get<PendingInvite[]>('/events/invites')
      .then(({ data }) => setInvites(Array.isArray(data) ? data : []))
      .catch(() => setInvites([]))
  }, [])

  if (invites.length === 0) return null

  return (
    <div className="mb-6 space-y-2">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{
            background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {invite.invitedBy?.firstName ?? 'Someone'} invited you to plan{' '}
            <span className="font-semibold">{invite.event.title}</span>
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const { data } = await proxyClient.post<{ eventId: string }>(
                  `/events/invites/${invite.token}/accept`,
                )
                router.push(`/events/${data.eventId}`)
                router.refresh()
              })
            }
            className="h-8 shrink-0 rounded-lg px-3 text-xs font-semibold"
            style={{
              background: 'var(--color-brand-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            Accept
          </button>
        </div>
      ))}
    </div>
  )
}
