import { EventSiteSectionType } from '@prisma/client'

export const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'vendors',
  'vendor',
  'rsvp',
  'e',
  'events',
  'event',
  'site',
  'sites',
  'event-sites',
  'inspiration',
  'inquiries',
  'messages',
  'settings',
  'onboarding',
  'sign-in',
  'sign-up',
  'dashboard',
  'likes',
  'portfolio',
  'about',
  'contact',
  'blog',
  'join',
  'new',
])

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const THEME_PRESETS = ['linen', 'ink', 'garden', 'midnight', 'clay', 'frost'] as const
export const FONT_PAIRS = ['serif-sans', 'sans-sans', 'display-sans', 'serif-serif'] as const
export const COLOR_PALETTES = [
  'ivory-gold',
  'stone-olive',
  'sand-terracotta',
  'slate-rose',
  'ink-cream',
  'sage-cream',
  'navy-gold',
  'blush-wine',
  'forest-cream',
  'charcoal-copper',
  'custom',
] as const
export const BUTTON_STYLES = ['pill', 'square', 'underline'] as const
export const COVER_LAYOUTS = ['full-bleed', 'split', 'centered'] as const
export const COVER_PHOTO_SIDES = ['left', 'right'] as const
export const NAV_PLACEMENTS = ['top', 'side'] as const
export const NAV_STYLES = ['line', 'pill', 'underline', 'solid'] as const
export const NAV_ALIGNS = ['above', 'before', 'below'] as const
export const NAV_BORDERS = ['on', 'off'] as const
export const NAV_BORDER_WIDTHS = ['thin', 'medium', 'thick'] as const
export const NAV_BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const
export const SECTION_LAYOUTS = ['vertical', 'horizontal'] as const
export const PEOPLE_STYLES = ['circles', 'cards'] as const
export const SCHEDULE_STYLES = ['list', 'timeline', 'cards'] as const
export const MAP_MODES = ['off', 'link', 'embed'] as const
export const FAQ_STYLES = ['stack', 'accordion'] as const
export const GIFTS_STYLES = ['links', 'buttons'] as const
export const PHOTO_STYLES = ['grid', 'slider'] as const
export const PHOTO_SIZES = ['small', 'medium', 'large'] as const
export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const SECTION_TYPES: EventSiteSectionType[] = [
  EventSiteSectionType.COVER,
  EventSiteSectionType.ABOUT,
  EventSiteSectionType.DRESS_CODE,
  EventSiteSectionType.SCHEDULE,
  EventSiteSectionType.GIFTS,
  EventSiteSectionType.TRAVEL,
  EventSiteSectionType.STAY,
  EventSiteSectionType.FAQ,
  EventSiteSectionType.PEOPLE,
  EventSiteSectionType.WHERE,
  EventSiteSectionType.RSVP,
  EventSiteSectionType.PHOTOS,
]

export const MAX_PHOTOS = 24
export const MAX_SECTION_PHOTOS = 20
export const MAX_PERSON_PHOTOS = 40
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const MAX_CUSTOM_SECTIONS = 10
export const MAX_FAQ = 30
export const MAX_GIFTS = 20
export const MAX_FAQ_QUESTION = 200
export const MAX_FAQ_ANSWER = 2000
export const MAX_GIFT_LABEL = 80
export const MAX_GIFT_URL = 500
export const MAX_PLUS_ONE = 80
export const MAX_DIETARY = 500
export const MAX_GUEST_MESSAGE = 2000
export const MAX_EMAIL = 254

const HERO_TYPES = new Set<EventSiteSectionType>([
  EventSiteSectionType.ABOUT,
  EventSiteSectionType.DRESS_CODE,
  EventSiteSectionType.STAY,
  EventSiteSectionType.TRAVEL,
  EventSiteSectionType.WHERE,
  EventSiteSectionType.SCHEDULE,
  EventSiteSectionType.FAQ,
  EventSiteSectionType.GIFTS,
  EventSiteSectionType.RSVP,
  EventSiteSectionType.CUSTOM,
])

export function canHaveSectionHero(type: EventSiteSectionType) {
  return HERO_TYPES.has(type)
}

function pick<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback
}

function flag(raw: unknown, fallback: boolean) {
  return typeof raw === 'boolean' ? raw : fallback
}

export function sanitizePeople(
  raw: { id?: string; name?: string; role?: string; group?: string; bio?: string }[] | undefined,
) {
  return (raw ?? []).slice(0, 40).map((person, i) => ({
    id: sanitizePlainText(person.id ?? '', 40).trim() || `p${i + 1}`,
    name: sanitizePlainText(person.name ?? '', 80),
    role: sanitizePlainText(person.role ?? '', 80),
    group: sanitizePlainText(person.group ?? '', 40),
    bio: sanitizePlainText(person.bio ?? '', 400),
  }))
}

export function parseRsvpOptions(payload: Record<string, unknown> | undefined) {
  const deadlineRaw = typeof payload?.deadline === 'string' ? payload.deadline.trim() : ''
  return {
    intro: sanitizePlainText(typeof payload?.intro === 'string' ? payload.intro : '', 500),
    rsvpOpen: flag(payload?.rsvpOpen, true),
    allowMaybe: flag(payload?.allowMaybe, true),
    collectPlusOne: flag(payload?.collectPlusOne, true),
    collectDietary: flag(payload?.collectDietary, true),
    collectMessage: flag(payload?.collectMessage, true),
    deadline: DATE_RE.test(deadlineRaw) ? deadlineRaw : '',
  }
}

export function rsvpConfigError(opts: ReturnType<typeof parseRsvpOptions>, status: string) {
  if (!opts.rsvpOpen) return 'RSVP is closed'
  if (opts.deadline) {
    const today = new Date().toISOString().slice(0, 10)
    if (today > opts.deadline) return 'RSVP is closed'
  }
  if (status === 'MAYBE' && !opts.allowMaybe) return 'Maybe is not available'
  return null
}

/** Guest POST must match the published, enabled RSVP section — not only the browser form. */
export function rsvpDoorError(
  section: { enabled: boolean; payload?: unknown } | null | undefined,
  status: string,
) {
  if (!section?.enabled) return 'RSVP is closed'
  const payload =
    section.payload && typeof section.payload === 'object' && !Array.isArray(section.payload)
      ? (section.payload as Record<string, unknown>)
      : {}
  return rsvpConfigError(parseRsvpOptions(payload), status)
}

export function sanitizeFaq(raw: { question?: string; answer?: string }[] | undefined) {
  return (raw ?? []).slice(0, MAX_FAQ).map((item) => ({
    question: sanitizePlainText(item.question ?? '', MAX_FAQ_QUESTION),
    answer: sanitizePlainText(item.answer ?? '', MAX_FAQ_ANSWER),
  }))
}

export function sanitizeGifts(raw: { label?: string; url?: string }[] | undefined) {
  return (raw ?? []).slice(0, MAX_GIFTS).map((item) => ({
    label: sanitizePlainText(item.label ?? '', MAX_GIFT_LABEL),
    url: sanitizeSiteHref(item.url ?? '') ?? '',
  }))
}

export function redactSiteRsvp<
  T extends {
    plusOneName: string | null
    dietaryNote: string | null
    guestMessage: string | null
    guest: { plusOneAllowed: boolean }
  },
>(dto: T, opts: ReturnType<typeof parseRsvpOptions>): T {
  return {
    ...dto,
    plusOneName: opts.collectPlusOne ? dto.plusOneName : null,
    dietaryNote: opts.collectDietary ? dto.dietaryNote : null,
    guestMessage: opts.collectMessage ? dto.guestMessage : null,
    guest: {
      ...dto.guest,
      plusOneAllowed: opts.collectPlusOne ? dto.guest.plusOneAllowed : false,
    },
  }
}

export function sanitizeRsvpExtras(dto: {
  plusOneName?: string
  dietaryNote?: string
  guestMessage?: string
}) {
  return {
    plusOneName: sanitizePlainText(dto.plusOneName ?? '', MAX_PLUS_ONE) || null,
    dietaryNote: sanitizePlainText(dto.dietaryNote ?? '', MAX_DIETARY) || null,
    guestMessage: sanitizePlainText(dto.guestMessage ?? '', MAX_GUEST_MESSAGE) || null,
  }
}

export function catalogDefaults(type: EventSiteSectionType) {
  if (type === EventSiteSectionType.PEOPLE) return { peopleStyle: 'circles' as const }
  if (type === EventSiteSectionType.SCHEDULE) {
    return {
      scheduleStyle: 'list' as const,
      groupByDay: true,
      showTimes: true,
      showItemDirections: true,
    }
  }
  if (type === EventSiteSectionType.WHERE) return { map: 'link' as const }
  if (type === EventSiteSectionType.FAQ) return { faqStyle: 'stack' as const }
  if (type === EventSiteSectionType.GIFTS) return { giftsStyle: 'links' as const }
  if (type === EventSiteSectionType.RSVP) {
    return {
      rsvpOpen: true,
      allowMaybe: true,
      collectPlusOne: true,
      collectDietary: true,
      collectMessage: true,
    }
  }
  return {}
}

export function pickPeopleStyle(raw: unknown) {
  return pick(raw, PEOPLE_STYLES, 'circles')
}

export function pickScheduleStyle(raw: unknown) {
  return pick(raw, SCHEDULE_STYLES, 'list')
}

export function pickMapMode(raw: unknown) {
  return pick(raw, MAP_MODES, 'link')
}

export function pickFaqStyle(raw: unknown) {
  return pick(raw, FAQ_STYLES, 'stack')
}

export function pickGiftsStyle(raw: unknown) {
  return pick(raw, GIFTS_STYLES, 'links')
}

export function pickPhotosStyle(raw: unknown) {
  return pick(raw, PHOTO_STYLES, 'grid')
}

export function pickPhotosSize(raw: unknown) {
  return pick(raw, PHOTO_SIZES, 'medium')
}

export function pickNavStyle(raw: unknown) {
  return pick(raw, NAV_STYLES, 'line')
}

export function pickNavAlign(raw: unknown) {
  if (raw === 'before' || raw === 'start') return 'before'
  if (raw === 'below') return 'below'
  return 'above'
}

export function pickCoverPhotoSide(raw: unknown) {
  return pick(raw, COVER_PHOTO_SIDES, 'left')
}

export function pickNavBorder(raw: unknown) {
  return pick(raw, NAV_BORDERS, 'on')
}

export function pickNavBorderWidth(raw: unknown) {
  return pick(raw, NAV_BORDER_WIDTHS, 'thin')
}

export function pickNavBorderStyle(raw: unknown) {
  return pick(raw, NAV_BORDER_STYLES, 'solid')
}
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const SESSION_HEADER = 'x-event-site-session'

export function sanitizePlainText(raw: string, max: number) {
  return raw.replace(/<[^>]*>/g, '').slice(0, max)
}

const RICH_TAGS = new Set([
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'a',
])

export function sanitizeSiteHref(raw: string) {
  const href = raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
  if (!href) return null
  const lower = href.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('//')
  ) {
    return null
  }
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('#') ||
    lower.startsWith('/')
  ) {
    return href
  }
  return null
}

/** Allow a writing subset (bold, lists, links). Strip scripts, styles, and event handlers. */
export function sanitizeRichText(raw: string, max: number) {
  let html = String(raw ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, '')

  html = html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (full, tag: string, attrs: string) => {
      const name = tag.toLowerCase()
      const closing = full.startsWith('</')
      if (!RICH_TAGS.has(name)) return ''
      if (closing) return name === 'br' ? '' : `</${name}>`
      if (name === 'br') return '<br>'
      if (name === 'a') {
        const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
        const rawHref = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : ''
        const href = sanitizeSiteHref(rawHref)
        return href
          ? `<a href="${href.replace(/"/g, '&quot;')}" rel="noopener noreferrer" target="_blank">`
          : '<a>'
      }
      return `<${name}>`
    },
  )

  return html.slice(0, max)
}

export function sanitizeSectionTitle(raw: string) {
  const value = sanitizePlainText(raw, 80).replace(/\s+/g, ' ').trim()
  return value || 'Section'
}

export function sectionListError(sections: { type: string; id?: string }[]) {
  const custom = sections.filter((s) => s.type === 'CUSTOM')
  if (custom.length > MAX_CUSTOM_SECTIONS) return 'You can add up to 10 custom sections'
  const builtins = sections.filter((s) => s.type !== 'CUSTOM').map((s) => s.type)
  if (new Set(builtins).size !== builtins.length)
    return 'Each built-in section can only appear once'
  const ids = custom.map((s) => s.id).filter((id): id is string => Boolean(id))
  if (new Set(ids).size !== ids.length) return 'Custom sections must be unique'
  return null
}

export function slugifySite(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Turn freeform input into a URL slug. Returns null when the result is unusable or reserved. */
export function toPublicSlug(raw: string) {
  const value = slugifySite(raw)
  if (!value || value.length < 3 || !SLUG_RE.test(value) || RESERVED_SLUGS.has(value)) {
    return null
  }
  return value
}

/** Guest email/SMS link: `/e/{slug}?inviteeId={token}` */
export function eventSiteInviteUrl(webUrl: string, slug: string, inviteeId: string) {
  const base = webUrl.replace(/\/$/, '')
  return `${base}/e/${slug}?inviteeId=${encodeURIComponent(inviteeId)}`
}

export type SiteCustomColors = {
  bg: string
  fg: string
  accent: string
  muted?: string
  card?: string
}

export function normalizeHex(raw: string) {
  const value = raw.trim()
  if (!HEX_RE.test(value)) return null
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase()
  }
  return value.toLowerCase()
}

export function parseCustomColors(raw: unknown): SiteCustomColors | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const bg = typeof row.bg === 'string' ? normalizeHex(row.bg) : null
  const fg = typeof row.fg === 'string' ? normalizeHex(row.fg) : null
  const accent = typeof row.accent === 'string' ? normalizeHex(row.accent) : null
  if (!bg || !fg || !accent) return null
  const muted = typeof row.muted === 'string' ? normalizeHex(row.muted) : null
  const card = typeof row.card === 'string' ? normalizeHex(row.card) : null
  return {
    bg,
    fg,
    accent,
    ...(muted ? { muted } : {}),
    ...(card ? { card } : {}),
  }
}
