'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Calendar, ChevronRight, Circle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import { useSse } from '@/contexts/sse-context'
import { notificationHref } from '@/lib/notification-href'
import { PersonalChecklist } from '@/components/dashboard/personal-checklist'
import type { Event, EventChecklistItem, InAppNotification } from '@/lib/api.types'
import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'
import { splitByTiming } from '@/lib/event-timing'

interface DashboardHomeProps {
  firstName: string
  events: Event[]
}

type DueItem = {
  eventId: string
  eventTitle: string
  item: EventChecklistItem
  overdue: boolean
  dueLabel: string
  dueTime: number
}

const DUE_CAP = 8
const ACTIVITY_CAP = 5

function startOfToday() {
  return new Date(new Date().toDateString()).getTime()
}

function isOverdue(dateStr: string | null, done: boolean) {
  if (!dateStr || done) return false
  return new Date(dateStr).getTime() < startOfToday()
}

function isDueSoon(dateStr: string | null, done: boolean) {
  if (!dateStr || done) return false
  const diff = (new Date(dateStr).getTime() - startOfToday()) / 86_400_000
  return diff >= 0 && diff <= 7
}

function dueLabel(dateStr: string) {
  const days = Math.round((new Date(dateStr).getTime() - startOfToday()) / 86_400_000)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days}d`
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

function collectDueItems(events: Event[], completedIds: Set<string>): DueItem[] {
  const rows: DueItem[] = []
  for (const event of events) {
    for (const item of event.checklist ?? []) {
      if (completedIds.has(item.id) || item.isCompleted || !item.dueDate) continue
      if (!isOverdue(item.dueDate, false) && !isDueSoon(item.dueDate, false)) continue
      rows.push({
        eventId: event.id,
        eventTitle: event.title,
        item,
        overdue: isOverdue(item.dueDate, false),
        dueLabel: dueLabel(item.dueDate),
        dueTime: new Date(item.dueDate).getTime(),
      })
    }
  }
  return rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    return a.dueTime - b.dueTime
  })
}

export function DashboardHome({ firstName, events }: DashboardHomeProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const { notifications, markNotificationRead } = useSse()
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  const dueItems = useMemo(() => collectDueItems(events, completedIds), [events, completedIds])
  const visibleDue = dueItems.slice(0, DUE_CAP)
  const overflow = dueItems.slice(DUE_CAP)
  const overflowEventTitles = [...new Set(overflow.map((row) => row.eventTitle))]
  const overflowHref =
    overflow.length === 0
      ? null
      : overflow.every((row) => row.eventId === overflow[0].eventId)
        ? `/events/${overflow[0].eventId}?tab=checklist`
        : '/events'

  const unread = notifications.filter((n) => !n.isRead).slice(0, ACTIVITY_CAP)
  const next = nextEventCountdown(events)
  const { upcoming, past } = useMemo(() => splitByTiming(events), [events])

  async function completeItem(eventId: string, itemId: string) {
    if (pendingIds.has(itemId) || completedIds.has(itemId)) return
    setCompletedIds((prev) => new Set(prev).add(itemId))
    setPendingIds((prev) => new Set(prev).add(itemId))
    try {
      await proxyClient.patch(`/events/${eventId}/checklist/${itemId}`, { isCompleted: true })
    } catch {
      setCompletedIds((prev) => {
        const nextIds = new Set(prev)
        nextIds.delete(itemId)
        return nextIds
      })
    } finally {
      setPendingIds((prev) => {
        const nextIds = new Set(prev)
        nextIds.delete(itemId)
        return nextIds
      })
    }
  }

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
        {next && (
          <Link
            href={`/events/${next.event.id}`}
            className="shrink-0 text-right text-sm transition-opacity hover:opacity-80"
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
      </header>

      <PersonalChecklist events={events} />

      {events.length > 0 && (
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

      {(visibleDue.length > 0 || unread.length > 0) && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {visibleDue.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  Due
                </h2>
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {dueItems.length}
                </span>
              </div>
              <ul className="space-y-1">
                {visibleDue.map((row) => (
                  <li key={row.item.id} className="flex items-start gap-2.5 py-1.5">
                    <button
                      type="button"
                      disabled={pendingIds.has(row.item.id)}
                      onClick={() => void completeItem(row.eventId, row.item.id)}
                      className="mt-0.5 shrink-0 disabled:opacity-40"
                      aria-label={`Mark “${row.item.title}” complete`}
                    >
                      <Circle
                        size={16}
                        className={pendingIds.has(row.item.id) ? 'animate-pulse' : undefined}
                        style={{ color: 'var(--color-muted)' }}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/events/${row.eventId}?tab=checklist&item=${row.item.id}`}
                        className="block truncate text-sm font-medium hover:opacity-80"
                        style={{ color: 'var(--color-foreground)' }}
                      >
                        {row.item.title}
                      </Link>
                      <p
                        className="mt-0.5 truncate text-xs"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        {row.eventTitle}
                      </p>
                    </div>
                    <span
                      className="mt-0.5 shrink-0 text-[11px] font-medium"
                      style={{
                        color: row.overdue
                          ? '#b91c1c'
                          : row.dueLabel === 'Today'
                            ? '#a87b10'
                            : 'var(--color-muted)',
                      }}
                    >
                      {row.dueLabel}
                    </span>
                  </li>
                ))}
              </ul>
              {overflowHref && overflow.length > 0 && (
                <Link
                  href={overflowHref}
                  className="mt-2 inline-flex items-center gap-1 text-xs hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {overflowEventTitles.length === 1
                    ? `View all on ${overflowEventTitles[0]}`
                    : `${overflow.length} more`}
                  <ChevronRight size={12} />
                </Link>
              )}
            </section>
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
      )}
    </div>
  )
}
