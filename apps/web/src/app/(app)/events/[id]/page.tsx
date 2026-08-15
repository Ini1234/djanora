import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getEvent, getGuests } from '@/lib/api.server'
import { EventDetailClient } from './event-detail-client'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await getEvent(id)
  return { title: event?.title ?? 'Event' }
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const [event, guests] = await Promise.all([getEvent(id), getGuests(id)])

  if (!event) notFound()

  return (
    <Suspense>
      <EventDetailClient event={event} guestCount={guests.length} />
    </Suspense>
  )
}
