export type PageContext = {
  pathname?: string
  search?: string
  eventId?: string
  tab?: string
}

export function isSafeAppHref(href: string) {
  if (!href.startsWith('/') || href.startsWith('//')) return false
  if (href.includes('://') || href.includes('\\') || href.includes('\0')) return false
  if (href.startsWith('/e/') || href.startsWith('/api/')) return false
  return href.length <= 200
}

export const DJAN_EVENT_REFRESH = 'djan-event-refresh'

export function notifyEventRefresh() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DJAN_EVENT_REFRESH))
}

export function hrefAfterImport(
  tool: string,
  args: Record<string, unknown>,
  result: unknown,
  fallbackEventId?: string | null,
) {
  const fromResult =
    result && typeof result === 'object'
      ? (() => {
          const record = result as {
            eventId?: string
            guests?: Array<{ eventId?: string }>
            items?: Array<{ eventId?: string }>
          }
          return record.eventId ?? record.guests?.[0]?.eventId ?? record.items?.[0]?.eventId
        })()
      : undefined
  const eventId =
    (typeof fromResult === 'string' && fromResult) ||
    (typeof args.event_id === 'string' && args.event_id) ||
    fallbackEventId ||
    ''
  if (!eventId || eventId.includes('/') || eventId.length > 40) return null
  if (tool === 'import_guests' || tool === 'bulk_invite_guests') return `/events/${eventId}/guests`
  if (tool === 'import_budget') return `/events/${eventId}?tab=budget`
  if (tool === 'import_checklist') return `/events/${eventId}?tab=checklist`
  if (tool === 'import_schedule') return `/events/${eventId}?tab=schedule`
  if (tool === 'import_party') return `/events/${eventId}?tab=party`
  if (tool === 'apply_weekend') return `/events/${eventId}`
  if (tool === 'draft_site_copy') return `/events/${eventId}/site`
  return null
}

export function readPageContext(): PageContext {
  if (typeof window === 'undefined') return {}
  const url = new URL(window.location.href)
  const eventMatch = url.pathname.match(/^\/events\/([^/]+)/)
  const tab = url.searchParams.get('tab')?.trim() || undefined
  return {
    pathname: url.pathname,
    search: url.search || undefined,
    eventId: eventMatch?.[1],
    tab,
  }
}
