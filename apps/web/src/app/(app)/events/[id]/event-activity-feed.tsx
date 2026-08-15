'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { useSse } from '@/contexts/sse-context'

interface ActivityRow {
  id: string
  action: string
  surface: string
  summary: string
  createdAt: string
  actor: { id: string; firstName: string | null; lastName: string | null }
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function actorName(actor: ActivityRow['actor']) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(' ') || 'Someone'
}

export function EventActivityFeed({ eventId }: { eventId: string }) {
  const { on } = useSse()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    proxyClient
      .get<ActivityRow[]>(`/events/${eventId}/activity`)
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [eventId])

  useEffect(() => {
    return on((event) => {
      if (event.type !== 'event_activity' || !event.activity) return
      if (event.activity.eventId !== eventId) return
      const incoming = event.activity
      setRows((prev) => {
        if (prev.some((r) => r.id === incoming.id)) return prev
        return [
          {
            id: incoming.id,
            action: incoming.action,
            surface: incoming.surface,
            summary: incoming.summary,
            createdAt: incoming.createdAt,
            actor: incoming.actor,
          },
          ...prev,
        ].slice(0, 40)
      })
    })
  }, [on, eventId])

  if (loading || rows.length === 0) return null

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <History size={14} style={{ color: 'var(--color-brand-primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Activity</h2>
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {rows.slice(0, 20).map((row) => (
          <li key={row.id} className="px-5 py-2.5">
            <p className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
              {row.summary}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {actorName(row.actor)} · {timeAgo(row.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
