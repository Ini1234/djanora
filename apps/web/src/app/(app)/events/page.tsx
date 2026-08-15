import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, CalendarDays, Calendar } from 'lucide-react'
import { getEvents } from '@/lib/api.server'
import type { Event } from '@/lib/api.types'
import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'
import { splitByTiming, daysUntil, formatEventDate, countdownLabel } from '@/lib/event-timing'
import { PendingEventInvites } from './pending-invites'

export const metadata: Metadata = { title: 'My Events' }

function eventMeta(event: Event) {
  return [
    EVENT_TYPE_LABELS[event.eventType] ?? event.eventType,
    event.parent?.title ? `in ${event.parent.title}` : null,
    formatEventDate(event.estimatedDate),
    event.location,
  ].filter(Boolean).join(' · ')
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
          className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          Next
        </p>
        <h2
          className="font-display text-2xl sm:text-[28px] font-semibold truncate"
          style={{ color: 'var(--color-foreground)' }}
        >
          {event.title}
        </h2>
        <p className="text-sm mt-2 truncate" style={{ color: 'var(--color-muted)' }}>
          {eventMeta(event)}
        </p>
      </div>
      {when && (
        <p
          className="font-display text-2xl sm:text-[28px] shrink-0 whitespace-nowrap"
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
        className="group flex items-center gap-3 py-3.5 hover:opacity-80 transition-opacity"
      >
        <Calendar size={15} className="shrink-0" style={{ color: 'var(--color-muted)' }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
            {event.title}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {eventMeta(event)}
          </p>
        </div>
        {when && (
          <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
            {when}
          </span>
        )}
      </Link>
    </li>
  )
}

function EventList({ events, past }: { events: Event[]; past?: boolean }) {
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--color-border)', opacity: past ? 0.7 : 1 }}>
      {events.map((event) => (
        <EventRow key={event.id} event={event} past={past} />
      ))}
    </ul>
  )
}

export default async function EventsPage() {
  const events = await getEvents()
  const { upcoming, past } = splitByTiming(events)
  const next = upcoming[0] ?? null
  const rest = upcoming.slice(1)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-display text-3xl font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            My Events
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {events.length === 0
              ? 'No events yet'
              : [
                  upcoming.length > 0 ? `${upcoming.length} upcoming` : null,
                  past.length > 0 ? `${past.length} past` : null,
                ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Link
          href="/events/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-600 hover:bg-gold-500 text-brand-900 font-semibold text-sm transition-colors"
        >
          <Plus size={16} /> New Event
        </Link>
      </div>

      <PendingEventInvites />

      {events.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="p-4 rounded-2xl bg-gold-500/10 mb-4">
            <CalendarDays size={32} className="text-gold-600 dark:text-gold-400" />
          </div>
          <h2
            className="font-display text-xl font-semibold mb-2"
            style={{ color: 'var(--color-foreground)' }}
          >
            No events yet
          </h2>
          <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--color-muted)' }}>
            Create your first event to start planning.
          </p>
          <Link
            href="/events/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-600 hover:bg-gold-500 text-brand-900 font-semibold text-sm transition-colors"
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
                className="text-sm font-semibold mb-1"
                style={{ color: 'var(--color-foreground)' }}
              >
                Upcoming
              </h2>
              <EventList events={rest} />
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2
                className="text-sm font-semibold mb-1"
                style={{ color: 'var(--color-muted)' }}
              >
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
