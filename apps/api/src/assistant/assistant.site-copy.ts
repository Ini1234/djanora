import { EventSiteSectionType } from '@prisma/client'
import { RESERVED_SLUGS, slugifySite } from '../event-sites/event-site.constants'

export type SiteCopySection = {
  type: EventSiteSectionType
  label: string
  body: string
}

const SECTIONS: { key: string; camel: string; type: EventSiteSectionType; label: string }[] = [
  { key: 'about', camel: 'about', type: EventSiteSectionType.ABOUT, label: 'About' },
  { key: 'travel', camel: 'travel', type: EventSiteSectionType.TRAVEL, label: 'Travel' },
  { key: 'stay', camel: 'stay', type: EventSiteSectionType.STAY, label: 'Stay' },
  {
    key: 'dress_code',
    camel: 'dressCode',
    type: EventSiteSectionType.DRESS_CODE,
    label: 'Dress code',
  },
]

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function parseDraftSiteCopy(raw: unknown): SiteCopySection[] {
  const row =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const sections: SiteCopySection[] = []
  for (const spec of SECTIONS) {
    const body = text(row[spec.key] ?? row[spec.camel])
    if (!body) continue
    sections.push({ type: spec.type, label: spec.label, body: body.slice(0, 8000) })
  }
  return sections
}

export function siteSlugFromTitle(title: string, eventId: string) {
  const base = slugifySite(title)
  if (base.length >= 3 && !RESERVED_SLUGS.has(base)) return base
  const compact = eventId.replace(/-/g, '').slice(0, 10) || 'event'
  return `evt-${compact}`.slice(0, 48)
}

export function siteCopyPreview(sections: SiteCopySection[]) {
  const n = sections.length
  const summary = `Draft ${n} site section${n === 1 ? '' : 's'}?`
  const paragraphs = sections.map((row) => `${row.label}\n${row.body}`).join('\n\n')
  const blast = [
    'Text only on About, Travel, Stay, and Dress code. The site stays a draft — not published. Cover, theme, and photos are left alone.',
    paragraphs,
  ].join('\n\n')
  return { summary, blast }
}

export function siteCopyDto(sections: SiteCopySection[]) {
  return {
    about: sections.find((row) => row.type === EventSiteSectionType.ABOUT)?.body,
    travel: sections.find((row) => row.type === EventSiteSectionType.TRAVEL)?.body,
    stay: sections.find((row) => row.type === EventSiteSectionType.STAY)?.body,
    dressCode: sections.find((row) => row.type === EventSiteSectionType.DRESS_CODE)?.body,
  }
}
