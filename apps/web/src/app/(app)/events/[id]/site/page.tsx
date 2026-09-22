import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Globe } from 'lucide-react'
import { getEvent } from '@/lib/api.server'
import { EventSiteEditor } from './site-editor-client'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await getEvent(id)
  return {
    title: event ? `${event.title} · Site` : 'Site',
    robots: { index: false, follow: false },
  }
}

export default async function EventSitePage({ params }: Props) {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) notFound()

  const viewer = event.viewer
  const canEdit =
    !!viewer && (viewer.isHost || (viewer.role === 'EDITOR' && viewer.surfaces.includes('SITE')))
  if (!canEdit) notFound()

  return (
    <div className="mx-auto max-w-7xl min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/events/${id}`}
        className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-sm transition-colors hover:opacity-80"
        style={{ color: 'var(--color-muted)' }}
      >
        <ChevronLeft size={15} /> {event.title}
      </Link>
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Globe size={18} style={{ color: 'var(--color-brand-primary)' }} />
          <h1
            className="font-display text-2xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Event site
          </h1>
        </div>
        <p className="mt-2 max-w-xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          The page guests open. Work the steps on the left; the preview shows what they will see.
        </p>
      </div>
      <EventSiteEditor event={event} />
    </div>
  )
}
