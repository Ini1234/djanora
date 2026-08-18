'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, History, Loader2 } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { useSse } from '@/contexts/sse-context'

const PAGE_SIZE = 20

interface ActivityRow {
  id: string
  action: string
  surface: string
  summary: string
  createdAt: string
  actor: { id: string; firstName: string | null; lastName: string | null }
}

interface ActivityPage {
  items: ActivityRow[]
  nextCursor: string | null
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
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadedRef = useRef(false)
  const fetchGen = useRef(0)

  useEffect(() => {
    loadedRef.current = loaded
  })

  async function fetchPage(cursor?: string) {
    const { data } = await proxyClient.get<ActivityPage>(`/events/${eventId}/activity`, {
      params: { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
    })
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      nextCursor: data?.nextCursor ?? null,
    }
  }

  async function loadFirstPage() {
    const gen = ++fetchGen.current
    setLoading(true)
    try {
      const page = await fetchPage()
      if (gen !== fetchGen.current) return
      setRows(page.items)
      setNextCursor(page.nextCursor)
      setLoaded(true)
    } catch {
      if (gen !== fetchGen.current) return
      setRows([])
      setNextCursor(null)
      setLoaded(true)
    } finally {
      if (gen === fetchGen.current) setLoading(false)
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    const gen = fetchGen.current
    setLoadingMore(true)
    try {
      const page = await fetchPage(nextCursor)
      if (gen !== fetchGen.current) return
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...page.items.filter((row) => !seen.has(row.id))]
      })
      setNextCursor(page.nextCursor)
    } catch {
      /* keep the current page; user can retry Load more */
    } finally {
      if (gen === fetchGen.current) setLoadingMore(false)
    }
  }

  function toggle() {
    setOpen((wasOpen) => {
      const next = !wasOpen
      if (next && !loaded && !loading) void loadFirstPage()
      return next
    })
  }

  useEffect(() => {
    return on((event) => {
      if (!loadedRef.current) return
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
        ]
      })
    })
  }, [on, eventId])

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
      >
        <ChevronRight
          size={14}
          className={`text-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <History size={14} className="text-muted" />
        <h2 className="text-foreground text-sm font-semibold">Activity</h2>
      </button>
      {open && (
        <div className="border-border border-t">
          {loading ? (
            <div className="flex items-center justify-center px-5 py-6">
              <Loader2 size={16} className="text-muted animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted px-5 py-4 text-xs">No activity yet</p>
          ) : (
            <>
              <ul className="divide-border divide-y">
                {rows.map((row) => (
                  <li key={row.id} className="px-5 py-2.5">
                    <p className="text-foreground text-xs">{row.summary}</p>
                    <p className="text-muted mt-0.5 text-[11px]">
                      {actorName(row.actor)} · {timeAgo(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
              {nextCursor && (
                <div className="border-border border-t px-5 py-2">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="btn btn-ghost btn-sm w-full"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
