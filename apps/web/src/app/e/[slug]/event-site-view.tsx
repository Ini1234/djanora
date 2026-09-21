'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { backend } from '@/lib/backend'
import { getErrorMessage } from '@/lib/errors'
import type {
  Event,
  EventSiteSection,
  EventSiteSectionLayout,
  EventSiteSectionType,
  PublicEventSite,
  PublicEventSlice,
} from '@/lib/api.types'
import { eventDateKey } from '@/lib/event-timing'
import { CoverBlock } from './cover-block'
import { buttonClass, siteLookVars } from './site-look'
import { mapsSearchUrl } from './site-maps'
import { GalleryBlock } from './gallery-block'
import { SiteNav } from './site-nav'
import { StoryHtml } from './story-html'

const SESSION_HEADER = 'X-Event-Site-Session'

const NAV_LABELS: Record<Exclude<EventSiteSectionType, 'CUSTOM'>, string> = {
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

export function sectionAnchor(section: Pick<EventSiteSection, 'type' | 'id' | 'sortOrder'>) {
  if (section.type === 'CUSTOM') return `site-custom-${section.id ?? section.sortOrder}`
  return `site-${section.type.toLowerCase()}`
}

function sectionNavLabel(section: EventSiteSection) {
  if (section.type === 'CUSTOM') return section.title?.trim() || 'Section'
  return NAV_LABELS[section.type]
}

function sectionKey(section: EventSiteSection) {
  return section.id ?? `${section.type}-${section.sortOrder}`
}

export function sectionLayout(section: EventSiteSection): EventSiteSectionLayout {
  return section.layout === 'horizontal' ? 'horizontal' : 'vertical'
}

function safeGiftHref(raw?: string) {
  const href = raw?.trim() ?? ''
  if (!href) return null
  const lower = href.toLowerCase()
  if (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return href
  }
  return null
}

export function formatSiteDate(value: string | null) {
  const key = eventDateKey(value)
  if (!key) return null
  const date = new Date(`${key}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function previewEventSlices(
  event: Event,
  included: {
    eventId: string
    accessMode: PublicEventSlice['accessMode']
    hasOwnGuestList: boolean
  }[],
  schedule?: PublicEventSlice['schedule'] | Event['schedule'] | null,
  view?: {
    showEventType?: boolean
    showEventTitle?: boolean
    scheduleEnabled?: boolean
    showTimes?: boolean
    showItemDirections?: boolean
    rsvpEnabled?: boolean
  },
): PublicEventSlice[] {
  const showTimes = view?.showTimes !== false
  const showDirections = view?.showItemDirections !== false
  const scheduleOn = view?.scheduleEnabled !== false
  const owner: PublicEventSlice = {
    eventId: event.id,
    title: view?.showEventTitle ? event.title : '',
    eventType: view?.showEventType ? event.eventType : '',
    estimatedDate: event.estimatedDate,
    location: event.location,
    accessMode: 'INVITED_ONLY',
    hasOwnGuestList: true,
    schedule: scheduleOn
      ? (schedule ?? event.schedule ?? [])
          .filter((item) => !('showOnSite' in item) || Boolean(item.showOnSite))
          .map((item) => ({
            id: item.id,
            title: item.title,
            date: item.date,
            startTime: showTimes ? item.startTime : null,
            endTime: showTimes ? item.endTime : null,
            location: item.location,
            directionsUrl:
              showDirections && item.location ? mapsSearchUrl(item.location).google : null,
          }))
      : [],
    canRsvp: view?.rsvpEnabled !== false,
  }
  const children = (event.children ?? [])
    .filter((child) => included.some((row) => row.eventId === child.id))
    .map((child) => {
      const row = included.find((item) => item.eventId === child.id)!
      return {
        eventId: child.id,
        title: child.title,
        eventType: child.eventType,
        estimatedDate: child.estimatedDate,
        location: child.location ?? null,
        accessMode: row.accessMode,
        hasOwnGuestList: row.hasOwnGuestList,
        schedule: [],
        canRsvp: view?.rsvpEnabled !== false && row.hasOwnGuestList,
      } satisfies PublicEventSlice
    })
  return [owner, ...children]
}

export function EventSiteView({
  look,
  sections,
  photos,
  owner,
  events,
  preview = false,
  compact = false,
  className = 'min-h-screen',
  rsvp,
  footer,
}: {
  look: PublicEventSite['look']
  sections: EventSiteSection[]
  photos: { id: string; url: string }[]
  owner: Pick<PublicEventSlice, 'title' | 'eventType' | 'estimatedDate' | 'location' | 'eventId'>
  events: PublicEventSlice[]
  preview?: boolean
  compact?: boolean
  className?: string
  rsvp?: {
    slug: string
    token: string | null
    onDone: (eventId: string, next: { status: string; rsvpAt: string | null }) => void
  }
  footer?: ReactNode
}) {
  const enabled = [...sections].filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder)
  const navPlacement = look.navPlacement === 'side' ? 'side' : 'top'
  const navItems = enabled.map((section) => ({
    key: sectionKey(section),
    anchor: sectionAnchor(section),
    label: sectionNavLabel(section),
    type: section.type,
  }))
  const mainClass = compact
    ? 'mx-auto min-w-0 max-w-3xl px-3 py-6'
    : 'mx-auto min-w-0 max-w-3xl px-4 pt-6 pb-10 sm:px-6'

  const main = (
    <main
      id={preview || compact ? undefined : 'main-content'}
      tabIndex={preview || compact ? undefined : -1}
      className={mainClass}
    >
      {enabled.map((section) => (
        <SiteSection
          key={sectionKey(section)}
          section={section}
          look={look}
          photos={photos}
          owner={owner}
          events={events}
          preview={preview}
          rsvp={rsvp}
        />
      ))}
      {footer}
    </main>
  )

  const sideDesktop = navPlacement === 'side' && !compact
  const compactSide = compact && navPlacement === 'side'

  useEffect(() => {
    if (preview || compact || window.location.hash) return
    window.scrollTo(0, 0)
  }, [preview, compact])

  return (
    <div
      className={`event-site min-w-0 motion-reduce:transition-none ${className}`}
      data-theme={look.themePreset || 'linen'}
      data-compact={compact ? '' : undefined}
      style={siteLookVars(look)}
    >
      <div
        className={
          sideDesktop ? 'lg:pl-[12.5rem]' : compactSide ? 'flex min-w-0 items-start' : undefined
        }
      >
        <SiteNav look={look} items={navItems} ownerTitle={owner.title} compact={compact} />
        <div className={compactSide ? 'min-w-0 flex-1' : undefined}>{main}</div>
      </div>
    </div>
  )
}

function SiteSection({
  section,
  look,
  photos,
  owner,
  events,
  preview,
  rsvp,
}: {
  section: EventSiteSection
  look: PublicEventSite['look']
  photos: { id: string; url: string }[]
  owner: Pick<PublicEventSlice, 'title' | 'eventType' | 'estimatedDate' | 'location' | 'eventId'>
  events: PublicEventSlice[]
  preview: boolean
  rsvp?: {
    slug: string
    token: string | null
    onDone: (eventId: string, next: { status: string; rsvpAt: string | null }) => void
  }
}) {
  const horizontal = sectionLayout(section) === 'horizontal'

  if (section.type === 'COVER') {
    return <CoverBlock look={look} owner={owner} id={sectionAnchor(section)} preview={preview} />
  }

  if (section.type === 'ABOUT') {
    return (
      <SectionShell title={NAV_LABELS.ABOUT} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.ABOUT}>
          <StoryHtml html={section.about} emptyLabel={preview ? 'Add your story.' : undefined} />
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'DRESS_CODE') {
    return (
      <SectionShell
        title={NAV_LABELS.DRESS_CODE}
        horizontal={horizontal}
        id={sectionAnchor(section)}
      >
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.DRESS_CODE}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {section.dressCode || (preview ? 'Tell guests what to wear.' : '')}
          </p>
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'WHERE') {
    return (
      <SectionShell title={NAV_LABELS.WHERE} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.WHERE}>
          <WhereBlock
            location={owner.location}
            map={section.map}
            note={section.note}
            preview={preview}
          />
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'SCHEDULE') {
    return (
      <SectionShell title={NAV_LABELS.SCHEDULE} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.SCHEDULE}>
          <ScheduleBlock
            events={events}
            ownerEventId={owner.eventId}
            horizontal={horizontal}
            section={section}
            preview={preview}
          />
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'PEOPLE') {
    return (
      <SectionShell title={NAV_LABELS.PEOPLE} horizontal={horizontal} id={sectionAnchor(section)}>
        <PartyBlock
          people={section.people ?? []}
          style={section.peopleStyle}
          horizontal={horizontal}
          preview={preview}
        />
      </SectionShell>
    )
  }

  if (section.type === 'FAQ') {
    return (
      <SectionShell title={NAV_LABELS.FAQ} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.FAQ}>
          <FaqBlock items={section.faq ?? []} style={section.faqStyle} horizontal={horizontal} />
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'GIFTS') {
    return (
      <SectionShell title={NAV_LABELS.GIFTS} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.GIFTS}>
          <GiftsBlock
            gifts={section.gifts ?? []}
            style={section.giftsStyle}
            buttonStyle={look.buttonStyle}
          />
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'TRAVEL') {
    return (
      <SectionShell title={NAV_LABELS.TRAVEL} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.TRAVEL}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {section.travel || (preview ? 'Add travel notes for guests.' : '')}
          </p>
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'STAY') {
    return (
      <SectionShell title={NAV_LABELS.STAY} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.STAY}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {section.stay || (preview ? 'Add hotels and where to stay.' : '')}
          </p>
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'PHOTOS') {
    return (
      <SectionShell title={NAV_LABELS.PHOTOS} horizontal={horizontal} id={sectionAnchor(section)}>
        <GalleryBlock
          photos={photos}
          photosStyle={section.photosStyle}
          photosSize={section.photosSize}
          emptyLabel={preview ? 'Upload gallery photos to show here.' : undefined}
        />
      </SectionShell>
    )
  }

  if (section.type === 'RSVP') {
    const slices = events.filter((slice) => slice.canRsvp)
    const closed =
      section.rsvpOpen === false || (section.deadline ? todayIso() > section.deadline : false)
    return (
      <SectionShell title={NAV_LABELS.RSVP} horizontal={horizontal} id={sectionAnchor(section)}>
        <SectionMedia image={section.image} horizontal={horizontal} title={NAV_LABELS.RSVP}>
          {section.intro && <p className="mb-4 text-sm leading-relaxed">{section.intro}</p>}
          {closed ? (
            <p className="text-sm" style={{ color: 'var(--site-muted)' }}>
              RSVP is closed
            </p>
          ) : (
            <div className={itemStackClass(horizontal)}>
              {preview || !rsvp
                ? slices.map((slice) => (
                    <div
                      key={slice.eventId}
                      className="rounded-2xl p-5"
                      style={{ background: 'var(--site-card)' }}
                    >
                      <p className="text-sm font-semibold">{slice.title}</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--site-muted)' }}>
                        Guests respond here after you publish.
                      </p>
                    </div>
                  ))
                : slices.map((slice) => (
                    <RsvpCard
                      key={slice.eventId}
                      slug={rsvp.slug}
                      slice={slice}
                      token={rsvp.token}
                      buttonStyle={look.buttonStyle}
                      options={section}
                      onDone={(next) => rsvp.onDone(slice.eventId, next)}
                    />
                  ))}
            </div>
          )}
        </SectionMedia>
      </SectionShell>
    )
  }

  if (section.type === 'CUSTOM') {
    return (
      <SectionShell
        title={sectionNavLabel(section)}
        horizontal={horizontal}
        id={sectionAnchor(section)}
      >
        <SectionMedia
          image={section.image}
          horizontal={horizontal}
          title={sectionNavLabel(section)}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {section.body || (preview ? 'Add the details for this section.' : '')}
          </p>
        </SectionMedia>
      </SectionShell>
    )
  }

  return null
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function SectionMedia({
  image,
  horizontal,
  title,
  children,
}: {
  image?: EventSiteSection['image']
  horizontal: boolean
  title: string
  children: ReactNode
}) {
  if (!image?.url) return children
  const photo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={image.alt || title}
      loading="lazy"
      className={
        horizontal
          ? 'h-56 w-full rounded-2xl object-cover md:h-full'
          : 'mb-5 h-56 w-full rounded-2xl object-cover'
      }
    />
  )
  if (!horizontal) {
    return (
      <>
        {photo}
        {children}
      </>
    )
  }
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
      {photo}
      <div>{children}</div>
    </div>
  )
}

function DirectionsLink({ href, address }: { href?: string; address?: string }) {
  const maps = address ? mapsSearchUrl(address) : null
  const url = href || maps?.google
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center underline"
      style={{ color: 'var(--site-accent)' }}
    >
      Directions
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

function WhereBlock({
  location,
  map,
  note,
  preview,
}: {
  location: string | null
  map?: EventSiteSection['map']
  note?: string
  preview: boolean
}) {
  const mode = map === 'off' || map === 'embed' || map === 'link' ? map : 'link'
  const maps = location ? mapsSearchUrl(location) : null
  return (
    <div className="space-y-3 text-sm">
      <p>
        {location ||
          (preview
            ? mode === 'off'
              ? 'Location to come'
              : 'Add an address to show directions or a map.'
            : '')}
      </p>
      {note && <p className="leading-relaxed whitespace-pre-wrap">{note}</p>}
      {location && mode !== 'off' && <DirectionsLink address={location} />}
      {location && mode === 'embed' && maps && (
        <iframe
          title={`Map of ${location}`}
          src={maps.embed}
          className="mt-2 h-64 w-full max-w-full rounded-2xl border-0"
        />
      )}
    </div>
  )
}

function ScheduleBlock({
  events,
  ownerEventId,
  horizontal,
  section,
  preview,
}: {
  events: PublicEventSlice[]
  ownerEventId: string
  horizontal: boolean
  section: EventSiteSection
  preview: boolean
}) {
  const style =
    section.scheduleStyle === 'timeline' || section.scheduleStyle === 'cards'
      ? section.scheduleStyle
      : 'list'
  return (
    <div className="space-y-4">
      {section.note && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.note}</p>
      )}
      <div className={itemStackClass(horizontal)}>
        {events.map((slice) => (
          <div
            key={slice.eventId}
            className={
              horizontal ? 'w-full min-w-0 rounded-2xl p-4 sm:min-w-[12rem] sm:flex-1' : undefined
            }
            style={horizontal ? { background: 'var(--site-card)' } : undefined}
          >
            {slice.eventId !== ownerEventId && (
              <h3 className="mb-2 text-sm font-semibold">{slice.title}</h3>
            )}
            {slice.schedule.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--site-muted)' }}>
                {preview && slice.eventId === ownerEventId
                  ? 'Mark schedule items “Show on the event site” on the Schedule tab.'
                  : [formatSiteDate(slice.estimatedDate), slice.location]
                      .filter(Boolean)
                      .join(' · ') || 'Details to come'}
              </p>
            ) : (
              <ScheduleItems
                items={slice.schedule}
                style={style}
                groupByDay={section.groupByDay !== false}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ScheduleItems({
  items,
  style,
  groupByDay,
}: {
  items: PublicEventSlice['schedule']
  style: 'list' | 'timeline' | 'cards'
  groupByDay: boolean
}) {
  const groups = groupByDay
    ? Object.entries(
        items.reduce<Record<string, PublicEventSlice['schedule']>>((acc, item) => {
          const key = item.date || 'undated'
          acc[key] = [...(acc[key] ?? []), item]
          return acc
        }, {}),
      )
    : [['all', items] as const]

  return (
    <div className="space-y-4">
      {groups.map(([day, rows]) => (
        <div key={day}>
          {groupByDay && day !== 'undated' && (
            <p
              className="mb-2 text-xs tracking-[0.14em] uppercase"
              style={{ color: 'var(--site-muted)' }}
            >
              {formatSiteDate(day) ?? day}
            </p>
          )}
          <ul className={style === 'cards' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
            {rows.map((item) => (
              <li
                key={item.id}
                className={
                  style === 'timeline'
                    ? 'relative border-l pl-4 text-sm'
                    : style === 'cards'
                      ? 'rounded-2xl p-4 text-sm'
                      : 'text-sm'
                }
                style={
                  style === 'timeline'
                    ? { borderColor: 'var(--site-accent)' }
                    : style === 'cards'
                      ? { background: 'var(--site-card)' }
                      : undefined
                }
              >
                <span className="font-medium">{item.title}</span>
                {(item.startTime || item.endTime || (!groupByDay && item.date)) && (
                  <span style={{ color: 'var(--site-muted)' }}>
                    {' '}
                    · {!groupByDay && item.date ? `${item.date} ` : ''}
                    {item.startTime ?? ''}
                    {item.endTime ? `–${item.endTime}` : ''}
                  </span>
                )}
                {item.location && (
                  <span style={{ color: 'var(--site-muted)' }}>
                    {' '}
                    · {item.location}
                    {item.directionsUrl ? (
                      <>
                        {' '}
                        <DirectionsLink href={item.directionsUrl} />
                      </>
                    ) : null}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function PartyBlock({
  people,
  style,
  horizontal,
  preview,
}: {
  people: NonNullable<EventSiteSection['people']>
  style?: EventSiteSection['peopleStyle']
  horizontal: boolean
  preview: boolean
}) {
  const circles = style !== 'cards'
  const { pairs, rest } = splitPartyPairs(people)
  const groups = rest.reduce<{ label: string; members: typeof people }[]>((acc, person) => {
    const label = person.group?.trim() || ''
    const found = acc.find((g) => g.label === label)
    if (found) found.members.push(person)
    else acc.push({ label, members: [person] })
    return acc
  }, [])
  const ordered = [...groups.filter((g) => g.label), ...groups.filter((g) => !g.label)]

  if (people.length === 0) {
    return preview ? (
      <p className="text-sm" style={{ color: 'var(--site-muted)' }}>
        Add the wedding party on the event, then mark who guests may see.
      </p>
    ) : null
  }

  return (
    <div className={horizontal ? 'flex flex-col flex-wrap gap-6 sm:flex-row' : 'space-y-8'}>
      {pairs.length > 0 && (
        <div className={horizontal ? 'w-full min-w-0' : undefined}>
          <ul className="space-y-5">
            {pairs.map(([left, right]) => (
              <li
                key={`${left.id}-${right.id}`}
                className="flex flex-wrap items-start justify-center gap-6"
              >
                <PartyPerson person={left} circles={circles} />
                <PartyPerson person={right} circles={circles} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {ordered.map((group) => (
        <div
          key={group.label || 'party'}
          className={horizontal ? 'w-full min-w-0 sm:min-w-[12rem] sm:flex-1' : undefined}
        >
          {group.label && (
            <h3
              className="mb-3 text-sm font-semibold"
              style={{ fontFamily: 'var(--site-heading)' }}
            >
              {group.label}
            </h3>
          )}
          <ul className="flex flex-wrap gap-5">
            {group.members.map((person) => (
              <li key={person.id || person.name}>
                <PartyPerson person={person} circles={circles} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function splitPartyPairs(people: NonNullable<EventSiteSection['people']>) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const used = new Set<string>()
  const pairs: [
    NonNullable<EventSiteSection['people']>[number],
    NonNullable<EventSiteSection['people']>[number],
  ][] = []
  for (const person of people) {
    if (used.has(person.id) || !person.pairedWithId) continue
    const partner = byId.get(person.pairedWithId)
    if (!partner || used.has(partner.id)) continue
    const left = person.side === 'GROOM' && partner.side === 'BRIDE' ? partner : person
    const right = left === person ? partner : person
    pairs.push([left, right])
    used.add(person.id)
    used.add(partner.id)
  }
  return { pairs, rest: people.filter((person) => !used.has(person.id)) }
}

function PartyPerson({
  person,
  circles,
}: {
  person: NonNullable<EventSiteSection['people']>[number]
  circles: boolean
}) {
  const photo = person.image?.url
  return (
    <div className={circles ? 'w-24 text-center' : 'w-40'}>
      {photo ? (
        <div
          className={
            circles ? 'mx-auto overflow-hidden rounded-full' : 'mb-2 overflow-hidden rounded-2xl'
          }
          style={
            circles
              ? { width: 80, height: 80, minWidth: 80, minHeight: 80 }
              : { width: '100%', height: 160 }
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={person.image?.alt || person.name}
            className="party-face"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: 'none',
              objectFit: 'cover',
              objectPosition: 'center',
              imageOrientation: 'from-image',
            }}
          />
        </div>
      ) : (
        <div
          className={
            circles
              ? 'mx-auto flex h-20 w-20 items-center justify-center rounded-full text-sm font-medium'
              : 'mb-2 flex h-40 items-center justify-center rounded-2xl text-lg font-medium'
          }
          style={{ background: 'var(--site-card)' }}
        >
          {initials(person.name)}
        </div>
      )}
      <p className="mt-2 text-sm font-medium">{person.name || 'Name'}</p>
      {person.role && (
        <p className="text-xs" style={{ color: 'var(--site-muted)' }}>
          {person.role}
        </p>
      )}
      {!circles && person.bio && <p className="mt-1 text-xs leading-relaxed">{person.bio}</p>}
    </div>
  )
}

function FaqBlock({
  items,
  style,
  horizontal,
}: {
  items: NonNullable<EventSiteSection['faq']>
  style?: EventSiteSection['faqStyle']
  horizontal: boolean
}) {
  if (style === 'accordion') {
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <details key={i} className="rounded-2xl p-4" style={{ background: 'var(--site-card)' }}>
            <summary className="cursor-pointer text-sm font-semibold">
              {item.question || 'Question'}
            </summary>
            <p className="mt-2 text-sm" style={{ color: 'var(--site-muted)' }}>
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    )
  }
  return (
    <dl className={itemStackClass(horizontal)}>
      {items.map((item, i) => (
        <div
          key={i}
          className={
            horizontal ? 'w-full min-w-0 rounded-2xl p-4 sm:min-w-[12rem] sm:flex-1' : undefined
          }
          style={horizontal ? { background: 'var(--site-card)' } : undefined}
        >
          <dt className="text-sm font-semibold">{item.question || 'Question'}</dt>
          <dd className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>
            {item.answer}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function GiftsBlock({
  gifts,
  style,
  buttonStyle,
}: {
  gifts: NonNullable<EventSiteSection['gifts']>
  style?: EventSiteSection['giftsStyle']
  buttonStyle: string
}) {
  return (
    <ul className={style === 'buttons' ? 'flex flex-wrap gap-2' : 'space-y-2 text-sm'}>
      {gifts.map((gift, i) => {
        const href = safeGiftHref(gift.url)
        return (
          <li key={i}>
            {href ? (
              <a
                href={href}
                className={
                  style === 'buttons'
                    ? buttonClass(buttonStyle)
                    : 'inline-flex min-h-11 items-center underline'
                }
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={
                  style === 'buttons'
                    ? { border: '1px solid var(--site-accent)', color: 'var(--site-accent)' }
                    : { color: 'var(--site-accent)' }
                }
              >
                {gift.label || gift.url}
              </a>
            ) : (
              gift.label
            )}
          </li>
        )
      })}
    </ul>
  )
}

function SectionShell({
  id,
  title,
  children,
}: {
  id: string
  title: string
  horizontal?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="sr-only">{title}</h2>
      {children}
    </section>
  )
}

function itemStackClass(horizontal: boolean, extra = '') {
  return horizontal
    ? `flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch ${extra}`.trim()
    : `space-y-3 ${extra}`.trim()
}

function RsvpCard({
  slug,
  slice,
  token,
  buttonStyle,
  options,
  onDone,
}: {
  slug: string
  slice: PublicEventSlice
  token: string | null
  buttonStyle: string
  options: Pick<
    EventSiteSection,
    'allowMaybe' | 'collectPlusOne' | 'collectDietary' | 'collectMessage'
  >
  onDone: (next: { status: string; rsvpAt: string | null }) => void
}) {
  const [status, setStatus] = useState(slice.rsvp?.status ?? '')
  const [email, setEmail] = useState('')
  const [plusOneName, setPlusOneName] = useState('')
  const [dietaryNote, setDietaryNote] = useState('')
  const [guestMessage, setGuestMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const open = slice.accessMode === 'OPEN'

  function submit(choice: 'ATTENDING' | 'DECLINED' | 'MAYBE') {
    startTransition(async () => {
      setError('')
      try {
        await backend.post(
          `/event-sites/${slug}/rsvp`,
          {
            eventId: slice.eventId,
            status: choice,
            email: email.trim() || undefined,
            plusOneName: plusOneName.trim() || undefined,
            dietaryNote: dietaryNote.trim() || undefined,
            guestMessage: guestMessage.trim() || undefined,
          },
          token ? { headers: { [SESSION_HEADER]: token } } : undefined,
        )
        const next = { status: choice, rsvpAt: new Date().toISOString() }
        setStatus(choice)
        onDone(next)
      } catch (err) {
        setError(getErrorMessage(err, 'Could not save your RSVP'))
      }
    })
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--site-card)' }}>
      <p className="text-sm font-semibold">{slice.title}</p>
      {status && status !== 'PENDING' && (
        <p className="mt-1 text-xs" style={{ color: 'var(--site-muted)' }}>
          Recorded: {status.toLowerCase()}
        </p>
      )}
      {open && (
        <label className="mt-3 block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--site-muted)', background: 'transparent' }}
          />
        </label>
      )}
      {options.collectPlusOne !== false && (
        <label className="mt-2 block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            Plus-one name (optional)
          </span>
          <input
            value={plusOneName}
            maxLength={80}
            onChange={(e) => setPlusOneName(e.target.value)}
            className="min-h-11 w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--site-muted)', background: 'transparent' }}
          />
        </label>
      )}
      {options.collectDietary !== false && (
        <label className="mt-2 block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            Dietary notes (optional)
          </span>
          <input
            value={dietaryNote}
            maxLength={500}
            onChange={(e) => setDietaryNote(e.target.value)}
            className="min-h-11 w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--site-muted)', background: 'transparent' }}
          />
        </label>
      )}
      {options.collectMessage !== false && (
        <label className="mt-2 block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
            A note for the hosts (optional)
          </span>
          <textarea
            value={guestMessage}
            maxLength={2000}
            onChange={(e) => setGuestMessage(e.target.value)}
            rows={2}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--site-muted)', background: 'transparent' }}
          />
        </label>
      )}
      {error && (
        <p className="mt-2 text-xs" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(['ATTENDING', 'MAYBE', 'DECLINED'] as const)
          .filter((choice) => choice !== 'MAYBE' || options.allowMaybe !== false)
          .map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={pending || (open && !email.trim())}
              onClick={() => submit(choice)}
              aria-pressed={status === choice}
              className={buttonClass(buttonStyle)}
              style={{
                background: status === choice ? 'var(--site-accent)' : 'transparent',
                color: status === choice ? 'var(--site-card)' : 'var(--site-accent)',
                border: '1px solid var(--site-accent)',
              }}
            >
              {choice === 'ATTENDING' ? 'Attending' : choice === 'MAYBE' ? 'Maybe' : 'Decline'}
            </button>
          ))}
      </div>
    </div>
  )
}
