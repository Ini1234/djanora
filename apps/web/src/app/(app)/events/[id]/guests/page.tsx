import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Users } from 'lucide-react'
import { getEvent, getGuests } from '@/lib/api.server'
import { GuestsClient } from './guests-client'
import { EventAccessProvider } from '../event-access-context'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await getEvent(id)
  return { title: event ? `${event.title} · Guests` : 'Guests' }
}

export default async function GuestsPage({ params }: Props) {
  const { id } = await params
  const [event, guestsResult] = await Promise.all([getEvent(id), getGuests(id)])

  if (!event) notFound()
  const viewer = event.viewer
  const canSeeGuests = !!viewer && (viewer.isHost || viewer.surfaces.includes('GUESTS'))
  if (!canSeeGuests) notFound()
  const guests = guestsResult ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href={`/events/${id}`}
        className="text-brand-400 mb-6 inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
      >
        <ChevronLeft size={15} /> {event.title}
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Users size={18} className="text-gold-400" />
            <h1 className="font-display text-2xl font-semibold text-white">Guest List</h1>
          </div>
          <p className="text-brand-400 text-sm">{event.title}</p>
        </div>
      </div>

      <EventAccessProvider eventId={id} viewer={event.viewer}>
        <GuestsClient eventId={id} initialGuests={guests} event={event} />
      </EventAccessProvider>
    </div>
  )
}
