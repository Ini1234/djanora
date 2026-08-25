'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, CalendarDays, Calendar } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import type { Event } from '@/lib/api.types'
import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'
import { splitByTiming, daysUntil, formatEventDate, countdownLabel } from '@/lib/event-timing'
import { PendingEventInvites } from './pending-invites'
import { Skeleton } from '@/components/ui/skeleton'

function eventMeta(event: Event) {
  return [
    EVENT_TYPE_LABELS[event.eventType] ?? event.eventType,
    event.parent?.title ? `in ${event.parent.title}` : null,
    formatEventDate(event.estimatedDate),
    event.location,
  ]
    .filter(Boolean)
    .join(' · ')
}

function NextEvent({ event }: { event: Event }) {
  const days = daysUntil(event.estimatedDate)
  const when = countdownLabel(days, 'long')

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex items-end justify-between gap-6 rounded-2xl border px-6 py-5 transition-opacity hover:opacity-80"
      style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      <div className="min-w-0">
        <p
          className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          Next
        </p>
        <h2
          className="font-display truncate text-2xl font-semibold sm:text-[28px]"
          style={{ color: 'var(--color-foreground)' }}
        >
          {event.title}
        </h2>
        <p className="mt-2 truncate text-sm" style={{ color: 'var(--color-muted)' }}>
          {eventMeta(event)}
        </p>
      </div>
      {when && (
        <p
          className="font-display shrink-0 text-2xl whitespace-nowrap sm:text-[28px]"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          {when}
        </p>
      )}
    </Link>
  )
}

function EventRow({ event, past }: { event: Event; past?: boolean }) {
  const days = past ? null : daysUntil(event.estimatedDate)
  const when = past ? 'Past' : countdownLabel(days, 'short')

  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="group flex items-center gap-3 py-3.5 transition-opacity hover:opacity-80"
      >
        <Calendar size={15} className="shrink-0" style={{ color: 'var(--color-muted)' }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            {event.title}
          </p>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-muted)' }}>
            {eventMeta(event)}
          </p>
        </div>
        {when && (
          <span className="shrink-0 text-xs" style={{ color: 'var(--color-muted)' }}>
            {when}
          </span>
        )}
      </Link>
    </li>
  )
}

function EventList({ events, past }: { events: Event[]; past?: boolean }) {
  return (
    <ul
      className="divide-y"
      style={{ borderColor: 'var(--color-border)', opacity: past ? 0.7 : 1 }}
    >
      {events.map((event) => (
        <EventRow key={event.id} event={event} past={past} />
      ))}
    </ul>
  )
}

export function EventsIndex() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const { upcoming, past } = splitByTiming(events)
  const next = upcoming[0] ?? null
  const rest = upcoming.slice(1)

  useEffect(() => {
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
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1
            className="font-display text-3xl font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            My Events
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            {loading
              ? 'Loading…'
              : events.length === 0
                ? 'No events yet'
                : [
                    upcoming.length > 0 ? `${upcoming.length} upcoming` : null,
                    past.length > 0 ? `${past.length} past` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
          </p>
        </div>
        <Link
          href="/events/new"
          className="bg-gold-600 hover:bg-gold-500 text-brand-900 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> New Event
        </Link>
      </div>

      <PendingEventInvites />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : events.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="bg-gold-500/10 mb-4 rounded-2xl p-4">
            <CalendarDays size={32} className="text-gold-600 dark:text-gold-400" />
          </div>
          <h2
            className="font-display mb-2 text-xl font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            No events yet
          </h2>
          <p className="mb-6 max-w-sm text-sm" style={{ color: 'var(--color-muted)' }}>
            Create your first event to start planning.
          </p>
          <Link
            href="/events/new"
            className="bg-gold-600 hover:bg-gold-500 text-brand-900 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            <Plus size={15} /> Plan your first event
          </Link>
        </div>
      ) : (
        <div className="space-y-9">
          {next && <NextEvent event={next} />}

          {rest.length > 0 && (
            <section>
              <h2
                className="mb-1 text-sm font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                Upcoming
              </h2>
              <EventList events={rest} />
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
                Past
              </h2>
              <EventList events={past} past />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
