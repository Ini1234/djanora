import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { CONTACT_EMAIL } from '@/lib/contact'
import { isSandboxHost } from '@/lib/is-sandbox-host'

export const SITE_URL = 'https://djanora.com'
export const SITE_NAME = 'Djanora'
export const SITE_TAGLINE =
  'Plan your event — budget, vendors, guests, and the day-of schedule in one place.'
export const SITE_DESCRIPTION =
  'Djanora is an event planning product for hosts and vendors. It keeps budget, vendors, guests, and the day-of schedule in one place. It started in Ottawa, Ontario.'

export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

export function absoluteUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return new URL(normalized, SITE_URL).toString()
}

export async function requestIsSandbox() {
  const headerList = await headers()
  return isSandboxHost(headerList.get('x-forwarded-host') ?? headerList.get('host'))
}

export const noindexRobots = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const

export const indexRobots = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const },
}

export function pageMeta(opts: {
  title: string
  description: string
  path: string
  index?: boolean
  ogTitle?: string
}): Metadata {
  const url = absoluteUrl(opts.path)
  const index = opts.index ?? true
  const robots = index ? indexRobots : noindexRobots
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots,
    openGraph: {
      type: 'website',
      locale: 'en_CA',
      url,
      siteName: SITE_NAME,
      title: opts.ogTitle ?? opts.title,
      description: opts.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.ogTitle ?? opts.title,
      description: opts.description,
    },
  }
}

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    email: CONTACT_EMAIL,
    description: SITE_DESCRIPTION,
    areaServed: {
      '@type': 'City',
      name: 'Ottawa',
      containedInPlace: { '@type': 'AdministrativeArea', name: 'Ontario' },
    },
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: 'en-CA',
  }
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  const valid = items.filter((item) => item.question.trim() && item.answer.trim())
  if (valid.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

export function howToJsonLd(opts: {
  name: string
  description: string
  steps: { name: string; text: string }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function vendorJsonLd(vendor: {
  slug: string
  businessName: string
  bio: string | null
  category: string
  city: string | null
  websiteUrl: string | null
  estimatedPriceFrom: number | null
  estimatedPriceTo: number | null
  currency: string | null
  averageRating: number | null
  totalReviews: number
  avatarUrl: string | null
}) {
  const url = absoluteUrl(`/vendors/${vendor.slug}`)
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: vendor.businessName,
    url,
    description: vendor.bio || `${vendor.businessName} on Djanora.`,
    areaServed: vendor.city || 'Ottawa',
  }
  if (vendor.avatarUrl && /^https?:\/\//i.test(vendor.avatarUrl)) {
    data.image = vendor.avatarUrl
  }
  if (vendor.websiteUrl && /^https?:\/\//i.test(vendor.websiteUrl)) {
    data.sameAs = [vendor.websiteUrl]
  }
  if (vendor.estimatedPriceFrom != null || vendor.estimatedPriceTo != null) {
    data.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: vendor.currency || 'CAD',
      ...(vendor.estimatedPriceFrom != null ? { price: String(vendor.estimatedPriceFrom) } : {}),
    }
  }
  if (vendor.totalReviews > 0 && vendor.averageRating != null) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: vendor.averageRating.toFixed(1),
      reviewCount: vendor.totalReviews,
      bestRating: '5',
      worstRating: '1',
    }
  }
  return data
}

export function eventJsonLd(opts: {
  slug: string
  name?: string
  startDate?: string | null
  location?: string | null
  image?: string | null
}) {
  if (!opts.name && !opts.startDate && !opts.location) return null
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    url: absoluteUrl(`/e/${opts.slug}`),
    organizer: { '@id': ORGANIZATION_ID },
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  }
  if (opts.name) data.name = opts.name
  if (opts.startDate) data.startDate = opts.startDate
  if (opts.location) data.location = { '@type': 'Place', name: opts.location }
  if (opts.image && /^https?:\/\//i.test(opts.image)) data.image = opts.image
  return data
}

/** Public marketing FAQ — must match visible homepage copy. */
export const PRODUCT_FAQ = [
  {
    question: 'What is Djanora?',
    answer:
      'Djanora is an event planning product for hosts and vendors. It keeps the budget, vendor inquiries, guest list, and day-of schedule in one place instead of scattered spreadsheets and chats.',
  },
  {
    question: 'Who is Djanora for?',
    answer:
      'Hosts planning a celebration who want one shared plan, and local vendors who want a profile planners can inquire against. The product launched around Ottawa, Ontario.',
  },
  {
    question: 'How much does Djanora cost?',
    answer:
      'It is free to start a host account. Vendors can create a profile at no listing fee, and Djanora does not take a booking commission. Hosts contract with vendors directly. Djanora is not a payments processor.',
  },
  {
    question: 'Where does Djanora operate?',
    answer:
      'Djanora is based in Ottawa, Ontario, Canada. Anyone can create an account; vendor discovery is built around local Ottawa-area providers first.',
  },
  {
    question: 'How do vendors get listed?',
    answer:
      'A vendor creates an account, submits a profile, and waits for Djanora to review it. Approved profiles can appear to hosts. Pending or rejected profiles are not listed.',
  },
  {
    question: 'How do guests RSVP?',
    answer:
      'The host sends each guest a unique RSVP link, or publishes an event website and unlocks it for people on the guest list. Invite links are private and are not meant to be indexed.',
  },
] as const

export const PLAN_STEPS = [
  {
    name: 'Create your event',
    text: 'Add the date, location, and what you are celebrating. Invite collaborators so everyone sees the same plan.',
  },
  {
    name: 'Set your budget',
    text: 'Enter your total budget. Djanora breaks it down by category — catering, decor, photography and more.',
  },
  {
    name: 'Find and book vendors',
    text: 'Browse approved vendors, send inquiries, get quotes, and keep bookings next to the budget.',
  },
] as const
