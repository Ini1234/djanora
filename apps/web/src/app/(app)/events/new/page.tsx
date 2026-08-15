import type { Metadata } from 'next'
import { CreateEventWizard } from './create-event-wizard'

export const metadata: Metadata = { title: 'Create Event' }

export default function CreateEventPage() {
  return <CreateEventWizard />
}
