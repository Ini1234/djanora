import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/json-ld'
import { backend, publicGet } from '@/lib/backend'
import { getBackendClerkToken } from '@/lib/clerk-token'
import type { PublicEventSite } from '@/lib/api.types'
import { eventJsonLd, faqJsonLd, noindexRobots, pageMeta } from '@/lib/seo'
import { EventSitePublic } from './event-site-public'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ inviteeId?: string | string[] }>
}

async function getSite(slug: string) {
  const token = await getBackendClerkToken()
  if (!token) return publicGet<PublicEventSite>(`/event-sites/${slug}`)
  try {
    const { data } = await backend.get<PublicEventSite>(`/event-sites/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5_000,
    })
    return data
  } catch {
    return publicGet<PublicEventSite>(`/event-sites/${slug}`)
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) return { title: 'Event not found', robots: noindexRobots }
  const title = site.owner.title || site.look.navName?.trim() || 'Event'
  const description =
    [formatMetaDate(site.owner.estimatedDate), site.owner.location].filter(Boolean).join(' · ') ||
    'Event details on Djanora.'
  return pageMeta({
    title,
    description,
    path: `/e/${slug}`,
    index: site.robots === 'index',
  })
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

  const eventLd =
    site.robots === 'index'
      ? eventJsonLd({
          slug,
          name: site.owner.title || site.look.navName?.trim() || undefined,
          startDate: site.owner.estimatedDate,
          location: site.owner.location,
          image: site.look.coverPhotoUrl,
        })
      : null
  const faqItems =
    site.robots === 'index'
      ? site.sections
          .filter((section) => section.type === 'FAQ' && section.enabled)
          .flatMap((section) => section.faq ?? [])
          .filter((item) => item.question.trim() && item.answer.trim())
      : []
  const faqLd = faqJsonLd(faqItems)

  return (
    <>
      <JsonLd data={eventLd} />
      <JsonLd data={faqLd} />
      <EventSitePublic
        slug={slug}
        initial={site}
        inviteeId={inviteeId}
        hostView={site.hostView === true}
      />
    </>
  )
}
