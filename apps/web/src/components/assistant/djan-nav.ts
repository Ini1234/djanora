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
