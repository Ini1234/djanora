'use client'

import { Search, X } from 'lucide-react'

export type EventFilter = 'all' | 'none' | string
export type StatusFilterKey = 'ALL' | 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'BOOKED' | 'DECLINED'
export type WhenFilter = 'all' | 'soon' | 'upcoming' | 'past'
export type InquirySortKey = 'recent' | 'event-asc' | 'event-desc'

const STATUS_KEYS: StatusFilterKey[] = [
  'ALL',
  'PENDING',
  'QUOTED',
  'ACCEPTED',
  'BOOKED',
  'DECLINED',
]
const WHEN_KEYS: WhenFilter[] = ['all', 'soon', 'upcoming', 'past']
const SORT_KEYS: InquirySortKey[] = ['recent', 'event-asc', 'event-desc']
const SOON_DAYS = 30
const DAY_MS = 86_400_000

export function parseEventFilter(value: string | null): EventFilter {
  return value && value !== 'all' ? value : 'all'
}

export function parseStatusFilter(value: string | null): StatusFilterKey {
  if (value && STATUS_KEYS.includes(value as StatusFilterKey)) return value as StatusFilterKey
  return 'ALL'
}

export function parseWhenFilter(value: string | null): WhenFilter {
  if (value && WHEN_KEYS.includes(value as WhenFilter)) return value as WhenFilter
  return 'all'
}

export function parseInquirySort(value: string | null): InquirySortKey {
  if (value && SORT_KEYS.includes(value as InquirySortKey)) return value as InquirySortKey
  return 'recent'
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function inquiryEventTime(item: {
  event?: { estimatedDate?: string | null } | null
  eventDate?: string | null
}): number | null {
  const raw = item.event?.estimatedDate ?? item.eventDate ?? null
  if (!raw) return null
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? null : t
}

function matchesWhen(ts: number | null, when: WhenFilter) {
  if (when === 'all') return true
  if (ts == null) return false
  const today = startOfToday()
  if (when === 'soon') return ts >= today && ts < today + SOON_DAYS * DAY_MS
  if (when === 'upcoming') return ts >= today
  return ts < today
}

const SELECT_CLASS =
  'w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-gold-500/40'

const SELECT_STYLE = {
  background: 'var(--input-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-foreground)',
} as const

export function uniqueEvents(
  items: { event: { id: string; title: string } | null }[],
): { id: string; title: string }[] {
  const map = new Map<string, string>()
  for (const item of items) {
    if (item.event) map.set(item.event.id, item.event.title)
  }
  return [...map.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function applyInquiryFilters<
  T extends {
    status: string
    event: { id: string; title?: string; estimatedDate?: string | null } | null
    eventDate?: string | null
    createdAt?: string
    vendorProfile?: { category?: string; businessName?: string | null } | null
    message: string
    messages?: { message: string; createdAt?: string }[]
  },
>(
  items: T[],
  filters: {
    status: StatusFilterKey
    event: EventFilter
    category?: string
    when?: WhenFilter
    sort?: InquirySortKey
    search: string
    extraSearch?: (item: T) => string
  },
): T[] {
  const q = filters.search.trim().toLowerCase()
  const when = filters.when ?? 'all'
  const filtered = items.filter((item) => {
    if (filters.status !== 'ALL' && item.status !== filters.status) return false
    if (filters.event === 'none' && item.event) return false
    if (filters.event !== 'all' && filters.event !== 'none' && item.event?.id !== filters.event)
      return false
    if (
      filters.category &&
      filters.category !== 'all' &&
      item.vendorProfile?.category !== filters.category
    ) {
      return false
    }
    if (!matchesWhen(inquiryEventTime(item), when)) return false
    if (!q) return true
    const hay = [
      item.vendorProfile?.businessName,
      item.event?.title,
      item.message,
      item.messages?.[0]?.message,
      filters.extraSearch?.(item) ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const sort = filters.sort ?? 'recent'
  if (sort === 'recent') return filtered

  return [...filtered].sort((a, b) => {
    const aTime = inquiryEventTime(a)
    const bTime = inquiryEventTime(b)
    if (aTime == null && bTime == null) return 0
    if (aTime == null) return 1
    if (bTime == null) return -1
    return sort === 'event-asc' ? aTime - bTime : bTime - aTime
  })
}

export function StatusFilterTabs({
  value,
  onChange,
  tabs,
  pendingCount,
}: {
  value: StatusFilterKey
  onChange: (key: StatusFilterKey) => void
  tabs: { key: StatusFilterKey; label: string }[]
  pendingCount?: number
}) {
  return (
    <div
      className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border p-0.5"
      style={{ background: 'var(--page-bg)', borderColor: 'var(--color-border)' }}
    >
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-all"
          style={
            value === key
              ? {
                  background: 'var(--card-bg)',
                  color: 'var(--color-foreground)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }
              : { color: 'var(--color-muted)' }
          }
        >
          {label}
          {key === 'PENDING' && pendingCount != null && pendingCount > 0 && (
            <span className="bg-gold-600 ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] text-white">
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function InquiryInboxFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  eventFilter,
  onEventFilterChange,
  events,
  noneEventCount,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  whenFilter,
  onWhenFilterChange,
  sort,
  onSortChange,
  onClear,
}: {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  eventFilter: EventFilter
  onEventFilterChange: (value: EventFilter) => void
  events: { id: string; title: string }[]
  noneEventCount: number
  categoryFilter?: string
  onCategoryFilterChange?: (value: string) => void
  categories?: { value: string; label: string }[]
  whenFilter?: WhenFilter
  onWhenFilterChange?: (value: WhenFilter) => void
  sort?: InquirySortKey
  onSortChange?: (value: InquirySortKey) => void
  onClear?: () => void
}) {
  const showEvent = events.length > 1 || (events.length === 1 && noneEventCount > 0)
  const showCategory = Boolean(categories && onCategoryFilterChange && categories.length > 1)
  const showWhen = Boolean(onWhenFilterChange)
  const showSort = Boolean(onSortChange)
  const hasActive =
    eventFilter !== 'all' ||
    Boolean(search.trim()) ||
    Boolean(categoryFilter && categoryFilter !== 'all') ||
    Boolean(whenFilter && whenFilter !== 'all') ||
    Boolean(sort && sort !== 'recent')

  return (
    <div
      className="shrink-0 space-y-2 border-b px-3 py-2.5"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <SearchField value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
      {(showEvent || showCategory) && (
        <div className={showEvent && showCategory ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1'}>
          {showEvent && (
            <select
              aria-label="Filter by event"
              value={eventFilter}
              onChange={(e) => onEventFilterChange(e.target.value)}
              className={SELECT_CLASS}
              style={SELECT_STYLE}
            >
              <option value="all">All events</option>
              {noneEventCount > 0 && <option value="none">No event</option>}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          )}
          {showCategory && (
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange?.(e.target.value)}
              className={SELECT_CLASS}
              style={SELECT_STYLE}
            >
              <option value="all">All categories</option>
              {categories!.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {(showWhen || showSort) && (
        <div className={showWhen && showSort ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1'}>
          {showWhen && (
            <select
              aria-label="Filter by event date"
              value={whenFilter ?? 'all'}
              onChange={(e) => onWhenFilterChange?.(e.target.value as WhenFilter)}
              className={SELECT_CLASS}
              style={SELECT_STYLE}
            >
              <option value="all">Any date</option>
              <option value="soon">Soon (30 days)</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past events</option>
            </select>
          )}
          {showSort && (
            <select
              aria-label="Sort conversations"
              value={sort ?? 'recent'}
              onChange={(e) => onSortChange?.(e.target.value as InquirySortKey)}
              className={SELECT_CLASS}
              style={SELECT_STYLE}
            >
              <option value="recent">Latest activity</option>
              <option value="event-asc">Event date · soonest</option>
              <option value="event-desc">Event date · latest</option>
            </select>
          )}
        </div>
      )}
      {hasActive && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-muted)' }}
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search
        size={13}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        style={{ color: 'var(--color-muted)' }}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="focus:ring-gold-500/40 w-full rounded-lg border py-1.5 pr-7 pl-8 text-xs focus:ring-2 focus:outline-none"
        style={{
          background: 'var(--input-bg)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-foreground)',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 hover:opacity-70"
          style={{ color: 'var(--color-muted)' }}
          aria-label="Clear search"
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}
