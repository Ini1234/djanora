import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { publicGet } from '@/lib/backend'
import type { PublicEventSite } from '@/lib/api.types'
import { EventSitePublic } from './event-site-public'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ inviteeId?: string | string[] }>
}

async function getSite(slug: string) {
  return publicGet<PublicEventSite>(`/event-sites/${slug}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) return { title: 'Event not found', robots: { index: false, follow: false } }
  const indexable = site.robots === 'index'
  return {
    title: site.owner.title || site.look.navName?.trim() || 'Event',
    description: [formatMetaDate(site.owner.estimatedDate), site.owner.location]
      .filter(Boolean)
      .join(' · '),
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  }
}

function formatMetaDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function PublicEventSitePage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const inviteeId = Array.isArray(query.inviteeId) ? query.inviteeId[0] : query.inviteeId
  const site = await getSite(slug)
  if (!site) notFound()

  const jsonLd =
    site.robots === 'index' && (site.owner.title || site.owner.estimatedDate || site.owner.location)
      ? {
          '@context': 'https://schema.org',
          '@type': 'Event',
          ...(site.owner.title ? { name: site.owner.title } : {}),
          startDate: site.owner.estimatedDate ?? undefined,
          location: site.owner.location
            ? { '@type': 'Place', name: site.owner.location }
            : undefined,
        }
      : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <EventSitePublic slug={slug} initial={site} inviteeId={inviteeId} />
    </>
  )
}
