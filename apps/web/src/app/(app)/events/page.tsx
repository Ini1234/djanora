import type { Metadata } from 'next'
import { EventsIndex } from './events-index'

export const metadata: Metadata = { title: 'My Events' }

export default function EventsPage() {
  return <EventsIndex />
}
