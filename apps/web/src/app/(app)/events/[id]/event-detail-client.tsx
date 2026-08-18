'use client'

import { useState, useTransition, useRef, useLayoutEffect, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  CalendarDays,
  Users,
  Sparkles,
  DollarSign,
  CheckSquare,
  MessageSquare,
  Pencil,
  X,
  Check,
  Loader2,
  ArrowRight,
  Share2,
  ChevronRight,
} from 'lucide-react'
import { ChecklistSection } from './checklist-section'
import { BudgetSection } from './budget-section'
import { EventInquiriesSection } from './event-inquiries-section'
import { MoodBoardTab } from './mood-board-tab'
import { MoodBoardProvider } from './mood-board-context'
import { ScheduleSection } from './schedule-section'
import { EventAccessProvider } from './event-access-context'
import { EventPeopleSection } from './event-people-section'
import { EventSubEventsSection } from './event-subevents-section'
import { EventItemComments } from './event-item-comments'
import { EventActivityFeed } from './event-activity-feed'
import { proxyClient } from '@/lib/proxy-client'
import { useSse } from '@/contexts/sse-context'
import type { Event, EventSurface } from '@/lib/api.types'
import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'
import { isPastEvent } from '@/lib/event-timing'

// ─── Constants ────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'schedule' | 'checklist' | 'budget' | 'vendors' | 'moodboard'

const TAB_SURFACE: Partial<Record<Tab, EventSurface>> = {
  schedule: 'SCHEDULE',
  checklist: 'CHECKLIST',
  budget: 'BUDGET',
  vendors: 'VENDORS',
  moodboard: 'MOODBOARD',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'budget', label: 'Budget' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'moodboard', label: '✦ Mood Board' },
]

const TAB_UNREAD: Record<Tab, string> = {
  overview: 'OVERVIEW',
  schedule: 'SCHEDULE',
  checklist: 'CHECKLIST',
  budget: 'BUDGET',
  vendors: 'VENDORS',
  moodboard: 'MOODBOARD',
}

const TAB_IDS = new Set<Tab>(TABS.map((t) => t.id))

function tabFromParam(value: string | null): Tab | null {
  if (value && TAB_IDS.has(value as Tab)) return value as Tab
  return null
}

function OverviewChip({
  title,
  summary,
  onOpen,
}: {
  title: string
  summary?: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card flex w-full items-center gap-2 px-5 py-4 text-left transition-opacity hover:opacity-80"
    >
      <ChevronRight size={14} className="text-muted shrink-0" />
      <span className="text-foreground text-sm font-semibold">{title}</span>
      {summary && <span className="text-muted ml-auto text-xs tabular-nums">{summary}</span>}
    </button>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: React.ElementType
  value: string
  label: string
  accent?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon
        size={15}
        className="mt-1 shrink-0"
        style={{ color: accent ? 'var(--color-brand-primary)' : 'var(--color-muted)' }}
      />
      <div className="min-w-0">
        <p
          className="text-xl leading-tight font-semibold tabular-nums"
          style={{ color: accent ? 'var(--color-brand-primary)' : 'var(--color-text-primary)' }}
        >
          {value}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Edit Event Modal ─────────────────────────────────────────────────────────

function EditEventModal({
  event,
  onClose,
  onSaved,
}: {
  event: Event
  onClose: () => void
  onSaved: (updates: Partial<Event>) => void
}) {
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.estimatedDate ? event.estimatedDate.slice(0, 10) : '')
  const [location, setLocation] = useState(event.location ?? '')
  const [guestCount, setGuestCount] = useState(String(event.guestCount ?? ''))
  const [totalBudget, setTotalBudget] = useState(String(event.totalBudget))
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setError('')
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {}
        if (title.trim() !== event.title) body.title = title.trim()
        const dateVal = date || null
        const origDate = event.estimatedDate ? event.estimatedDate.slice(0, 10) : null
        if (dateVal !== origDate) body.estimatedDate = dateVal
        if (location.trim() !== (event.location ?? '')) body.location = location.trim()
        const gc = guestCount ? parseInt(guestCount) : null
        if (gc !== event.guestCount) body.guestCount = gc
        const tb = parseInt(totalBudget)
        if (!isNaN(tb) && tb !== event.totalBudget) body.totalBudget = tb

        if (Object.keys(body).length === 0) {
          onClose()
          return
        }

        await proxyClient.patch(`/events/${event.id}`, body)

        onSaved(body as Partial<Event>)
        router.refresh()
        onClose()
      } catch {
        setError('Failed to save. Please try again.')
      }
    })
  }

  const inputStyle = {
    background: 'color-mix(in srgb, var(--color-text-primary) 5%, transparent)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
  } as const

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--color-muted)',
    marginBottom: '6px',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--page-bg)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Edit Event Details
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-black/8 dark:hover:bg-white/8"
            style={{ color: 'var(--color-muted)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4 p-5">
          <div>
            <label style={labelStyle}>Event Name</label>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              style={inputStyle}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input
              style={inputStyle}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Venue"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Guest Count</label>
              <input
                type="number"
                min={1}
                style={inputStyle}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="e.g. 150"
              />
            </div>
            <div>
              <label style={labelStyle}>Total Budget (CA$)</label>
              <input
                type="number"
                min={0}
                style={inputStyle}
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="h-9 rounded-xl px-4 text-sm font-medium transition-colors"
            style={{
              background: 'color-mix(in srgb, var(--color-text-primary) 6%, transparent)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-opacity disabled:opacity-60"
            style={{
              background: 'var(--color-brand-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  event: Event
}

export function EventDetailClient({ event }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { on } = useSse()
  const urlTab = tabFromParam(searchParams.get('tab'))
  const urlItem = searchParams.get('item')
  const [tab, setTab] = useState<Tab>(urlTab ?? 'overview')
  const [editOpen, setEditOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [lifeCyclePending, setLifeCyclePending] = useState(false)
  const [localEvent, setLocalEvent] = useState(event)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [focusItem, setFocusItem] = useState<{ tab: Tab; id: string } | null>(
    urlTab && urlItem ? { tab: urlTab, id: urlItem } : null,
  )
  const [prevUrl, setPrevUrl] = useState({ tab: urlTab, item: urlItem })
  if (urlTab !== prevUrl.tab || urlItem !== prevUrl.item) {
    setPrevUrl({ tab: urlTab, item: urlItem })
    if (urlTab) setTab(urlTab)
    if (urlTab && urlItem) setFocusItem({ tab: urlTab, id: urlItem })
  }
  const [open, setOpen] = useState({ schedule: false, budget: false, checklist: false })
  const tabListRef = useRef<HTMLDivElement>(null)
  const peopleRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const viewer = localEvent.viewer ?? { isHost: false, role: 'VIEWER' as const, surfaces: [] }
  const canSee = (surface: EventSurface) => viewer.isHost || viewer.surfaces.includes(surface)
  const visibleTabs = TABS.filter((t) => {
    const surface = TAB_SURFACE[t.id]
    return !surface || canSee(surface)
  })

  if (!visibleTabs.some((t) => t.id === tab)) {
    setTab('overview')
  }

  useEffect(() => {
    proxyClient
      .get<Record<string, number>>(`/events/${localEvent.id}/unread`)
      .then(({ data }) => setUnread(data ?? {}))
      .catch(() => {})
  }, [localEvent.id])

  useEffect(() => {
    return on((event) => {
      if (event.type !== 'event_activity' || !event.activity) return
      if (event.activity.eventId !== localEvent.id) return
      const key = event.activity.surface
      if (TAB_UNREAD[tab] === key) return
      setUnread((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))
    })
  }, [on, localEvent.id, tab])

  useEffect(() => {
    const surface = TAB_UNREAD[tab]
    void proxyClient.patch(`/events/${localEvent.id}/unread`, { surface }).catch(() => {})
  }, [tab, localEvent.id])
  const unreadSurface = TAB_UNREAD[tab]
  const [clearedTab, setClearedTab] = useState(tab)
  if (tab !== clearedTab) {
    setClearedTab(tab)
    setUnread((prev) => (prev[unreadSurface] ? { ...prev, [unreadSurface]: 0 } : prev))
  }

  function openLinkedItem(kind: 'budget' | 'checklist' | 'moodboard', id: string) {
    const surface: EventSurface =
      kind === 'budget' ? 'BUDGET' : kind === 'checklist' ? 'CHECKLIST' : 'MOODBOARD'
    if (!canSee(surface)) return
    setTab(kind)
    setFocusItem({ tab: kind, id })
  }

  async function removeFromParent() {
    const parent = localEvent.parent
    if (!parent) return
    if (
      !confirm(
        `Remove “${localEvent.title}” from ${parent.title}? It stays in My Events as its own event.`,
      )
    )
      return
    setLifeCyclePending(true)
    try {
      await proxyClient.post(`/events/${parent.id}/children/${localEvent.id}/detach`)
      setLocalEvent((prev) => ({ ...prev, parentId: null, parent: null }))
      router.refresh()
    } finally {
      setLifeCyclePending(false)
    }
  }

  async function deleteThisEvent() {
    const childCount = localEvent.children?.length ?? 0
    const message =
      !localEvent.parentId && childCount > 0
        ? `Delete “${localEvent.title}” and its ${childCount} sub-event${childCount === 1 ? '' : 's'}? They will be removed from your events.`
        : `Delete “${localEvent.title}”? It will be removed from your events.`
    if (!confirm(message)) return
    setLifeCyclePending(true)
    try {
      await proxyClient.delete(`/events/${localEvent.id}`)
      router.push(localEvent.parent ? `/events/${localEvent.parent.id}` : '/events')
      router.refresh()
    } finally {
      setLifeCyclePending(false)
    }
  }

  function setChecklist(checklist: NonNullable<typeof localEvent.checklist>) {
    setLocalEvent((prev) => ({ ...prev, checklist }))
  }

  function toggleOpen(key: keyof typeof open) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useLayoutEffect(() => {
    const list = tabListRef.current
    if (!list) return
    const update = () => {
      const activeBtn = list.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!activeBtn) return
      setIndicator({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(list)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [tab])

  const past = isPastEvent(localEvent)
  const days = past ? null : daysUntil(localEvent.estimatedDate)
  const stats = localEvent.stats
  const totalSpent = stats?.spentTotal ?? 0
  const doneCount = stats?.checklistDone ?? 0
  const totalTasks = stats?.checklistTotal ?? 0
  const remaining = localEvent.totalBudget - totalSpent
  const budgetOver = remaining < 0
  const guestCount = stats?.confirmedGuestCount ?? 0

  const subtitle = [
    EVENT_TYPE_LABELS[localEvent.eventType] ?? localEvent.eventType,
    localEvent.tribes.length > 0
      ? localEvent.tribes.map((t) => t.charAt(0) + t.slice(1).toLowerCase()).join(' & ')
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <EventAccessProvider eventId={localEvent.id} viewer={viewer}>
      <MoodBoardProvider eventId={localEvent.id}>
        <div className="mx-auto max-w-5xl px-4 py-8 pb-16 sm:px-6 lg:px-8">
          {/* ── Back ──────────────────────────────────────────────────────── */}
          <Link
            href={localEvent.parent ? `/events/${localEvent.parent.id}` : '/events'}
            className="mb-8 inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-muted)' }}
          >
            <ChevronLeft size={13} strokeWidth={2.5} />
            {localEvent.parent ? localEvent.parent.title : 'My Events'}
          </Link>

          {/* ── Hero header ───────────────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Title block */}
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  {past && (
                    <span
                      className="order-last rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase sm:order-first"
                      style={{
                        background: 'color-mix(in srgb, var(--color-muted) 18%, transparent)',
                        color: 'var(--color-muted)',
                      }}
                    >
                      Past
                    </span>
                  )}
                  {days !== null && (
                    <span
                      className="order-last rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase sm:order-first"
                      style={{
                        background:
                          days <= 0
                            ? 'color-mix(in srgb, var(--color-success) 14%, transparent)'
                            : days <= 30
                              ? 'color-mix(in srgb, var(--color-warning) 14%, transparent)'
                              : 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
                        color:
                          days <= 0
                            ? 'var(--color-success)'
                            : days <= 30
                              ? 'var(--color-warning)'
                              : 'var(--color-brand-primary)',
                      }}
                    >
                      {days <= 0 ? 'Today' : `${days} days away`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <h1
                    className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {localEvent.title}
                  </h1>
                  {viewer.isHost && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/8 dark:hover:bg-white/8"
                      style={{
                        color: 'var(--color-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                      title="Edit event details"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {subtitle}
                  {localEvent.estimatedDate && (
                    <span style={{ color: 'var(--color-muted)' }}>
                      {' '}
                      ·{' '}
                      {new Date(localEvent.estimatedDate).toLocaleDateString('en-CA', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  {localEvent.location && (
                    <span style={{ color: 'var(--color-muted)' }}> · {localEvent.location}</span>
                  )}
                </p>
                {viewer.isHost && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {localEvent.parent && (
                      <button
                        type="button"
                        disabled={lifeCyclePending}
                        onClick={() => void removeFromParent()}
                        className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                        style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        Remove from {localEvent.parent.title}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={lifeCyclePending}
                      onClick={() => void deleteThisEvent()}
                      className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                      style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      Delete event
                    </button>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 items-center gap-2">
                {event.viewer?.isHost !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      setShareOpen(true)
                      peopleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all hover:opacity-80 active:scale-[.98]"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <Share2 size={13} />
                    Invite
                  </button>
                )}
                {canSee('GUESTS') && (
                  <Link
                    href={`/events/${event.id}/guests`}
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all hover:opacity-80 active:scale-[.98]"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <Users size={13} />
                    Guests
                    {guestCount > 0 && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          background:
                            'color-mix(in srgb, var(--color-brand-primary) 15%, transparent)',
                          color: 'var(--color-brand-primary)',
                        }}
                      >
                        {guestCount}
                      </span>
                    )}
                  </Link>
                )}
                {canSee('VENDORS') && (
                  <Link
                    href="/vendors"
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all hover:opacity-80 active:scale-[.98]"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <Sparkles size={13} />
                    Find Vendors
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Stats ─────────────────────────────────────────────────────── */}
          <div className="mb-8 flex flex-wrap gap-x-10 gap-y-5">
            <Stat
              icon={CalendarDays}
              value={days === null ? 'TBD' : days <= 0 ? 'Today' : `${days}`}
              label={days === null ? 'Date not set' : days <= 0 ? 'Event day' : 'Days until event'}
              accent={days !== null && days <= 30 && days > 0}
            />
            {canSee('GUESTS') && (
              <Stat
                icon={Users}
                value={
                  guestCount > 0 ? `${guestCount}` : (localEvent.guestCount?.toString() ?? '—')
                }
                label={guestCount > 0 ? 'Guests confirmed' : 'Guests expected'}
              />
            )}
            {canSee('BUDGET') && (
              <Stat
                icon={DollarSign}
                value={`CA$${Math.abs(remaining).toLocaleString('en-CA')}`}
                label={budgetOver ? 'Over budget' : 'Remaining budget'}
                accent={budgetOver}
              />
            )}
            {canSee('CHECKLIST') && (
              <Stat
                icon={CheckSquare}
                value={totalTasks > 0 ? `${doneCount}/${totalTasks}` : '—'}
                label={totalTasks > 0 ? 'Tasks complete' : 'No tasks yet'}
              />
            )}
          </div>

          <div ref={peopleRef}>
            <EventPeopleSection
              eventId={localEvent.id}
              subEvents={localEvent.children ?? []}
              isHost={viewer.isHost}
              inviteOpen={shareOpen}
              onInviteOpenChange={setShareOpen}
            />
          </div>

          <EventSubEventsSection event={localEvent} onEventChange={setLocalEvent} />

          {/* ── Tab navigation ────────────────────────────────────────────── */}
          <div
            className="mb-6 overflow-x-auto"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div ref={tabListRef} className="relative flex w-max min-w-full" role="tablist">
              {visibleTabs.map(({ id, label }) => {
                const active = tab === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setTab(id)
                      setFocusItem(null)
                    }}
                    className="relative shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
                    style={{
                      color: active ? 'var(--color-brand-primary)' : 'var(--color-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {label}
                    {(unread[TAB_UNREAD[id]] ?? 0) > 0 && (
                      <span
                        className="ml-1.5 inline-flex h-4 min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                        style={{
                          background: 'var(--color-brand-primary)',
                          color: 'var(--color-primary-foreground)',
                        }}
                      >
                        {unread[TAB_UNREAD[id]] > 9 ? '9+' : unread[TAB_UNREAD[id]]}
                      </span>
                    )}
                  </button>
                )
              })}
              <div
                aria-hidden="true"
                className="absolute bottom-0 h-[2px] rounded-full transition-all duration-200 ease-out"
                style={{
                  background: 'var(--color-brand-primary)',
                  left: indicator.left,
                  width: indicator.width,
                }}
              />
            </div>
          </div>

          {/* ── Tab panels ────────────────────────────────────────────────── */}

          {tab === 'overview' && (
            <div className="space-y-6">
              {canSee('SCHEDULE') &&
                (open.schedule ? (
                  <ScheduleSection
                    eventId={localEvent.id}
                    itinerary={!localEvent.parentId}
                    childrenEvents={localEvent.children ?? []}
                    onItemsChange={(schedule) => setLocalEvent((prev) => ({ ...prev, schedule }))}
                    onOpenLinkedItem={openLinkedItem}
                    onChecklistChange={setChecklist}
                    onCollapse={() => toggleOpen('schedule')}
                  />
                ) : (
                  <OverviewChip
                    title="Schedule"
                    summary={
                      stats?.scheduleCount
                        ? `${stats.scheduleCount} block${stats.scheduleCount === 1 ? '' : 's'}`
                        : undefined
                    }
                    onOpen={() => toggleOpen('schedule')}
                  />
                ))}
              {canSee('BUDGET') &&
                (open.budget ? (
                  <BudgetSection
                    eventId={localEvent.id}
                    eventTitle={localEvent.title}
                    totalBudget={localEvent.totalBudget}
                    onCollapse={() => toggleOpen('budget')}
                  />
                ) : (
                  <OverviewChip
                    title="Budget"
                    summary={`CA$${totalSpent.toLocaleString('en-CA')} spent`}
                    onOpen={() => toggleOpen('budget')}
                  />
                ))}
              {canSee('CHECKLIST') &&
                (open.checklist ? (
                  <ChecklistSection
                    eventId={localEvent.id}
                    onItemsChange={setChecklist}
                    onCollapse={() => toggleOpen('checklist')}
                  />
                ) : (
                  <OverviewChip
                    title="Checklist"
                    summary={totalTasks > 0 ? `${doneCount}/${totalTasks}` : undefined}
                    onOpen={() => toggleOpen('checklist')}
                  />
                ))}
              <EventActivityFeed key={localEvent.id} eventId={localEvent.id} />
              <div
                className="rounded-2xl px-5 py-4"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
              >
                <EventItemComments subjectType="EVENT" subjectId={localEvent.id} bare />
              </div>
            </div>
          )}

          {tab === 'schedule' && (
            <ScheduleSection
              eventId={localEvent.id}
              itinerary={!localEvent.parentId}
              childrenEvents={localEvent.children ?? []}
              focusItemId={focusItem?.tab === 'schedule' ? focusItem.id : undefined}
              onItemsChange={(schedule) => setLocalEvent((prev) => ({ ...prev, schedule }))}
              onOpenLinkedItem={openLinkedItem}
              onChecklistChange={setChecklist}
            />
          )}

          {tab === 'checklist' && (
            <ChecklistSection
              eventId={localEvent.id}
              focusItemId={focusItem?.tab === 'checklist' ? focusItem.id : undefined}
              onItemsChange={setChecklist}
            />
          )}

          {tab === 'budget' && (
            <BudgetSection
              eventId={localEvent.id}
              eventTitle={localEvent.title}
              totalBudget={localEvent.totalBudget}
              focusItemId={focusItem?.tab === 'budget' ? focusItem.id : undefined}
            />
          )}

          {tab === 'vendors' && (
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} style={{ color: 'var(--color-brand-primary)' }} />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Vendor Conversations
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/messages?event=${localEvent.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    All messages <ArrowRight size={11} />
                  </Link>
                  <Link
                    href="/vendors"
                    className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--color-brand-primary)' }}
                  >
                    <Sparkles size={11} /> Browse vendors
                  </Link>
                </div>
              </div>
              <EventInquiriesSection eventId={localEvent.id} />
            </div>
          )}

          {tab === 'moodboard' && (
            <MoodBoardTab
              focusEntryId={focusItem?.tab === 'moodboard' ? focusItem.id : undefined}
            />
          )}

          {/* Edit modal */}
          {editOpen && (
            <EditEventModal
              event={localEvent}
              onClose={() => setEditOpen(false)}
              onSaved={(updates) => setLocalEvent((prev) => ({ ...prev, ...updates }))}
            />
          )}
        </div>
      </MoodBoardProvider>
    </EventAccessProvider>
  )
}
