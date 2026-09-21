import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'
import { eventDateKey } from '@/lib/event-timing'
import type { EventSiteCoverPhotoSide, PublicEventSite, PublicEventSlice } from '@/lib/api.types'

function coverWhen(value: string | Date | null | undefined) {
  const key = eventDateKey(value)
  if (!key) return null
  const date = new Date(`${key}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return {
    weekday: date.toLocaleDateString('en-CA', { weekday: 'long' }),
    month: date.toLocaleDateString('en-CA', { month: 'long' }),
    day: date.toLocaleDateString('en-CA', { day: 'numeric' }),
    year: date.toLocaleDateString('en-CA', { year: 'numeric' }),
    label: date.toLocaleDateString('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  }
}

export function coverPhotoSideOf(raw?: string | null): EventSiteCoverPhotoSide {
  return raw === 'right' ? 'right' : 'left'
}

export function CoverBlock({
  look,
  owner,
  id,
  preview = false,
}: {
  look: PublicEventSite['look']
  owner: Pick<PublicEventSlice, 'title' | 'eventType' | 'estimatedDate' | 'location'>
  id: string
  preview?: boolean
}) {
  const kind = owner.eventType ? (EVENT_TYPE_LABELS[owner.eventType] ?? owner.eventType) : ''
  const when = coverWhen(owner.estimatedDate)
  const title = owner.title.trim()
  const heading = title || 'Event'
  const layout =
    look.coverLayout === 'split' || look.coverLayout === 'centered'
      ? look.coverLayout
      : 'full-bleed'
  const photoSide = coverPhotoSideOf(look.coverPhotoSide)
  const photo = look.coverPhotoUrl

  const invitation = (
    <div className="event-site-cover-copy">
      {kind ? <p className="event-site-cover-kicker">{kind}</p> : null}
      <h1 className={title ? 'event-site-cover-title' : 'sr-only'}>{heading}</h1>
      {(kind || title) && (when || owner.location) && (
        <div className="event-site-cover-rule" aria-hidden="true" />
      )}
      {when && (
        <p className="event-site-cover-when">
          <span className="sr-only">{when.label}</span>
          <span className="event-site-cover-weekday" aria-hidden="true">
            {when.weekday}
          </span>
          <span className="event-site-cover-date" aria-hidden="true">
            {when.day} {when.month} {when.year}
          </span>
        </p>
      )}
      {owner.location && <p className="event-site-cover-place">{owner.location}</p>}
    </div>
  )

  const media = photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={title || 'Cover photo'} className="event-site-cover-photo" />
  ) : preview ? (
    <div className="event-site-cover-photo event-site-cover-photo-placeholder">Cover photo</div>
  ) : null

  return (
    <header id={id} className="event-site-cover" data-layout={layout} data-photo-side={photoSide}>
      {layout === 'centered' ? (
        <>
          {invitation}
          {media}
        </>
      ) : (
        <>
          {media}
          {invitation}
        </>
      )}
    </header>
  )
}
