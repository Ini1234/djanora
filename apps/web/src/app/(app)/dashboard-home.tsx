'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Calendar, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import { useSse } from '@/contexts/sse-context'
import { notificationHref } from '@/lib/notification-href'
import { PersonalChecklist } from '@/components/dashboard/personal-checklist'
import type { Event, InAppNotification } from '@/lib/api.types'
import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'
import { splitByTiming } from '@/lib/event-timing'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardHomeProps {
  firstName: string
  events?: Event[]
}

const ACTIVITY_CAP = 5

function startOfToday() {
  return new Date(new Date().toDateString()).getTime()
}

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - startOfToday()) / 86_400_000)
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function nextEventCountdown(events: Event[]) {
  const upcoming = events
    .filter((event) => !event.isCompleted && event.estimatedDate)
    .map((event) => ({ event, days: daysUntil(event.estimatedDate!) }))
    .filter((row) => row.days >= 0)
    .sort((a, b) => a.days - b.days)
  return upcoming[0] ?? null
}

export function DashboardHome({ firstName, events: initialEvents }: DashboardHomeProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const { notifications, markNotificationRead } = useSse()
  const [events, setEvents] = useState<Event[]>(initialEvents ?? [])
  const [eventsLoading, setEventsLoading] = useState(!initialEvents)

  useEffect(() => {
    if (initialEvents) return
    let cancelled = false
    proxyClient
      .get<Event[]>('/events')
      .then(({ data }) => {
        if (!cancelled) setEvents(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialEvents])

  const unread = notifications.filter((n) => !n.isRead).slice(0, ACTIVITY_CAP)
  const next = nextEventCountdown(events)
  const { upcoming, past } = useMemo(() => splitByTiming(events), [events])

  function openNotification(n: InAppNotification) {
    if (!n.isRead) void markNotificationRead(n.id)
    const href = notificationHref(n)
    if (href) router.push(href)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--color-foreground)' }}
          >
            {t.has('home') ? t('home') : 'Home'}
          </h1>
          {firstName && firstName !== 'there' && (
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
              {firstName}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {next && (
            <Link
              href={`/events/${next.event.id}`}
              className="text-right text-sm transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-muted)' }}
            >
              <span className="block text-[11px] tracking-wider uppercase">Next</span>
              <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                {next.days === 0 ? 'Today' : next.days === 1 ? 'Tomorrow' : `${next.days}d`}
                <span className="font-normal" style={{ color: 'var(--color-muted)' }}>
                  {' '}
                  · {next.event.title}
                </span>
              </span>
            </Link>
          )}
          <Link href="/events/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> New event
          </Link>
        </div>
      </header>

      {eventsLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!eventsLoading && events.length === 0 && (
        <section className="card overflow-hidden p-8 text-center sm:p-10">
          <div className="bg-foreground/5 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Sparkles size={24} className="text-foreground" />
          </div>
          <h2 className="font-display text-foreground text-2xl font-semibold">
            Plan your first event
          </h2>
          <p className="muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
            Budget, vendors, guests, and a checklist in one place. Start a plan in a few minutes —
            you can add the details as you go.
          </p>
          <Link href="/events/new" className="btn btn-primary btn-md mt-6">
            <Plus size={16} /> Create your first event
          </Link>
        </section>
      )}

      <PersonalChecklist events={events} variant="due" />

      {!eventsLoading && events.length > 0 && (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  Upcoming
                </h2>
                {events.length > 1 && (
                  <Link
                    href="/events"
                    className="inline-flex items-center gap-0.5 text-xs hover:opacity-70"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    All <ChevronRight size={12} />
                  </Link>
                )}
              </div>
              <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {upcoming.slice(0, 5).map((event) => {
                  const dateLabel = event.estimatedDate
                    ? new Date(event.estimatedDate).toLocaleDateString('en-CA', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : null
                  const countdown = event.estimatedDate ? daysUntil(event.estimatedDate) : null
                  return (
                    <li key={event.id}>
                      <Link
                        href={`/events/${event.id}`}
                        className="group flex items-center gap-3 py-3 transition-opacity hover:opacity-80"
                      >
                        <Calendar
                          size={15}
                          className="shrink-0"
                          style={{ color: 'var(--color-muted)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium"
                            style={{ color: 'var(--color-foreground)' }}
                          >
                            {event.title}
                          </p>
                          <p
                            className="mt-0.5 truncate text-xs"
                            style={{ color: 'var(--color-muted)' }}
                          >
                            {[
                              EVENT_TYPE_LABELS[event.eventType] ?? event.eventType,
                              event.parent?.title ? `in ${event.parent.title}` : null,
                              dateLabel,
                              event.location,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        {countdown != null && countdown >= 0 && (
                          <span
                            className="shrink-0 text-xs"
                            style={{ color: 'var(--color-muted)' }}
                          >
                            {countdown === 0
                              ? 'Today'
                              : countdown === 1
                                ? 'Tomorrow'
                                : `${countdown}d`}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
                  Past
                </h2>
                {upcoming.length === 0 && events.length > 1 && (
                  <Link
                    href="/events"
                    className="inline-flex items-center gap-0.5 text-xs hover:opacity-70"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    All <ChevronRight size={12} />
                  </Link>
                )}
              </div>
              <ul className="divide-y opacity-70" style={{ borderColor: 'var(--color-border)' }}>
                {past.slice(0, 5).map((event) => {
                  const dateLabel = event.estimatedDate
                    ? new Date(event.estimatedDate).toLocaleDateString('en-CA', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : null
                  return (
                    <li key={event.id}>
                      <Link
                        href={`/events/${event.id}`}
                        className="group flex items-center gap-3 py-3 transition-opacity hover:opacity-80"
                      >
                        <Calendar
                          size={15}
                          className="shrink-0"
                          style={{ color: 'var(--color-muted)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium"
                            style={{ color: 'var(--color-muted)' }}
                          >
                            {event.title}
                          </p>
                          <p
                            className="mt-0.5 truncate text-xs"
                            style={{ color: 'var(--color-muted)' }}
                          >
                            {[
                              EVENT_TYPE_LABELS[event.eventType] ?? event.eventType,
                              event.parent?.title ? `in ${event.parent.title}` : null,
                              dateLabel,
                              event.location,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-[10px] font-semibold tracking-wide uppercase"
                          style={{ color: 'var(--color-muted)' }}
                        >
                          Past
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {unread.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
              Activity
            </h2>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {unread.length} unread
            </span>
          </div>
          <ul>
            {unread.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className="w-full py-2 text-left transition-opacity hover:opacity-80"
                >
                  <div className="flex items-start gap-2.5">
                    <Bell
                      size={13}
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--color-muted)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: 'var(--color-foreground)' }}
                      >
                        {n.title}
                      </p>
                      <p
                        className="mt-0.5 line-clamp-2 text-xs"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        {n.body}
                      </p>
                      <p className="mt-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
