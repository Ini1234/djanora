import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getEvent, getEventBudget, getEventChecklist, getEventSchedule } from '@/lib/api.server'
import { EventDetailClient } from './event-detail-client'
import { PageSkeleton } from '@/components/ui/skeleton'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await getEvent(id)
  return { title: event?.title ?? 'Event', robots: { index: false, follow: false } }
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const [event, checklist, budget, schedule] = await Promise.all([
    getEvent(id),
    getEventChecklist(id),
    getEventBudget(id),
    getEventSchedule(id),
  ])

  if (!event) notFound()

  return (
    <Suspense fallback={<PageSkeleton />}>
      <EventDetailClient
        event={event}
        initialChecklist={checklist ?? undefined}
        initialBudget={budget ?? undefined}
        initialSchedule={schedule ?? undefined}
      />
    </Suspense>
  )
}
