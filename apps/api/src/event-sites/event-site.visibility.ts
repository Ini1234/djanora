import { EventSiteAccessMode } from '@prisma/client'

export type SiteEventConfig = {
  eventId: string
  accessMode: EventSiteAccessMode
  hasOwnGuestList: boolean
}

/** Guest visibility for one Event on a site (FR-25–FR-29). */
export function canSeeEventOnSite(
  config: SiteEventConfig,
  ownerEventId: string,
  guestEventIds: Set<string>,
) {
  if (config.accessMode === EventSiteAccessMode.OPEN) return true
  if (guestEventIds.size === 0) return false
  if (!config.hasOwnGuestList) return guestEventIds.has(ownerEventId)
  return guestEventIds.has(config.eventId)
}

/** True when at least one Event on the site is still hidden from this identity. */
export function siteNeedsInvite(
  configs: SiteEventConfig[],
  ownerEventId: string,
  guestEventIds: Set<string>,
) {
  return configs.some((config) => !canSeeEventOnSite(config, ownerEventId, guestEventIds))
}

export function publicRobots(visible: SiteEventConfig[]): 'index' | 'noindex' {
  return visible.some((c) => c.accessMode === EventSiteAccessMode.OPEN) ? 'index' : 'noindex'
}

export function inviteIsActive(expiresAt: Date | null | undefined) {
  return !expiresAt || expiresAt.getTime() > Date.now()
}

const EMPTY_SCHEDULE: {
  id: string
  title: string
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  directionsUrl: string | null
}[] = []

export type PublicCoverFlags = {
  showEventType: boolean
  showEventTitle: boolean
}

export type PublicScheduleFlags = {
  showTimes: boolean
  showItemDirections: boolean
}

/** Guest payloads omit hidden cover lines. The page must not be the ACL. */
export function redactCoverIdentity<T extends { title: string; eventType: string }>(
  owner: T,
  flags: PublicCoverFlags,
): T {
  return {
    ...owner,
    title: flags.showEventTitle ? owner.title : '',
    eventType: flags.showEventType ? owner.eventType : '',
  }
}

export function directionsUrlFor(location: string | null | undefined) {
  const q = location?.trim()
  if (!q) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Guest schedule items omit times / directions when those switches are off. */
export function redactPublicSchedule<
  T extends {
    startTime: string | null
    endTime: string | null
    location: string | null
  },
>(items: T[], flags: PublicScheduleFlags) {
  return items.map((item) => ({
    ...item,
    startTime: flags.showTimes ? item.startTime : null,
    endTime: flags.showTimes ? item.endTime : null,
    directionsUrl: flags.showItemDirections ? directionsUrlFor(item.location) : null,
  }))
}

export function sectionIsOn(sections: { type: string; enabled: boolean }[], type: string) {
  return sections.some((section) => section.type === type && section.enabled)
}

/** Cover-only owner when the owner Event is invited-only (FR-29, FR-31). */
export function publicOwnerFallback(
  owner: {
    title: string
    eventType: string
    estimatedDate: Date | string | null
    location: string | null
  },
  accessMode: EventSiteAccessMode,
  _hasOpenVisible: boolean,
  cover: PublicCoverFlags,
) {
  return redactCoverIdentity(
    {
      eventId: '',
      title: owner.title,
      eventType: owner.eventType,
      estimatedDate: null,
      location: null,
      accessMode,
      hasOwnGuestList: true,
      schedule: EMPTY_SCHEDULE,
      canRsvp: false,
      rsvp: null,
    },
    cover,
  )
}

export function toDateOnly(value: Date | string | null | undefined) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const day = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}
