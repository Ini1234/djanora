'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { getErrorMessage } from '@/lib/errors'
import { newId } from '@/lib/id'
import type {
  EditorEventSite,
  Event,
  EventScheduleItem,
  EventSiteAccessMode,
  EventSiteCoverPhotoSide,
  EventSiteCustomColors,
  EventSiteNavAlign,
  EventSiteNavBorder,
  EventSiteNavBorderStyle,
  EventSiteNavBorderWidth,
  EventSiteNavPlacement,
  EventSiteNavStyle,
  EventSitePhotosSize,
  EventSitePhotosStyle,
  EventSiteSection,
  EventSiteSectionType,
  EventPartyMember,
  EventPartyRoster,
  EventSitePerson,
} from '@/lib/api.types'
import {
  EventSiteView,
  previewEventSlices,
  sectionAnchor,
  sectionLayout,
} from '@/app/e/[slug]/event-site-view'
import { PartySitePanel } from './party-editor'
import { SectionImageField, canHaveHero } from './section-image-field'
import { SiteFileButton } from './site-file-button'
import { StoryEditor } from './story-editor'
import { SITE_PALETTES, bodyContrastOk, normalizeHex, themePack } from '@/app/e/[slug]/site-look'
import {
  CatalogToggle,
  HexField,
  LabeledField,
  LayoutToggle,
  LookChoice,
  fieldStyle,
} from './site-editor-fields'
import { eventDateKey } from '@/lib/event-timing'
import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'

const THEMES = ['linen', 'ink', 'garden', 'midnight', 'clay', 'frost'] as const
const FONTS = ['serif-sans', 'sans-sans', 'display-sans', 'serif-serif'] as const
const PALETTES = [
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
] as const
const BUTTONS = ['pill', 'square', 'underline'] as const
const THEME_LABELS: Record<(typeof THEMES)[number], string> = {
  linen: 'Linen',
  ink: 'Ink',
  garden: 'Garden',
  midnight: 'Midnight',
  clay: 'Clay',
  frost: 'Frost',
}
const FONT_LABELS: Record<(typeof FONTS)[number], string> = {
  'serif-sans': 'Serif headings',
  'sans-sans': 'All sans',
  'display-sans': 'Display headings',
  'serif-serif': 'All serif',
}
const PALETTE_LABELS: Record<(typeof PALETTES)[number], string> = {
  'ivory-gold': 'Ivory & gold',
  'stone-olive': 'Stone & olive',
  'sand-terracotta': 'Sand & terracotta',
  'slate-rose': 'Slate & rose',
  'ink-cream': 'Ink & cream',
  'sage-cream': 'Sage & cream',
  'navy-gold': 'Navy & gold',
  'blush-wine': 'Blush & wine',
  'forest-cream': 'Forest & cream',
  'charcoal-copper': 'Charcoal & copper',
}
const BUTTON_LABELS: Record<(typeof BUTTONS)[number], string> = {
  pill: 'Rounded',
  square: 'Square',
  underline: 'Underline',
}
const COVER_LAYOUTS: {
  id: 'full-bleed' | 'split' | 'centered'
  title: string
  hint: string
}[] = [
  { id: 'full-bleed', title: 'Photo on top', hint: 'Wide photo, then the cover text under it' },
  {
    id: 'split',
    title: 'Photo beside the text',
    hint: 'Photo and text sit in two columns. Pick left or right.',
  },
  { id: 'centered', title: 'Photo underneath', hint: 'Cover text first, then the photo under it' },
]
const SECTION_ORDER: Exclude<EventSiteSectionType, 'CUSTOM'>[] = [
  'COVER',
  'ABOUT',
  'DRESS_CODE',
  'SCHEDULE',
  'GIFTS',
  'TRAVEL',
  'STAY',
  'FAQ',
  'PEOPLE',
  'WHERE',
  'RSVP',
  'PHOTOS',
]
const SECTION_LABELS: Record<Exclude<EventSiteSectionType, 'CUSTOM'>, string> = {
  COVER: 'Home',
  ABOUT: 'Story',
  DRESS_CODE: 'Dress Code',
  SCHEDULE: 'Schedule',
  GIFTS: 'Registry',
  TRAVEL: 'Travel',
  STAY: 'Where to Stay',
  FAQ: 'Q & A',
  PEOPLE: 'Wedding Party',
  WHERE: 'Venue',
  RSVP: 'RSVP',
  PHOTOS: 'Photos',
}
const SECTION_HINTS: Record<Exclude<EventSiteSectionType, 'CUSTOM'>, string> = {
  COVER: 'Always first. Photo and title are in Cover.',
  ABOUT: 'A short story for guests.',
  DRESS_CODE: 'What you would like people to wear.',
  SCHEDULE: 'Uses items marked “Show on the event site” on the Schedule tab.',
  GIFTS: 'Registry or gift links.',
  TRAVEL: 'How to get there.',
  STAY: 'Hotels and where to sleep.',
  FAQ: 'Questions guests keep asking.',
  PEOPLE: 'Live from the event wedding party. Pick who guests see.',
  WHERE: 'Add the address for directions and the map.',
  RSVP: 'Guests reply here. Same list as the event.',
  PHOTOS: 'A gallery on the page.',
}
const EDITOR_STEPS = [
  { id: 'site-share', label: 'Share' },
  { id: 'site-style', label: 'Style' },
  { id: 'site-menu', label: 'Menu' },
  { id: 'site-cover', label: 'Cover' },
  { id: 'site-pages', label: 'Pages' },
] as const
const MAX_CUSTOM_SECTIONS = 10

function emptySection(type: Exclude<EventSiteSectionType, 'CUSTOM'>, i: number): EventSiteSection {
  return { type, enabled: type === 'COVER', sortOrder: i, layout: 'vertical' }
}

function sectionKey(section: EventSiteSection) {
  return section.id ?? (section.type === 'CUSTOM' ? `custom-${section.sortOrder}` : section.type)
}

function sectionLabel(section: EventSiteSection) {
  if (section.type === 'CUSTOM') return section.title?.trim() || 'Section'
  return SECTION_LABELS[section.type]
}

function sectionHint(section: EventSiteSection) {
  if (section.type === 'CUSTOM') return 'Your own titled block.'
  return SECTION_HINTS[section.type]
}

function mergeSections(saved: EventSiteSection[]): EventSiteSection[] {
  const byType = new Map<Exclude<EventSiteSectionType, 'CUSTOM'>, EventSiteSection>()
  for (const s of saved) {
    if (s.type !== 'CUSTOM') {
      byType.set(s.type, { ...emptySection(s.type, s.sortOrder), ...s })
    }
  }
  const ordered = [...saved].sort((a, b) => a.sortOrder - b.sortOrder)
  const cover = byType.get('COVER') ?? emptySection('COVER', 0)
  const restFromSaved = ordered.filter((s) => s.type !== 'COVER')
  const seen = new Set(restFromSaved.filter((s) => s.type !== 'CUSTOM').map((s) => s.type))
  const missing = SECTION_ORDER.filter((t) => t !== 'COVER' && !seen.has(t)).map((t) =>
    emptySection(t, 99),
  )
  const rest = [
    ...restFromSaved.map((s) => (s.type === 'CUSTOM' ? s : byType.get(s.type)!)),
    ...missing,
  ]
  return [
    { ...cover, sortOrder: 0, enabled: true },
    ...rest.map((s, i) => ({
      ...s,
      sortOrder: i + 1,
      people:
        s.type === 'PEOPLE'
          ? (s.people ?? []).map((person, j) => ({
              ...person,
              id: person.id || `p${j + 1}`,
            }))
          : s.people,
    })),
  ]
}

function peopleFromRoster(members: EventPartyMember[]): EventSitePerson[] {
  return members
    .filter((member) => member.showOnSite)
    .map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      side: member.side,
      group: member.group ?? '',
      bio: member.bio ?? '',
      pairedWithId: member.pairedWithId,
      image: member.photoUrl
        ? { id: member.id, url: member.photoUrl, alt: member.name }
        : undefined,
    }))
}

function toPatchSections(rows: EventSiteSection[]) {
  return rows.map((s, i) => {
    const { image: _image, people: _people, ...rest } = s
    return {
      ...rest,
      sortOrder: i,
    }
  })
}

const FORBIDDEN_NAME = /[/\\?#<>]/

function slugifySite(raw: string) {
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

const RESERVED_SLUGS = new Set([
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

function previewPublicSlug(raw: string) {
  return slugifySite(raw)
}

function slugHint(raw: string) {
  const slug = slugifySite(raw)
  if (FORBIDDEN_NAME.test(raw)) return ' — remove / \\ ? # < >'
  if (raw.trim() && !slug) return ' — add some letters or numbers'
  if (slug && slug.length < 3) return ' — use at least 3 letters or numbers'
  if (RESERVED_SLUGS.has(slug)) return ' — that URL is reserved, pick another'
  return ''
}

function canUseSiteName(raw: string) {
  const trimmed = raw.trim()
  const slug = slugifySite(trimmed)
  return (
    trimmed.length > 0 &&
    trimmed.length <= 80 &&
    !FORBIDDEN_NAME.test(trimmed) &&
    slug.length >= 3 &&
    !RESERVED_SLUGS.has(slug)
  )
}

function SiteUrlField({
  host,
  value,
  onChange,
  placeholder,
}: {
  host: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const preview = previewPublicSlug(value)
  const hint = slugHint(value)
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        Website address
      </p>
      <div
        className="flex min-h-11 w-full min-w-0 items-center rounded-xl px-3 py-2 text-sm"
        style={fieldStyle}
      >
        <span className="max-w-[40%] shrink-0 truncate" style={{ color: 'var(--color-muted)' }}>
          {host}/e/
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={80}
          className="min-w-0 flex-1 bg-transparent focus:outline-none"
          style={{ color: 'var(--color-text-primary)' }}
          aria-label="Website URL"
        />
      </div>
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        {preview ? (
          <>
            Guests will open {host}/e/{preview}
            {hint}. This address has to be unique.
          </>
        ) : (
          <>
            Like {host}/e/ada-and-chidi{hint || ' — add some letters or numbers'}.
          </>
        )}
      </p>
    </div>
  )
}

export function EventSiteEditor({ event }: { event: Event }) {
  const router = useRouter()
  const [site, setSite] = useState<EditorEventSite | null>(null)
  const [loaded, setLoaded] = useState(!event.site)
  const [slug, setSlug] = useState(event.site?.slug ?? event.title)
  const [ownerAccessMode, setOwnerAccessMode] = useState<EventSiteAccessMode>('INVITED_ONLY')
  const [included, setIncluded] = useState<EditorEventSite['included']>([])
  const [themePreset, setThemePreset] = useState('linen')
  const [fontPair, setFontPair] = useState('serif-sans')
  const [colorPalette, setColorPalette] = useState('ivory-gold')
  const [buttonStyle, setButtonStyle] = useState('pill')
  const [coverLayout, setCoverLayout] = useState('full-bleed')
  const [coverPhotoSide, setCoverPhotoSide] = useState<EventSiteCoverPhotoSide>('left')
  const [showEventType, setShowEventType] = useState(false)
  const [showEventTitle, setShowEventTitle] = useState(false)
  const [navPlacement, setNavPlacement] = useState<EventSiteNavPlacement>('top')
  const [navStyle, setNavStyle] = useState<EventSiteNavStyle>('line')
  const [navAlign, setNavAlign] = useState<EventSiteNavAlign>('above')
  const [navName, setNavName] = useState('')
  const [navBorder, setNavBorder] = useState<EventSiteNavBorder>('on')
  const [navBorderWidth, setNavBorderWidth] = useState<EventSiteNavBorderWidth>('thin')
  const [navBorderStyle, setNavBorderStyle] = useState<EventSiteNavBorderStyle>('solid')
  const [customColors, setCustomColors] = useState<EventSiteCustomColors>(() => {
    const seed = SITE_PALETTES['ivory-gold']
    return { bg: seed.bg, fg: seed.fg, accent: seed.accent, muted: seed.muted, card: seed.card }
  })
  const [sections, setSections] = useState<EventSiteSection[]>(
    SECTION_ORDER.map((type, i) => emptySection(type, i)),
  )
  const [openPageKey, setOpenPageKey] = useState<string | null>(null)
  const [openSteps, setOpenSteps] = useState<string[]>([])
  const [previewFocus, setPreviewFocus] = useState<{ key: string; tick: number } | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [host, setHost] = useState('djanora.com')
  const [pendingCover, setPendingCover] = useState<File | null>(null)
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null)
  const pendingCoverUrlRef = useRef<string | null>(null)
  const previewPaneRef = useRef<HTMLDivElement>(null)
  const [scheduleItems, setScheduleItems] = useState<EventScheduleItem[]>([])
  const [place, setPlace] = useState(event.location ?? '')

  useEffect(() => {
    setHost(window.location.host)
  }, [])

  useEffect(() => {
    setPlace(event.location ?? '')
  }, [event.location])

  useEffect(() => {
    return () => {
      if (pendingCoverUrlRef.current) URL.revokeObjectURL(pendingCoverUrlRef.current)
    }
  }, [])

  function setCoverPreview(url: string | null) {
    if (pendingCoverUrlRef.current) URL.revokeObjectURL(pendingCoverUrlRef.current)
    pendingCoverUrlRef.current = url
    setPendingCoverUrl(url)
  }

  function stageCover(file: File) {
    setPendingCover(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  function clearPendingCover() {
    setPendingCover(null)
    setCoverPreview(null)
  }

  useEffect(() => {
    if (!event.site) return
    proxyClient
      .get<EditorEventSite>(`/events/${event.id}/site`)
      .then(({ data }) => applySite(data))
      .catch((err) => setError(getErrorMessage(err, 'Could not load the site')))
      .finally(() => setLoaded(true))
  }, [event.id, event.site])

  useEffect(() => {
    let cancelled = false
    proxyClient
      .get<EventScheduleItem[]>(`/events/${event.id}/schedule`)
      .then(({ data }) => {
        if (!cancelled) setScheduleItems(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [event.id])

  const previewFocusKey = previewFocus?.key ?? null
  const previewFocusSection = sections.find((section) => sectionKey(section) === previewFocusKey)
  const previewFocusAnchor =
    previewFocusSection && (previewFocusSection.type === 'COVER' || previewFocusSection.enabled)
      ? sectionAnchor(previewFocusSection)
      : null

  useEffect(() => {
    if (!previewFocus || !previewFocusAnchor) return
    const root = previewPaneRef.current
    if (!root) return
    let cancelled = false
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) return
        const target = root.querySelector(`#${CSS.escape(previewFocusAnchor)}`)
        if (!(target instanceof HTMLElement)) return
        const top =
          target.getBoundingClientRect().top -
          root.getBoundingClientRect().top +
          root.scrollTop -
          12
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        root.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
      })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(id)
    }
  }, [previewFocus, previewFocusAnchor])

  function applySite(data: EditorEventSite) {
    setSite(data)
    setSlug(data.slug)
    setOwnerAccessMode(data.ownerAccessMode)
    setIncluded(data.included)
    setThemePreset(data.themePreset)
    setFontPair(data.fontPair)
    setColorPalette(data.colorPalette)
    setButtonStyle(data.buttonStyle)
    setCoverLayout(data.coverLayout)
    setCoverPhotoSide(data.coverPhotoSide === 'right' ? 'right' : 'left')
    setShowEventType(data.showEventType === true)
    setShowEventTitle(data.showEventTitle === true)
    setNavPlacement(data.navPlacement === 'side' ? 'side' : 'top')
    setNavStyle(
      data.navStyle === 'pill' || data.navStyle === 'underline' || data.navStyle === 'solid'
        ? data.navStyle
        : 'line',
    )
    setNavAlign(data.navAlign === 'before' || data.navAlign === 'below' ? data.navAlign : 'above')
    setNavName(data.navName ?? '')
    setNavBorder(data.navBorder === 'off' ? 'off' : 'on')
    setNavBorderWidth(
      data.navBorderWidth === 'medium' || data.navBorderWidth === 'thick'
        ? data.navBorderWidth
        : 'thin',
    )
    setNavBorderStyle(
      data.navBorderStyle === 'dashed' || data.navBorderStyle === 'dotted'
        ? data.navBorderStyle
        : 'solid',
    )
    const seed = SITE_PALETTES[data.colorPalette] ?? SITE_PALETTES['ivory-gold']
    setCustomColors(
      data.customColors ?? {
        bg: seed.bg,
        fg: seed.fg,
        accent: seed.accent,
        muted: seed.muted,
        card: seed.card,
      },
    )
    setSections(
      mergeSections(
        data.sections.map((section) =>
          section.type === 'PEOPLE'
            ? { ...section, people: peopleFromRoster(data.party?.members ?? []) }
            : section,
        ),
      ),
    )
  }

  function create() {
    startTransition(async () => {
      setError('')
      try {
        const { data } = await proxyClient.post<EditorEventSite>(`/events/${event.id}/site`, {
          slug,
          ownerAccessMode,
        })
        applySite(data)
        router.refresh()
      } catch (err) {
        setError(getErrorMessage(err, 'Could not create the site'))
      }
    })
  }

  function save() {
    startTransition(async () => {
      setError('')
      if (colorPalette === 'custom') {
        if (
          !normalizeHex(customColors.bg) ||
          !normalizeHex(customColors.fg) ||
          !normalizeHex(customColors.accent)
        ) {
          setError('Use hex colors like #1a1a1a')
          return
        }
      }
      try {
        if (pendingCover) {
          const body = new FormData()
          body.append('file', pendingCover)
          await proxyClient.post(`/events/${event.id}/site/cover`, body)
        }
        await persistPlace()
        const { data } = await proxyClient.patch<EditorEventSite>(`/events/${event.id}/site`, {
          slug,
          ownerAccessMode,
          included: event.parentId ? [] : included,
          themePreset,
          fontPair,
          colorPalette,
          buttonStyle,
          coverLayout,
          coverPhotoSide,
          showEventType,
          showEventTitle,
          navPlacement,
          navStyle,
          navAlign,
          navName,
          navBorder,
          navBorderWidth,
          navBorderStyle,
          customColors,
          sections: toPatchSections(sections),
        })
        clearPendingCover()
        applySite(data)
      } catch (err) {
        setError(getErrorMessage(err, 'Could not save'))
      }
    })
  }

  function publish() {
    startTransition(async () => {
      setError('')
      try {
        await persistPlace()
        const { data } = await proxyClient.post<EditorEventSite>(`/events/${event.id}/site/publish`)
        applySite(data)
      } catch (err) {
        setError(getErrorMessage(err, 'Could not publish'))
      }
    })
  }

  function unpublish() {
    startTransition(async () => {
      setError('')
      try {
        const { data } = await proxyClient.post<EditorEventSite>(
          `/events/${event.id}/site/unpublish`,
        )
        applySite(data)
      } catch (err) {
        setError(getErrorMessage(err, 'Could not unpublish'))
      }
    })
  }

  function remove() {
    if (!confirm('Delete this site? The event and guest list stay.')) return
    startTransition(async () => {
      setError('')
      try {
        await proxyClient.delete(`/events/${event.id}/site`)
        router.push(`/events/${event.id}`)
        router.refresh()
      } catch (err) {
        setError(getErrorMessage(err, 'Could not delete the site'))
      }
    })
  }

  async function persistPlace() {
    const next = place.trim()
    if (next === (event.location ?? '').trim()) return
    await proxyClient.patch(`/events/${event.id}`, { location: next })
    router.refresh()
  }

  async function uploadGalleryPhoto(file: File) {
    const body = new FormData()
    body.append('file', file)
    setError('')
    try {
      const { data } = await proxyClient.post<EditorEventSite>(
        `/events/${event.id}/site/photos`,
        body,
      )
      applySite(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'))
    }
  }

  async function uploadSectionImage(sectionId: string, file: File) {
    const body = new FormData()
    body.append('file', file)
    setError('')
    try {
      const { data } = await proxyClient.post<EditorEventSite>(
        `/events/${event.id}/site/sections/${sectionId}/photo`,
        body,
      )
      applySite(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'))
    }
  }

  async function removeSectionImage(sectionId: string) {
    setError('')
    try {
      const { data } = await proxyClient.delete<EditorEventSite>(
        `/events/${event.id}/site/sections/${sectionId}/photo`,
      )
      applySite(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove photo'))
    }
  }

  function applyParty(next: EventPartyRoster) {
    setSite((prev) => (prev ? { ...prev, party: next } : prev))
    setSections((prev) =>
      prev.map((section) =>
        section.type === 'PEOPLE'
          ? { ...section, people: peopleFromRoster(next.members) }
          : section,
      ),
    )
  }

  async function deletePhoto(photoId: string) {
    setError('')
    try {
      const { data } = await proxyClient.delete<EditorEventSite>(
        `/events/${event.id}/site/photos/${photoId}`,
      )
      applySite(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove photo'))
    }
  }

  function updateSection(key: string, patch: Partial<EventSiteSection>) {
    setSections((prev) => prev.map((s) => (sectionKey(s) === key ? { ...s, ...patch } : s)))
  }

  function moveSection(key: string, dir: -1 | 1) {
    setSections((prev) => {
      const cover = prev.find((s) => s.type === 'COVER')
      const rest = prev.filter((s) => s.type !== 'COVER')
      const i = rest.findIndex((s) => sectionKey(s) === key)
      const j = i + dir
      if (!cover || i < 0 || j < 0 || j >= rest.length) return prev
      const next = [...rest]
      ;[next[i], next[j]] = [next[j], next[i]]
      return [cover, ...next].map((s, idx) => ({ ...s, sortOrder: idx }))
    })
  }

  function isStepOpen(id: string) {
    return openSteps.includes(id)
  }

  function toggleStep(id: string) {
    const willOpen = !openSteps.includes(id)
    setOpenSteps((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
    if (willOpen && id === 'site-cover') focusCoverPreview()
  }

  function revealStep(id: string) {
    setOpenSteps((prev) => (prev.includes(id) ? prev : [...prev, id]))
    if (id === 'site-cover') focusCoverPreview()
  }

  function openPage(key: string) {
    setOpenPageKey(key)
    focusPreview(key)
  }

  function togglePage(key: string) {
    if (openPageKey === key) {
      setOpenPageKey(null)
      return
    }
    openPage(key)
  }

  function focusPreview(key: string) {
    setPreviewFocus((prev) => ({ key, tick: (prev?.tick ?? 0) + 1 }))
  }

  function focusCoverPreview() {
    const cover = sections.find((section) => section.type === 'COVER')
    if (cover) focusPreview(sectionKey(cover))
  }

  function addCustomSection() {
    const id = newId()
    setSections((prev) => {
      const customCount = prev.filter((s) => s.type === 'CUSTOM').length
      if (customCount >= MAX_CUSTOM_SECTIONS) return prev
      const added: EventSiteSection = {
        id,
        type: 'CUSTOM',
        enabled: true,
        sortOrder: prev.length,
        layout: 'vertical',
        title: 'New section',
        body: '',
      }
      return [...prev, added].map((s, i) => ({ ...s, sortOrder: i }))
    })
    revealStep('site-pages')
    openPage(id)
    focusPreview(id)
  }

  function removeCustomSection(key: string) {
    setSections((prev) =>
      prev.filter((s) => sectionKey(s) !== key).map((s, i) => ({ ...s, sortOrder: i })),
    )
    setOpenPageKey((prev) => (prev === key ? null : prev))
  }

  function toggleChild(childId: string) {
    setIncluded((prev) => {
      const existing = prev.find((row) => row.eventId === childId)
      if (existing) return prev.filter((row) => row.eventId !== childId)
      return [...prev, { eventId: childId, accessMode: 'INVITED_ONLY', hasOwnGuestList: true }]
    })
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-12">
        <Loader2
          className="animate-spin"
          size={20}
          style={{ color: 'var(--color-brand-primary)' }}
        />
      </div>
    )
  }

  if (!site) {
    return (
      <EditorPanel
        title="Start the page"
        hint="Guests will not see this until you publish. Pick a web address and who may open it."
      >
        <SiteUrlField host={host} value={slug} onChange={setSlug} placeholder="ada-and-chidi" />
        <AccessModePicker value={ownerAccessMode} onChange={setOwnerAccessMode} />
        {error && (
          <p className="text-sm" role="alert" style={{ color: 'var(--color-error, #c45c4a)' }}>
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={pending || !canUseSiteName(slug)}
          onClick={create}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
          style={{
            background: 'var(--color-brand-primary)',
            color: 'var(--color-primary-foreground)',
          }}
        >
          {pending ? 'Creating…' : 'Create draft'}
        </button>
      </EditorPanel>
    )
  }

  const publicPath = `/e/${site.slug}`
  const children = event.children ?? []
  const movable = sections.filter((s) => s.type !== 'COVER')
  const customCount = sections.filter((s) => s.type === 'CUSTOM').length
  const scheduleSection = sections.find((s) => s.type === 'SCHEDULE')
  const previewSlices = previewEventSlices(
    { ...event, location: place.trim() || null },
    included,
    site.schedule ?? scheduleItems,
    {
      showEventType,
      showEventTitle,
      scheduleEnabled: scheduleSection?.enabled === true,
      showTimes: scheduleSection?.showTimes !== false,
      showItemDirections: scheduleSection?.showItemDirections !== false,
      rsvpEnabled: sections.some((s) => s.type === 'RSVP' && s.enabled),
    },
  )
  const coverPhotoUrl = pendingCoverUrl ?? site.coverPhotoUrl

  const editorActions = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending || !canUseSiteName(slug)}
        onClick={save}
        className="min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
        style={{
          background: 'var(--color-brand-primary)',
          color: 'var(--color-primary-foreground)',
        }}
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {site.status === 'DRAFT' ? (
        <button
          type="button"
          disabled={pending}
          onClick={publish}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          Publish
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={unpublish}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          Unpublish
        </button>
      )}
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <div
          className="sticky top-0 z-20 space-y-3 py-3"
          style={{ background: 'var(--background)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase"
              style={{
                color: site.status === 'PUBLISHED' ? '#3d7a4a' : 'var(--color-muted)',
                background:
                  site.status === 'PUBLISHED'
                    ? 'rgba(61, 122, 74, 0.12)'
                    : 'color-mix(in srgb, var(--color-muted) 12%, transparent)',
              }}
            >
              {site.status === 'PUBLISHED' ? 'Live' : 'Draft — not public yet'}
            </span>
            {site.status === 'PUBLISHED' && (
              <a
                href={publicPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm underline underline-offset-2"
                style={{ color: 'var(--color-brand-primary)' }}
              >
                {host}
                {publicPath}
              </a>
            )}
          </div>
          <nav aria-label="Editor steps" className="flex flex-wrap gap-1.5">
            {EDITOR_STEPS.map((step, i) => {
              const current = isStepOpen(step.id)
              return (
                <a
                  key={step.id}
                  href={`#${step.id}`}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => revealStep(step.id)}
                  className="inline-flex min-h-11 items-center rounded-full border px-3 text-sm"
                  style={{
                    borderColor: current ? 'var(--color-brand-primary)' : 'var(--color-border)',
                    color: current ? 'var(--color-brand-primary)' : 'var(--color-text-primary)',
                    background: current
                      ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)'
                      : 'var(--card-bg)',
                  }}
                >
                  <span className="mr-1.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
                    {i + 1}
                  </span>
                  {step.label}
                </a>
              )
            })}
          </nav>
          {error && (
            <p className="text-sm" role="alert" style={{ color: 'var(--color-error, #c45c4a)' }}>
              {error}
            </p>
          )}
          {editorActions}
        </div>

        <EditorPanel
          id="site-share"
          step="1 · Share"
          title="Who can open it"
          hint="The web address and who may see this event. Save before you share."
          open={isStepOpen('site-share')}
          onToggle={() => toggleStep('site-share')}
        >
          <SiteUrlField host={host} value={slug} onChange={setSlug} />
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            If you change a live address, the old one stops working. There is no redirect.
          </p>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Signed in on this event, you can open the live page without a code. Guests unlock with
            the email on the list, or a site link you copy from the Guests tab.
          </p>
          <AccessModePicker value={ownerAccessMode} onChange={setOwnerAccessMode} />
          {children.length > 0 && !event.parentId && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Other events on this page
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
                  Turn on a child event to show it here. Each one can use its own guest list.
                </p>
              </div>
              {children.map((child) => {
                const row = included.find((i) => i.eventId === child.id)
                return (
                  <div
                    key={child.id}
                    className="space-y-2 rounded-xl p-3"
                    style={{ border: '1px solid var(--color-border)' }}
                  >
                    <CheckRow
                      checked={Boolean(row)}
                      onChange={() => toggleChild(child.id)}
                      label={child.title}
                    />
                    {row && (
                      <div className="space-y-2 pl-1">
                        <AccessModePicker
                          value={row.accessMode}
                          onChange={(accessMode) =>
                            setIncluded((prev) =>
                              prev.map((i) => (i.eventId === child.id ? { ...i, accessMode } : i)),
                            )
                          }
                        />
                        <CheckRow
                          checked={row.hasOwnGuestList}
                          onChange={(next) =>
                            setIncluded((prev) =>
                              prev.map((i) =>
                                i.eventId === child.id ? { ...i, hasOwnGuestList: next } : i,
                              ),
                            )
                          }
                          label="Own guest list and RSVP"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </EditorPanel>

        <EditorPanel
          id="site-style"
          step="2 · Style"
          title="Page look"
          hint="A theme sets fonts and colors together. You can still change each one."
          open={isStepOpen('site-style')}
          onToggle={() => toggleStep('site-style')}
        >
          <LookChoice
            label="Theme"
            value={themePreset}
            options={THEMES.map((id) => [id, THEME_LABELS[id]] as const)}
            onChange={(next) => {
              const pack = themePack(next)
              setThemePreset(pack.themePreset)
              setFontPair(pack.fontPair)
              setColorPalette(pack.colorPalette)
            }}
          />
          <LookChoice
            label="Fonts"
            value={fontPair}
            options={FONTS.map((id) => [id, FONT_LABELS[id]] as const)}
            onChange={setFontPair}
          />
          <LookChoice
            label="Colors"
            value={colorPalette === 'custom' ? '' : colorPalette}
            options={PALETTES.map((id) => [id, PALETTE_LABELS[id]] as const)}
            onChange={setColorPalette}
          />
          <button
            type="button"
            onClick={() => {
              if (colorPalette !== 'custom') {
                const seed = SITE_PALETTES[colorPalette] ?? SITE_PALETTES['ivory-gold']
                setCustomColors({
                  bg: seed.bg,
                  fg: seed.fg,
                  accent: seed.accent,
                  muted: seed.muted,
                  card: seed.card,
                })
              }
              setColorPalette('custom')
            }}
            className="min-h-11 rounded-full border px-3 text-sm"
            style={{
              borderColor:
                colorPalette === 'custom' ? 'var(--color-brand-primary)' : 'var(--color-border)',
              color:
                colorPalette === 'custom' ? 'var(--color-brand-primary)' : 'var(--color-muted)',
            }}
          >
            Use my own colors
          </button>
          {colorPalette === 'custom' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <HexField
                  label="Background"
                  value={customColors.bg}
                  onChange={(bg) => setCustomColors((c) => ({ ...c, bg }))}
                />
                <HexField
                  label="Text"
                  value={customColors.fg}
                  onChange={(fg) => setCustomColors((c) => ({ ...c, fg }))}
                />
                <HexField
                  label="Accent"
                  value={customColors.accent}
                  onChange={(accent) => setCustomColors((c) => ({ ...c, accent }))}
                />
                <HexField
                  label="Cards"
                  value={customColors.card ?? ''}
                  onChange={(card) => setCustomColors((c) => ({ ...c, card }))}
                />
              </div>
              {normalizeHex(customColors.bg) &&
                normalizeHex(customColors.fg) &&
                !bodyContrastOk(customColors.bg, customColors.fg) && (
                  <p
                    className="text-sm"
                    role="alert"
                    style={{ color: 'var(--color-error, #c45c4a)' }}
                  >
                    Text may be hard to read on this background. Try a darker text or a lighter
                    background.
                  </p>
                )}
            </div>
          )}
          <LookChoice
            label="Buttons"
            value={buttonStyle}
            options={BUTTONS.map((id) => [id, BUTTON_LABELS[id]] as const)}
            onChange={setButtonStyle}
          />
        </EditorPanel>

        <EditorPanel
          id="site-menu"
          step="3 · Menu"
          title="Name and links at the top"
          hint="This is the invitation bar guests use to jump around the page."
          open={isStepOpen('site-menu')}
          onToggle={() => toggleStep('site-menu')}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Name in the menu
            </span>
            <input
              value={navName}
              onChange={(e) => setNavName(e.target.value)}
              maxLength={80}
              className="min-h-11 w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={fieldStyle}
              placeholder={event.title || 'Amaka & Kemi'}
            />
            <span className="block text-sm" style={{ color: 'var(--color-muted)' }}>
              Leave blank to use the event title.
            </span>
          </label>
          <LookChoice
            label="Where the name sits"
            value={navAlign}
            options={[
              ['above', 'Above the links'],
              ['before', 'Beside the links'],
              ['below', 'Under the links'],
            ]}
            onChange={setNavAlign}
          />
          <LookChoice
            label="Menu place"
            value={navPlacement}
            options={[
              ['top', 'Across the top'],
              ['side', 'Down the side'],
            ]}
            onChange={setNavPlacement}
          />
          <LookChoice
            label="How the links look"
            value={navStyle}
            options={[
              ['line', 'Plain words'],
              ['underline', 'Underline'],
              ['pill', 'Pills'],
              ['solid', 'Panel'],
            ]}
            onChange={setNavStyle}
          />
          <LookChoice
            label="Line under the menu"
            value={navBorder}
            options={[
              ['on', 'Show'],
              ['off', 'Hide'],
            ]}
            onChange={setNavBorder}
          />
          {navBorder === 'on' && (
            <>
              <LookChoice
                label="Line thickness"
                value={navBorderWidth}
                options={[
                  ['thin', 'Thin'],
                  ['medium', 'Medium'],
                  ['thick', 'Thick'],
                ]}
                onChange={setNavBorderWidth}
              />
              <LookChoice
                label="Line style"
                value={navBorderStyle}
                options={[
                  ['solid', 'Solid'],
                  ['dashed', 'Dashed'],
                  ['dotted', 'Dotted'],
                ]}
                onChange={setNavBorderStyle}
              />
            </>
          )}
        </EditorPanel>

        <EditorPanel
          id="site-cover"
          step="4 · Cover"
          title="First screen guests see"
          hint="The cover text comes from this event. You choose which lines to show, then how the photo sits."
          open={isStepOpen('site-cover')}
          onToggle={() => toggleStep('site-cover')}
        >
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Cover text
              </h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
                Date always shows if the event has it. Place is the same address as Venue.{' '}
                <Link
                  href={`/events/${event.id}`}
                  className="underline underline-offset-2"
                  style={{ color: 'var(--color-brand-primary)' }}
                >
                  Edit the event
                </Link>{' '}
                to change the date. Type and name are optional.
              </p>
            </div>
            <CoverFact
              label="Date"
              value={coverDateLabel(event.estimatedDate)}
              empty="No date on the event yet"
            />
            <CoverFact
              label="Place"
              value={place.trim() || null}
              empty="No place on the event yet"
            />
            <LookChoice
              label={`Event type — ${EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}`}
              value={showEventType ? 'show' : 'hide'}
              options={[
                ['show', 'Show'],
                ['hide', 'Hide'],
              ]}
              onChange={(next) => setShowEventType(next === 'show')}
            />
            <LookChoice
              label={`Event name — ${event.title || 'untitled'}`}
              value={showEventTitle ? 'show' : 'hide'}
              options={[
                ['show', 'Show'],
                ['hide', 'Hide'],
              ]}
              onChange={(next) => setShowEventTitle(next === 'show')}
            />
          </div>
          <CoverLayoutChoice value={coverLayout} onChange={setCoverLayout} />
          {coverLayout === 'split' && (
            <LookChoice
              label="Photo beside the text"
              value={coverPhotoSide}
              options={[
                ['left', 'Photo on the left'],
                ['right', 'Photo on the right'],
              ]}
              onChange={setCoverPhotoSide}
            />
          )}
          {coverPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPhotoUrl}
              alt={event.title}
              className="h-40 w-full rounded-xl object-cover"
            />
          )}
          <SiteFileButton
            label={coverPhotoUrl ? 'Replace cover photo' : 'Choose cover photo'}
            onFile={stageCover}
          />
          {pendingCover ? (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Preview only. Save to keep this photo.{' '}
              <button
                type="button"
                onClick={clearPendingCover}
                className="min-h-11 underline underline-offset-2"
              >
                Discard
              </button>
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Shown on the guest page after you save.
            </p>
          )}
        </EditorPanel>

        <EditorPanel
          id="site-pages"
          step="5 · Pages"
          title="Pages guests can open"
          hint="Open one page, write it, then show it to guests. Numbers are the guest order. Home stays first."
          open={isStepOpen('site-pages')}
          onToggle={() => toggleStep('site-pages')}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addCustomSection}
              disabled={customCount >= MAX_CUSTOM_SECTIONS}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-medium disabled:opacity-40"
              style={{
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Plus size={16} />
              Add a page
            </button>
          </div>
          {sections.map((section) => {
            const key = sectionKey(section)
            const restIndex = movable.findIndex((s) => sectionKey(s) === key)
            const canMoveUp = section.type !== 'COVER' && restIndex > 0
            const canMoveDown =
              section.type !== 'COVER' && restIndex >= 0 && restIndex < movable.length - 1
            const label = sectionLabel(section)
            const canCollapse = section.type !== 'COVER'
            const open = canCollapse && openPageKey === key
            const panelId = `site-page-${key}`
            const writing = section.type === 'COVER' ? previewFocusKey === key : open
            const guestIndex = section.enabled
              ? sections.filter((item) => item.enabled && item.sortOrder <= section.sortOrder)
                  .length
              : null
            return (
              <div
                key={key}
                className="space-y-3 rounded-xl p-3"
                style={{
                  border: `1px solid ${writing ? 'var(--color-brand-primary)' : 'var(--color-border)'}`,
                  background: writing
                    ? 'color-mix(in srgb, var(--color-brand-primary) 6%, transparent)'
                    : 'var(--color-card)',
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="w-6 shrink-0 text-sm tabular-nums"
                    style={{ color: 'var(--color-muted)' }}
                    aria-hidden={!guestIndex}
                  >
                    {guestIndex ?? '—'}
                  </p>
                  {canCollapse ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => togglePage(key)}
                      className="min-h-11 min-w-0 flex-1 text-left"
                    >
                      <span
                        className="block text-sm font-semibold break-words"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {label}
                      </span>
                      <span className="block text-sm" style={{ color: 'var(--color-muted)' }}>
                        {section.enabled ? 'Shown to guests' : 'Hidden from guests'}
                      </span>
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold break-words"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {label}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                        Always first. Photo and title are in Cover.
                      </p>
                    </div>
                  )}
                  {canCollapse ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => togglePage(key)}
                      aria-label={open ? `Done writing ${label}` : `Write ${label}`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-medium"
                      style={{
                        borderColor: 'var(--color-brand-primary)',
                        color: 'var(--color-brand-primary)',
                        background: open
                          ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)'
                          : 'var(--color-card)',
                      }}
                    >
                      {open ? 'Done' : 'Write'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        revealStep('site-cover')
                        focusCoverPreview()
                      }}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-medium"
                      style={{
                        borderColor: 'var(--color-brand-primary)',
                        color: 'var(--color-brand-primary)',
                      }}
                    >
                      Open Cover
                    </button>
                  )}
                  {section.type !== 'COVER' && (
                    <OrderButtons
                      label={label}
                      canUp={canMoveUp}
                      canDown={canMoveDown}
                      onUp={() => moveSection(key, -1)}
                      onDown={() => moveSection(key, 1)}
                    />
                  )}
                </div>
                {open && (
                  <div
                    id={panelId}
                    className="space-y-4 border-t pt-3"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <CheckRow
                      checked={section.enabled}
                      onChange={(enabled) => {
                        updateSection(key, { enabled })
                        if (enabled) focusPreview(key)
                      }}
                      label="Show this page to guests"
                    />
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                      {sectionHint(section)}
                    </p>
                    {section.type === 'CUSTOM' && (
                      <>
                        <LabeledField label="Section title">
                          <input
                            value={section.title ?? ''}
                            onChange={(e) => updateSection(key, { title: e.target.value })}
                            maxLength={80}
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                            style={fieldStyle}
                          />
                        </LabeledField>
                        <LabeledField label="What guests should know">
                          <textarea
                            value={section.body ?? ''}
                            onChange={(e) => updateSection(key, { body: e.target.value })}
                            rows={4}
                            maxLength={8000}
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                            style={fieldStyle}
                          />
                        </LabeledField>
                      </>
                    )}
                    {section.type === 'ABOUT' && (
                      <StoryEditor
                        value={section.about ?? ''}
                        onChange={(about) => updateSection(key, { about })}
                      />
                    )}
                    {section.type === 'DRESS_CODE' && (
                      <LabeledField label="What to wear">
                        <textarea
                          value={section.dressCode ?? ''}
                          onChange={(e) => updateSection(key, { dressCode: e.target.value })}
                          rows={4}
                          maxLength={8000}
                          className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                          style={fieldStyle}
                          placeholder="Black tie, traditional attire…"
                        />
                      </LabeledField>
                    )}
                    {section.type === 'STAY' && (
                      <LabeledField label="Where to stay">
                        <textarea
                          value={section.stay ?? ''}
                          onChange={(e) => updateSection(key, { stay: e.target.value })}
                          rows={4}
                          maxLength={8000}
                          className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                          style={fieldStyle}
                          placeholder="Hotels, room blocks, where to stay"
                        />
                      </LabeledField>
                    )}
                    {section.type === 'TRAVEL' && (
                      <LabeledField label="How to get there">
                        <textarea
                          value={section.travel ?? ''}
                          onChange={(e) => updateSection(key, { travel: e.target.value })}
                          rows={4}
                          maxLength={8000}
                          className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                          style={fieldStyle}
                          placeholder="Airports, driving, getting around"
                        />
                      </LabeledField>
                    )}
                    {section.type === 'PEOPLE' && (
                      <PartySitePanel eventId={event.id} party={site.party} onChange={applyParty} />
                    )}
                    {section.type === 'FAQ' && (
                      <>
                        <CatalogToggle
                          label="How questions open"
                          value={section.faqStyle === 'accordion' ? 'accordion' : 'stack'}
                          options={[
                            ['stack', 'All open'],
                            ['accordion', 'One at a time'],
                          ]}
                          onChange={(faqStyle) => updateSection(key, { faqStyle })}
                        />
                        <PairList
                          rows={section.faq ?? []}
                          a="question"
                          b="answer"
                          max={30}
                          maxA={200}
                          maxB={2000}
                          onChange={(faq) => updateSection(key, { faq })}
                        />
                      </>
                    )}
                    {section.type === 'GIFTS' && (
                      <>
                        <CatalogToggle
                          label="How links look"
                          value={section.giftsStyle === 'buttons' ? 'buttons' : 'links'}
                          options={[
                            ['links', 'Text links'],
                            ['buttons', 'Buttons'],
                          ]}
                          onChange={(giftsStyle) => updateSection(key, { giftsStyle })}
                        />
                        <PairList
                          rows={section.gifts ?? []}
                          a="label"
                          b="url"
                          max={20}
                          maxA={80}
                          maxB={500}
                          onChange={(gifts) => updateSection(key, { gifts })}
                        />
                      </>
                    )}
                    {section.type === 'SCHEDULE' && (
                      <div className="space-y-2">
                        <CatalogToggle
                          label="How the schedule looks"
                          value={
                            section.scheduleStyle === 'timeline' ||
                            section.scheduleStyle === 'cards'
                              ? section.scheduleStyle
                              : 'list'
                          }
                          options={[
                            ['list', 'List'],
                            ['timeline', 'Timeline'],
                            ['cards', 'Cards'],
                          ]}
                          onChange={(scheduleStyle) => updateSection(key, { scheduleStyle })}
                        />
                        <CheckRow
                          checked={section.groupByDay !== false}
                          onChange={(groupByDay) => updateSection(key, { groupByDay })}
                          label="Group by day"
                        />
                        <CheckRow
                          checked={section.showTimes !== false}
                          onChange={(showTimes) => updateSection(key, { showTimes })}
                          label="Show times"
                        />
                        <CheckRow
                          checked={section.showItemDirections !== false}
                          onChange={(showItemDirections) =>
                            updateSection(key, { showItemDirections })
                          }
                          label="Directions on each stop"
                        />
                        <LabeledField label="Intro for guests (optional)">
                          <textarea
                            value={section.note ?? ''}
                            onChange={(e) => updateSection(key, { note: e.target.value })}
                            rows={2}
                            maxLength={2000}
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                            style={fieldStyle}
                          />
                        </LabeledField>
                      </div>
                    )}
                    {section.type === 'WHERE' && (
                      <div className="space-y-2">
                        <LabeledField label="Address">
                          <input
                            value={place}
                            onChange={(e) => setPlace(e.target.value)}
                            onBlur={() => {
                              void persistPlace().catch((err) =>
                                setError(getErrorMessage(err, 'Could not save the address')),
                              )
                            }}
                            maxLength={200}
                            autoComplete="street-address"
                            placeholder="Street, city, or venue name"
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                            style={fieldStyle}
                          />
                        </LabeledField>
                        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                          Same place as the event. Directions and the map use this.
                        </p>
                        {section.map !== 'off' && !place.trim() && (
                          <p
                            className="text-sm"
                            role="alert"
                            style={{ color: 'var(--color-error, #c45c4a)' }}
                          >
                            Add an address to show directions or a map.
                          </p>
                        )}
                        <CatalogToggle
                          label="Map"
                          value={
                            section.map === 'off' || section.map === 'embed' ? section.map : 'link'
                          }
                          options={[
                            ['off', 'No map'],
                            ['link', 'Directions'],
                            ['embed', 'Embed'],
                          ]}
                          onChange={(map) => updateSection(key, { map })}
                        />
                        <LabeledField label="Parking and extra notes">
                          <textarea
                            value={section.note ?? ''}
                            onChange={(e) => updateSection(key, { note: e.target.value })}
                            rows={2}
                            maxLength={2000}
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                            style={fieldStyle}
                            placeholder="Parking, entrance, extra notes"
                          />
                        </LabeledField>
                      </div>
                    )}
                    {section.type === 'RSVP' && (
                      <div className="space-y-2">
                        <LabeledField label="Note above the RSVP">
                          <textarea
                            value={section.intro ?? ''}
                            onChange={(e) => updateSection(key, { intro: e.target.value })}
                            rows={2}
                            maxLength={500}
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                            style={fieldStyle}
                            placeholder="A short note above the RSVP"
                          />
                        </LabeledField>
                        <CheckRow
                          checked={section.rsvpOpen !== false}
                          onChange={(rsvpOpen) => updateSection(key, { rsvpOpen })}
                          label="RSVP is open"
                        />
                        <CheckRow
                          checked={section.allowMaybe !== false}
                          onChange={(allowMaybe) => updateSection(key, { allowMaybe })}
                          label="Allow Maybe"
                        />
                        <CheckRow
                          checked={section.collectPlusOne !== false}
                          onChange={(collectPlusOne) => updateSection(key, { collectPlusOne })}
                          label="Ask for a plus-one"
                        />
                        <CheckRow
                          checked={section.collectDietary !== false}
                          onChange={(collectDietary) => updateSection(key, { collectDietary })}
                          label="Ask about dietary needs"
                        />
                        <CheckRow
                          checked={section.collectMessage !== false}
                          onChange={(collectMessage) => updateSection(key, { collectMessage })}
                          label="Ask for a guest note"
                        />
                        <label className="block space-y-1">
                          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                            Deadline (optional)
                          </span>
                          <input
                            type="date"
                            value={section.deadline ?? ''}
                            onChange={(e) => updateSection(key, { deadline: e.target.value })}
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                            style={fieldStyle}
                          />
                        </label>
                      </div>
                    )}
                    {section.type !== 'PHOTOS' && (
                      <div className="space-y-3">
                        <LayoutToggle
                          label="Photo and text"
                          value={sectionLayout(section)}
                          onChange={(layout) => updateSection(key, { layout })}
                        />
                        {section.type === 'PEOPLE' && (
                          <CatalogToggle
                            label="How people look"
                            value={section.peopleStyle === 'cards' ? 'cards' : 'circles'}
                            options={[
                              ['circles', 'Circles'],
                              ['cards', 'Cards'],
                            ]}
                            onChange={(peopleStyle) => updateSection(key, { peopleStyle })}
                          />
                        )}
                      </div>
                    )}
                    {canHaveHero(section.type) && (
                      <SectionImageField
                        image={section.image}
                        disabled={!section.id}
                        onUpload={(file) => {
                          if (section.id) void uploadSectionImage(section.id, file)
                        }}
                        onRemove={() => {
                          if (section.id) void removeSectionImage(section.id)
                        }}
                      />
                    )}
                    {section.type === 'PHOTOS' && (
                      <div className="space-y-3">
                        <GalleryDisplayOptions
                          photosStyle={section.photosStyle === 'slider' ? 'slider' : 'grid'}
                          photosSize={
                            section.photosSize === 'small' || section.photosSize === 'large'
                              ? section.photosSize
                              : 'medium'
                          }
                          onStyle={(photosStyle) => updateSection(key, { photosStyle })}
                          onSize={(photosSize) => updateSection(key, { photosSize })}
                        />
                        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                          Gallery ({site.photos.length}/24)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {site.photos.map((photo) => (
                            <div key={photo.id} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt=""
                                className="h-24 w-full rounded-lg object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => void deletePhoto(photo.id)}
                                className="bg-overlay text-inverse-fg absolute top-1 right-1 min-h-11 min-w-11 rounded px-2 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                        {site.photos.length < 24 && (
                          <SiteFileButton
                            label="Add a photo"
                            onFile={(file) => void uploadGalleryPhoto(file)}
                          />
                        )}
                      </div>
                    )}
                    {section.type === 'CUSTOM' && (
                      <button
                        type="button"
                        onClick={() => removeCustomSection(key)}
                        className="inline-flex min-h-11 items-center gap-1 text-sm"
                        style={{ color: 'var(--color-error, #c45c4a)' }}
                      >
                        <Trash2 size={16} aria-hidden />
                        Remove this page
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </EditorPanel>

        {error && (
          <p className="text-sm" role="alert" style={{ color: 'var(--color-error, #c45c4a)' }}>
            {error}
          </p>
        )}

        {editorActions}

        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="min-h-11 self-start rounded-xl px-3 text-sm font-medium disabled:opacity-40"
          style={{ color: 'var(--color-error, #c45c4a)' }}
        >
          Delete site
        </button>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(var(--app-vh)-2rem)]">
        <div
          className="overflow-hidden rounded-2xl"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Guest preview
            </p>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Updates as you edit. Save to keep it.
            </p>
          </div>
          <div
            ref={previewPaneRef}
            className="max-h-[min(70vh,44rem)] min-w-0 overflow-auto lg:max-h-[calc(var(--app-vh)-6rem)]"
          >
            <EventSiteView
              preview
              compact
              className="min-h-[28rem]"
              look={{
                themePreset,
                fontPair,
                colorPalette,
                buttonStyle,
                coverLayout,
                coverPhotoSide,
                showEventType,
                showEventTitle,
                navPlacement,
                navStyle,
                navAlign,
                navName,
                navBorder,
                navBorderWidth,
                navBorderStyle,
                customColors,
                coverPhotoUrl,
              }}
              sections={sections}
              photos={sections.some((s) => s.type === 'PHOTOS' && s.enabled) ? site.photos : []}
              owner={{
                eventId: event.id,
                title: showEventTitle ? event.title : '',
                eventType: showEventType ? event.eventType : '',
                estimatedDate: event.estimatedDate,
                location: place.trim() || null,
              }}
              events={previewSlices}
            />
          </div>
        </div>
      </aside>
    </div>
  )
}

function EditorPanel({
  id,
  step,
  title,
  hint,
  children,
  open = true,
  onToggle,
}: {
  id?: string
  step?: string
  title: string
  hint: string
  children: ReactNode
  open?: boolean
  onToggle?: () => void
}) {
  const bodyId = id ? `${id}-body` : undefined
  const heading = (
    <>
      {step && (
        <p
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: 'var(--color-muted)' }}
        >
          {step}
        </p>
      )}
      <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {title}
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {hint}
      </p>
    </>
  )
  return (
    <section
      id={id}
      className="scroll-mt-36 space-y-4 rounded-2xl p-4 sm:p-5"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
    >
      {onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-11 w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0 flex-1">{heading}</div>
          <ChevronDown
            size={18}
            aria-hidden
            className={`mt-1 shrink-0 motion-reduce:transform-none ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--color-text-primary)' }}
          />
        </button>
      ) : (
        <div>{heading}</div>
      )}
      {(!onToggle || open) && (
        <div id={bodyId} className="space-y-4">
          {children}
        </div>
      )}
    </section>
  )
}

function coverDateLabel(value: string | Date | null | undefined) {
  const key = eventDateKey(value)
  if (!key) return null
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function CoverFact({
  label,
  value,
  empty,
}: {
  label: string
  value: string | null
  empty: string
}) {
  return (
    <div>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </p>
      <p
        className="mt-0.5 text-sm"
        style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-muted)' }}
      >
        {value ?? empty}
      </p>
    </div>
  )
}

function CoverLayoutChoice({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        How the photo sits
      </legend>
      <div className="grid gap-2">
        {COVER_LAYOUTS.map((option) => {
          const selected = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className="min-h-11 rounded-xl border px-3 py-2 text-left"
              style={{
                borderColor: selected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                background: selected
                  ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)'
                  : 'var(--color-card)',
                color: 'var(--color-text-primary)',
              }}
            >
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="block text-sm" style={{ color: 'var(--color-muted)' }}>
                {option.hint}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function OrderButtons({
  label,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  label: string
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div role="group" aria-label={`Move ${label}`} className="flex shrink-0 items-center">
      <button
        type="button"
        disabled={!canUp}
        onClick={onUp}
        className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm disabled:opacity-30"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <ChevronUp size={16} aria-hidden />
        Up
      </button>
      <button
        type="button"
        disabled={!canDown}
        onClick={onDown}
        className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm disabled:opacity-30"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <ChevronDown size={16} aria-hidden />
        Down
      </button>
    </div>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label
      className={`flex min-h-11 min-w-0 items-center gap-2 text-sm ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      style={{ color: disabled ? 'var(--color-muted)' : 'var(--color-text-primary)' }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0"
      />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  )
}

function AccessModePicker({
  value,
  onChange,
}: {
  value: EventSiteAccessMode
  onChange: (next: EventSiteAccessMode) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        Who can open this event
      </legend>
      <div className="grid gap-2">
        {(
          [
            ['INVITED_ONLY', 'Invited only', 'People on this guest list'],
            ['OPEN', 'Anyone with the link', 'They can see this event and RSVP'],
          ] as const
        ).map(([mode, label, hint]) => {
          const selected = value === mode
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(mode)}
              className="min-h-11 rounded-xl border px-3 py-2 text-left"
              style={{
                borderColor: selected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                background: selected
                  ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)'
                  : 'var(--color-card)',
                color: 'var(--color-text-primary)',
              }}
            >
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-sm" style={{ color: 'var(--color-muted)' }}>
                {hint}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function GalleryDisplayOptions({
  photosStyle,
  photosSize,
  onStyle,
  onSize,
}: {
  photosStyle: EventSitePhotosStyle
  photosSize: EventSitePhotosSize
  onStyle: (next: EventSitePhotosStyle) => void
  onSize: (next: EventSitePhotosSize) => void
}) {
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          How guests see photos
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['grid', 'Grid', 'All photos at once'],
              ['slider', 'Slideshow', 'One large photo at a time'],
            ] as const
          ).map(([id, title, hint]) => {
            const selected = photosStyle === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => onStyle(id)}
                className="min-h-11 rounded-xl border px-3 py-2 text-left"
                style={{
                  borderColor: selected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                  background: selected
                    ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)'
                    : 'var(--color-card)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-[11px]" style={{ color: 'var(--color-muted)' }}>
                  {hint}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Photo size
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['small', 'Small'],
              ['medium', 'Medium'],
              ['large', 'Large'],
            ] as const
          ).map(([id, label]) => {
            const selected = photosSize === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSize(id)}
                className="min-h-11 min-w-11 rounded-full border px-3 text-sm"
                style={{
                  borderColor: selected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                  color: selected ? 'var(--color-brand-primary)' : 'var(--color-muted)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}

function PairList<A extends string, B extends string>({
  rows,
  a,
  b,
  max,
  maxA,
  maxB,
  onChange,
}: {
  rows: Record<A | B, string>[]
  a: A
  b: B
  max: number
  maxA: number
  maxB: number
  onChange: (next: Record<A | B, string>[]) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={row[a]}
            maxLength={maxA}
            onChange={(e) =>
              onChange(rows.map((r, j) => (j === i ? { ...r, [a]: e.target.value } : r)))
            }
            className="min-h-11 w-full min-w-0 rounded-lg px-2 py-1.5 text-sm focus:outline-none sm:w-1/2"
            style={fieldStyle}
            placeholder={a}
            aria-label={a}
          />
          <input
            value={row[b]}
            maxLength={maxB}
            onChange={(e) =>
              onChange(rows.map((r, j) => (j === i ? { ...r, [b]: e.target.value } : r)))
            }
            className="min-h-11 w-full min-w-0 rounded-lg px-2 py-1.5 text-sm focus:outline-none sm:w-1/2"
            style={fieldStyle}
            placeholder={b}
            aria-label={b}
          />
        </div>
      ))}
      {rows.length < max && (
        <button
          type="button"
          onClick={() => onChange([...rows, { [a]: '', [b]: '' } as Record<A | B, string>])}
          className="text-[11px] underline"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          Add
        </button>
      )}
    </div>
  )
}
