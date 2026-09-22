import type { Metadata } from 'next'
import { getEvents } from '@/lib/api.server'
import { EventsIndex } from './events-index'

export const metadata: Metadata = { title: 'My Events' }

export default async function EventsPage() {
  const events = await getEvents()
  return <EventsIndex initialEvents={events} />
}
