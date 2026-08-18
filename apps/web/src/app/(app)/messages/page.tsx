'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSyncedState } from '@/lib/use-synced-state'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ExternalLink,
  CalendarCheck,
} from 'lucide-react'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import { useTranslations } from 'next-intl'
import { InquiryThread } from '@/components/inquiries/inquiry-thread'
import {
  InquiryInboxFilters,
  StatusFilterTabs,
  applyInquiryFilters,
  parseEventFilter,
  parseStatusFilter,
  uniqueEvents,
  type StatusFilterKey,
} from '@/components/inquiries/inquiry-list-filters'
import { proxyClient } from '@/lib/proxy-client'
import { replaceShallowQuery } from '@/lib/shallow-query'
import { queryKeys } from '@/lib/query-keys'
import { useInboxSse } from '@/lib/inbox-sse'

interface Inquiry {
  id: string
  status: string
  message: string
  eventDate: string | null
  createdAt: string
  vendorProfile: {
    id: string
    businessName: string
    slug: string
    category: string
  } | null
  event: {
    id: string
    title: string
    estimatedDate: string | null
  } | null
  originInspirationItem?: { id: string; title: string; imageUrl: string | null } | null
  messages?: { id?: string; message: string; createdAt: string }[]
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; color: string; bg: string; border: string }
> = {
  PENDING: {
    label: 'Awaiting reply',
    icon: Clock,
    color: '#a87b10',
    bg: 'rgba(201,151,58,0.10)',
    border: 'rgba(201,151,58,0.3)',
  },
  VIEWED: {
    label: 'Viewed',
    icon: Clock,
    color: 'var(--color-muted)',
    bg: 'var(--card-bg)',
    border: 'var(--color-border)',
  },
  QUOTED: {
    label: 'Quoted',
    icon: Clock,
    color: '#1d4ed8',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.25)',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: CheckCircle,
    color: '#15803d',
    bg: 'rgba(22,163,74,0.10)',
    border: 'rgba(22,163,74,0.25)',
  },
  BOOKED: {
    label: 'Booked',
    icon: CalendarCheck,
    color: '#0f766e',
    bg: 'rgba(15,118,110,0.10)',
    border: 'rgba(15,118,110,0.25)',
  },
  DECLINED: {
    label: 'Declined',
    icon: XCircle,
    color: '#b91c1c',
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.2)',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    color: '#b91c1c',
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.2)',
  },
}

/* ─── List row ────────────────────────────────────────────── */
function InquiryListRow({
  inquiry,
  selected,
  onClick,
}: {
  inquiry: Inquiry
  selected: boolean
  onClick: () => void
}) {
  const tCat = useTranslations('vendorCategories')
  const s = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG.PENDING
  const lastMsg = inquiry.messages?.[0]
  const preview = lastMsg?.message ?? inquiry.message
  const time = new Date(lastMsg?.createdAt ?? inquiry.createdAt).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 border-b px-4 py-3.5 text-left transition-colors focus:outline-none"
      style={{
        borderColor: 'var(--color-border)',
        background: selected ? 'var(--card-bg-hover)' : 'transparent',
      }}
    >
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--card-bg-hover)' }}
      >
        <MessageSquare size={14} style={{ color: 'var(--color-muted)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate text-sm font-medium"
            style={{ color: 'var(--color-foreground)' }}
          >
            {inquiry.vendorProfile?.businessName ?? 'Unknown vendor'}
          </span>
          <span className="shrink-0 text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {time}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-muted)' }}>
          {inquiry.vendorProfile
            ? getVendorCategoryLabel(inquiry.vendorProfile.category, tCat)
            : '—'}
          {inquiry.event ? ` · ${inquiry.event.title}` : ''}
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

/* ─── Detail panel ────────────────────────────────────────── */
function DetailPanel({
  inquiry,
  onBack,
  onStatusChange,
}: {
  inquiry: Inquiry
  onBack: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const tCat = useTranslations('vendorCategories')
  const s = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG.PENDING

  const eventDate = inquiry.event?.estimatedDate
    ? new Date(inquiry.event.estimatedDate).toLocaleDateString('en-CA', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--page-bg)' }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--card-bg)' }}
      >
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 transition-opacity hover:opacity-70 md:hidden"
          style={{ color: 'var(--color-muted)' }}
        >
          <ArrowLeft size={16} />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            {inquiry.vendorProfile?.businessName ?? 'Unknown vendor'}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {inquiry.vendorProfile && (
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {getVendorCategoryLabel(inquiry.vendorProfile.category, tCat)}
              </span>
            )}
            {inquiry.event && (
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                · {inquiry.event.title}
              </span>
            )}
            {eventDate && (
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                · {eventDate}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{ background: s.bg, borderColor: s.border, color: s.color }}
          >
            <s.icon size={10} />
            {s.label}
          </span>
          {inquiry.vendorProfile && (
            <Link
              href={`/vendors/${inquiry.vendorProfile.slug}`}
              className="rounded-lg p-1.5 transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
              title="View vendor profile"
            >
              <ExternalLink size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <InquiryThread
          inquiryId={inquiry.id}
          originalMessage={inquiry.message}
          originalSenderName="You"
          originalCreatedAt={inquiry.createdAt}
          originalIsCurrentUser={true}
          inquiryStatus={
            inquiry.status as
              'PENDING' | 'VIEWED' | 'QUOTED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'BOOKED'
          }
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

/* ─── Page ────────────────────────────────────────────────── */
const STATUS_TABS: { key: StatusFilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Awaiting' },
  { key: 'QUOTED', label: 'Quoted' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'BOOKED', label: 'Booked' },
  { key: 'DECLINED', label: 'Declined' },
]

export default function MessagesPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlInquiryId = searchParams.get('inquiry')
  const [selectedId, setSelectedId] = useSyncedState<string | null>(urlInquiryId)
  const eventFilter = parseEventFilter(searchParams.get('event'))
  const statusFilter = parseStatusFilter(searchParams.get('status'))
  const categoryFilter = searchParams.get('category') ?? 'all'
  const [search, setSearch] = useState('')
  const didAutoSelect = useRef(false)
  const queryClient = useQueryClient()
  const tCat = useTranslations('vendorCategories')

  const replaceParams = useCallback(
    (next: Record<string, string | null>) => {
      replaceShallowQuery(pathname, next)
    },
    [pathname],
  )

  const { data: inquiries = [], isPending: loading } = useQuery({
    queryKey: queryKeys.inquiriesMe,
    queryFn: async () => {
      const { data } = await proxyClient.get<Inquiry[]>('/inquiries/me')
      return Array.isArray(data) ? data : []
    },
  })
  useInboxSse(queryKeys.inquiriesMe)

  const events = useMemo(() => uniqueEvents(inquiries), [inquiries])
  const categories = useMemo(() => {
    const keys = [
      ...new Set(inquiries.map((i) => i.vendorProfile?.category).filter(Boolean)),
    ] as string[]
    return keys
      .map((value) => ({ value, label: getVendorCategoryLabel(value, tCat) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [inquiries, tCat])
  const noneEventCount = inquiries.filter((i) => !i.event).length
  const displayed = useMemo(
    () =>
      applyInquiryFilters(inquiries, {
        status: statusFilter,
        event: eventFilter,
        category: categoryFilter,
        search,
      }),
    [inquiries, statusFilter, eventFilter, categoryFilter, search],
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

  function handleStatusChange(id: string, status: string) {
    queryClient.setQueryData<Inquiry[]>(queryKeys.inquiriesMe, (prev) =>
      (prev ?? []).map((i) => (i.id === id ? { ...i, status } : i)),
    )
  }

  function clearListFilters() {
    setSearch('')
    replaceParams({ event: null, category: null })
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
        <div className="flex min-w-0 items-center gap-3">
          <h1
            className="font-display text-lg font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            Messages
          </h1>
          <span className="hidden text-sm sm:inline" style={{ color: 'var(--color-muted)' }}>
            {filtered
              ? `${displayed.length} of ${inquiries.length}`
              : "Inquiries you've sent to vendors"}
          </span>
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
        {/* Left: list */}
        <div
          className={`flex shrink-0 flex-col overflow-hidden border-r ${selected ? 'hidden md:flex md:w-72 lg:w-80' : 'flex w-full md:w-72 lg:w-80'}`}
          style={{ borderColor: 'var(--color-border)', background: 'var(--card-bg)' }}
        >
          {!loading && inquiries.length > 0 && (
            <InquiryInboxFilters
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search vendors or events"
              eventFilter={eventFilter}
              onEventFilterChange={(value) => replaceParams({ event: value })}
              events={events}
              noneEventCount={noneEventCount}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={(value) => replaceParams({ category: value })}
              categories={categories}
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
                  No messages yet
                </p>
                <p className="mt-1 mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
                  Browse vendors and send an inquiry to get started.
                </p>
                <Link
                  href="/vendors"
                  className="bg-gold-600 hover:bg-gold-700 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                >
                  Find vendors <ArrowRight size={11} />
                </Link>
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageSquare size={20} className="mb-2" style={{ color: 'var(--color-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                  No matching messages
                </p>
                <p className="mt-1 mb-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                  Try a different event, status, or search.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    replaceParams({ event: null, category: null, status: null })
                  }}
                  className="text-xs font-medium hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              displayed.map((inq) => (
                <InquiryListRow
                  key={inq.id}
                  inquiry={inq}
                  selected={inq.id === selectedId}
                  onClick={() => selectInquiry(inq.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className={`flex-1 overflow-hidden ${selected ? 'flex flex-col' : 'hidden md:flex'}`}>
          {selected ? (
            <DetailPanel
              key={selected.id}
              inquiry={selected}
              onBack={() => selectInquiry(null)}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center opacity-50">
              <MessageSquare size={32} style={{ color: 'var(--color-muted)' }} />
              <p className="mt-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                Select a conversation to read it
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
