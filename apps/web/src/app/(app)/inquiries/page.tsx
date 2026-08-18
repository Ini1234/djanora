'use client'

import { useState, useEffect, useTransition, useCallback, useRef, useMemo } from 'react'
import { useSyncedState } from '@/lib/use-synced-state'
import { usePathname, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  CalendarDays,
  CalendarCheck,
  MapPin,
  ArrowLeft,
} from 'lucide-react'
import { InquiryThread } from '@/components/inquiries/inquiry-thread'
import {
  InquiryInboxFilters,
  StatusFilterTabs,
  applyInquiryFilters,
  parseEventFilter,
  parseInquirySort,
  parseStatusFilter,
  parseWhenFilter,
  uniqueEvents,
  type StatusFilterKey,
} from '@/components/inquiries/inquiry-list-filters'
import { proxyClient } from '@/lib/proxy-client'
import { replaceShallowQuery } from '@/lib/shallow-query'
import { queryKeys } from '@/lib/query-keys'
import { useInboxSse } from '@/lib/inbox-sse'

interface Inquiry {
  id: string
  status: 'PENDING' | 'VIEWED' | 'QUOTED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'BOOKED'
  message: string
  eventDate: string | null
  quotedAmount: number | null
  currency: string
  createdAt: string
  sender: {
    id: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
    city: string | null
  }
  event: {
    id: string
    title: string
    estimatedDate: string | null
  } | null
  originInspirationItem?: { id: string; title: string; imageUrl: string | null } | null
  messages?: { id?: string; message: string; createdAt: string }[]
}

function formatEventWhen(raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000)
  const label = date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  if (days === 0) return `${label} · today`
  if (days === 1) return `${label} · tomorrow`
  if (days > 1 && days <= 30) return `${label} · in ${days}d`
  return label
}

const STATUS = {
  PENDING: {
    label: 'New',
    icon: Clock,
    bg: 'rgba(201,151,58,0.12)',
    border: 'rgba(201,151,58,0.3)',
    color: '#8b6200',
  },
  VIEWED: {
    label: 'Viewed',
    icon: Clock,
    bg: 'var(--card-bg)',
    border: 'var(--color-border)',
    color: 'var(--color-muted)',
  },
  QUOTED: {
    label: 'Quoted',
    icon: Clock,
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.25)',
    color: '#1d4ed8',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: CheckCircle,
    bg: 'rgba(22,163,74,0.10)',
    border: 'rgba(22,163,74,0.25)',
    color: '#15803d',
  },
  BOOKED: {
    label: 'Booked',
    icon: CalendarCheck,
    bg: 'rgba(15,118,110,0.10)',
    border: 'rgba(15,118,110,0.25)',
    color: '#0f766e',
  },
  DECLINED: {
    label: 'Declined',
    icon: XCircle,
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.2)',
    color: '#b91c1c',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.2)',
    color: '#b91c1c',
  },
}

/* ─── Avatar ──────────────────────────────────────────────── */
function Avatar({
  name,
  avatarUrl,
  size = 9,
}: {
  name: string
  avatarUrl: string | null
  size?: number
}) {
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  const px = size * 4
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/8 dark:ring-white/10"
      style={{ width: px, height: px, minWidth: px, background: 'var(--card-bg-hover)' }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: px / 3.5, fontWeight: 700, color: 'var(--color-foreground)' }}>
          {initials}
        </span>
      )}
    </div>
  )
}

/* ─── Inquiry list row ─────────────────────────────────────── */
function InquiryRow({
  inquiry,
  selected,
  onClick,
}: {
  inquiry: Inquiry
  selected: boolean
  onClick: () => void
}) {
  const s = STATUS[inquiry.status] ?? STATUS.PENDING
  const senderName =
    [inquiry.sender.firstName, inquiry.sender.lastName].filter(Boolean).join(' ') || 'Anonymous'
  const lastMsg = inquiry.messages?.[0]
  const preview = lastMsg?.message ?? inquiry.message
  const time = new Date(lastMsg?.createdAt ?? inquiry.createdAt).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const eventWhen = formatEventWhen(inquiry.event?.estimatedDate ?? inquiry.eventDate)

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 border-b px-4 py-3.5 text-left transition-colors focus:outline-none"
      style={{
        borderColor: 'var(--color-border)',
        background: selected ? 'var(--card-bg-hover)' : 'transparent',
      }}
    >
      <Avatar name={senderName} avatarUrl={inquiry.sender.avatarUrl} size={9} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate text-sm font-medium"
            style={{
              color: 'var(--color-foreground)',
              fontWeight: inquiry.status === 'PENDING' ? 600 : 400,
            }}
          >
            {senderName}
          </span>
          <span className="shrink-0 text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {time}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-muted)' }}>
          {inquiry.event?.title ?? 'No event'}
          {eventWhen ? ` · ${eventWhen}` : ''}
        </p>
        <p
          className="mt-0.5 truncate text-xs leading-relaxed"
          style={{ color: 'var(--color-muted)', opacity: 0.8 }}
        >
          {preview}
        </p>
        <span
          className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: s.bg, borderColor: s.border, color: s.color }}
        >
          <s.icon size={9} />
          {s.label}
        </span>
      </div>
    </button>
  )
}

/* ─── Detail panel ─────────────────────────────────────────── */
function DetailPanel({
  inquiry,
  onStatusChange,
  onBack,
}: {
  inquiry: Inquiry
  onStatusChange: (id: string, status: Inquiry['status']) => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const s = STATUS[inquiry.status] ?? STATUS.PENDING
  const senderName =
    [inquiry.sender.firstName, inquiry.sender.lastName].filter(Boolean).join(' ') || 'Anonymous'

  const eventDate = inquiry.event?.estimatedDate
    ? new Date(inquiry.event.estimatedDate).toLocaleDateString('en-CA', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : inquiry.eventDate
      ? new Date(inquiry.eventDate).toLocaleDateString('en-CA', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null

  function act(status: 'ACCEPTED' | 'DECLINED') {
    startTransition(async () => {
      try {
        await proxyClient.patch(`/inquiries/${inquiry.id}/status`, { status })
        onStatusChange(inquiry.id, status)
      } catch {
        /* silent */
      }
    })
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--page-bg)' }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--card-bg)' }}
      >
        {/* Back button — mobile only */}
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 transition-colors hover:opacity-70 md:hidden"
          style={{ color: 'var(--color-muted)' }}
        >
          <ArrowLeft size={16} />
        </button>

        <Avatar name={senderName} avatarUrl={inquiry.sender.avatarUrl} size={10} />

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            {senderName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-3">
            {inquiry.sender.city && (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--color-muted)' }}
              >
                <MapPin size={10} />
                {inquiry.sender.city}
              </span>
            )}
            {inquiry.event && (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--color-muted)' }}
              >
                <CalendarDays size={10} />
                {inquiry.event.title}
              </span>
            )}
            {eventDate && (
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                · {eventDate}
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span
          className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
          style={{ background: s.bg, borderColor: s.border, color: s.color }}
        >
          <s.icon size={10} />
          {s.label}
        </span>
      </div>

      {/* Accept / Decline bar — only when PENDING */}
      {inquiry.status === 'PENDING' && (
        <div
          className="flex shrink-0 items-center gap-2 border-b px-5 py-2.5"
          style={{ borderColor: 'var(--color-border)', background: 'rgba(201,151,58,0.04)' }}
        >
          <span className="flex-1 text-xs" style={{ color: 'var(--color-muted)' }}>
            Would you like to accept this inquiry?
          </span>
          <button
            disabled={isPending}
            onClick={() => act('ACCEPTED')}
            className="bg-gold-600 hover:bg-gold-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
          >
            <CheckCircle size={12} /> Accept
          </button>
          <button
            disabled={isPending}
            onClick={() => act('DECLINED')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-muted)',
              background: 'transparent',
            }}
          >
            <XCircle size={12} /> Decline
          </button>
          {isPending && (
            <span className="border-gold-400/30 border-t-gold-600 h-3.5 w-3.5 animate-spin rounded-full border-2" />
          )}
        </div>
      )}

      {/* Conversation thread — scrollable, fills remaining height */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <InquiryThread
          inquiryId={inquiry.id}
          originalMessage={inquiry.message}
          originalSenderName={senderName}
          originalCreatedAt={inquiry.createdAt}
          originalIsCurrentUser={false}
          inquiryStatus={inquiry.status}
          onStatusChange={(status) => onStatusChange(inquiry.id, status)}
          originLook={
            inquiry.originInspirationItem
              ? {
                  id: inquiry.originInspirationItem.id,
                  title: inquiry.originInspirationItem.title,
                  coverUrl: inquiry.originInspirationItem.imageUrl,
                }
              : null
          }
        />
      </div>
    </div>
  )
}

const STATUS_TABS: { key: StatusFilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'New' },
  { key: 'QUOTED', label: 'Quoted' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'BOOKED', label: 'Booked' },
  { key: 'DECLINED', label: 'Declined' },
]

/* ─── Page ─────────────────────────────────────────────────── */
export default function InquiriesPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlInquiryId = searchParams.get('inquiry')
  const [selectedId, setSelectedId] = useSyncedState<string | null>(urlInquiryId)
  const eventFilter = parseEventFilter(searchParams.get('event'))
  const statusFilter = parseStatusFilter(searchParams.get('status'))
  const whenFilter = parseWhenFilter(searchParams.get('when'))
  const sort = parseInquirySort(searchParams.get('sort'))
  const [search, setSearch] = useState('')
  const didAutoSelect = useRef(false)
  const queryClient = useQueryClient()

  const replaceParams = useCallback(
    (next: Record<string, string | null>) => {
      replaceShallowQuery(pathname, next)
    },
    [pathname],
  )

  const { data: inquiries = [], isPending: loading } = useQuery({
    queryKey: queryKeys.inquiriesVendor,
    queryFn: async () => {
      const { data } = await proxyClient.get<Inquiry[]>('/inquiries/vendor')
      return Array.isArray(data) ? data : []
    },
  })
  useInboxSse(queryKeys.inquiriesVendor)

  const events = useMemo(() => uniqueEvents(inquiries), [inquiries])
  const noneEventCount = inquiries.filter((i) => !i.event).length
  const displayed = useMemo(
    () =>
      applyInquiryFilters(inquiries, {
        status: statusFilter,
        event: eventFilter,
        when: whenFilter,
        sort,
        search,
        extraSearch: (item) =>
          [item.sender.firstName, item.sender.lastName, item.sender.city].filter(Boolean).join(' '),
      }),
    [inquiries, statusFilter, eventFilter, whenFilter, sort, search],
  )

  const selectInquiry = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      replaceParams({ inquiry: id })
    },
    [replaceParams, setSelectedId],
  )

  useEffect(() => {
    if (loading || inquiries.length === 0) return
    if (selectedId && inquiries.some((item) => item.id === selectedId)) {
      didAutoSelect.current = true
      return
    }
    if (didAutoSelect.current && !selectedId) return
    if (displayed.length === 0) return
    didAutoSelect.current = true
    replaceParams({ inquiry: displayed[0].id })
  }, [loading, inquiries, displayed, selectedId, replaceParams])

  function handleStatusChange(id: string, status: Inquiry['status']) {
    queryClient.setQueryData<Inquiry[]>(queryKeys.inquiriesVendor, (prev) =>
      (prev ?? []).map((i) => (i.id === id ? { ...i, status } : i)),
    )
  }

  function clearListFilters() {
    setSearch('')
    replaceParams({ event: null, when: null, sort: null })
  }

  const selected = inquiries.find((i) => i.id === selectedId) ?? null
  const pendingCount = inquiries.filter((i) => i.status === 'PENDING').length
  const filtered = displayed.length !== inquiries.length

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-5 py-3.5"
        style={{ borderColor: 'var(--color-border)', background: 'var(--card-bg)' }}
      >
        <div className="flex items-center gap-3">
          <h1
            className="font-display text-lg font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            Inquiries
          </h1>
          {pendingCount > 0 && (
            <span
              className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
              style={{
                background: 'rgba(201,151,58,0.12)',
                borderColor: 'rgba(201,151,58,0.3)',
                color: '#8b6200',
              }}
            >
              <Clock size={10} />
              {pendingCount} new
            </span>
          )}
          {filtered && (
            <span className="hidden text-xs sm:inline" style={{ color: 'var(--color-muted)' }}>
              {displayed.length} of {inquiries.length}
            </span>
          )}
        </div>

        <StatusFilterTabs
          value={statusFilter}
          onChange={(key) => replaceParams({ status: key })}
          tabs={STATUS_TABS}
          pendingCount={pendingCount}
        />
      </div>

      {/* Body: list + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: inquiry list */}
        <div
          className={`flex shrink-0 flex-col overflow-hidden border-r ${selected ? 'hidden md:flex md:w-72 lg:w-80' : 'flex w-full md:w-72 lg:w-80'}`}
          style={{ borderColor: 'var(--color-border)', background: 'var(--card-bg)' }}
        >
          {!loading && inquiries.length > 0 && (
            <InquiryInboxFilters
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search clients or events"
              eventFilter={eventFilter}
              onEventFilterChange={(value) => replaceParams({ event: value })}
              events={events}
              noneEventCount={noneEventCount}
              whenFilter={whenFilter}
              onWhenFilterChange={(value) =>
                replaceParams({ when: value === 'all' ? null : value })
              }
              sort={sort}
              onSortChange={(value) => replaceParams({ sort: value === 'recent' ? null : value })}
              onClear={clearListFilters}
            />
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse gap-3">
                    <div
                      className="h-9 w-9 shrink-0 rounded-full"
                      style={{ background: 'var(--card-bg-hover)' }}
                    />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className="h-3 w-28 rounded"
                        style={{ background: 'var(--card-bg-hover)' }}
                      />
                      <div
                        className="h-2.5 w-40 rounded"
                        style={{ background: 'var(--card-bg)' }}
                      />
                      <div
                        className="h-2.5 w-full rounded"
                        style={{ background: 'var(--card-bg)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : inquiries.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageSquare size={20} className="mb-2" style={{ color: 'var(--color-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                  No inquiries yet
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                  When clients contact you, messages will appear here.
                </p>
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageSquare size={20} className="mb-2" style={{ color: 'var(--color-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                  No matching inquiries
                </p>
                <p className="mt-1 mb-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                  Try a different event, status, or search.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    replaceParams({ event: null, status: null, when: null, sort: null })
                  }}
                  className="text-xs font-medium hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              displayed.map((inq) => (
                <InquiryRow
                  key={inq.id}
                  inquiry={inq}
                  selected={inq.id === selectedId}
                  onClick={() => selectInquiry(inq.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: detail / thread */}
        <div className={`flex-1 overflow-hidden ${selected ? 'flex flex-col' : 'hidden md:flex'}`}>
          {selected ? (
            <DetailPanel
              inquiry={selected}
              onStatusChange={handleStatusChange}
              onBack={() => selectInquiry(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center opacity-50">
              <MessageSquare size={32} style={{ color: 'var(--color-muted)' }} />
              <p className="mt-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                Select an inquiry to read the message
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
