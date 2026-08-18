'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Sparkles,
  MapPin,
  DollarSign,
  Bookmark,
  BookmarkCheck,
  BookmarkX,
  ChevronRight,
  Heart,
  Loader2,
  Music,
  Utensils,
  Shirt,
  Building2,
  Palette,
  Drama,
  Users,
  Star,
  X,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Receipt,
  Clock,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { proxyClient } from '@/lib/proxy-client'
import { queryKeys } from '@/lib/query-keys'
import { lookCategories, lookInCategory } from '@/lib/look-categories'
import { InspirationDetail } from './inspiration-detail'

// ─── Types ────────────────────────────────────────────────────────────────────

type InspirationCategory =
  'PERFORMANCE' | 'VENUE' | 'DECOR' | 'MUSIC' | 'FASHION' | 'FOOD' | 'OTHER'

interface VendorProfile {
  id: string
  slug: string
  businessName: string
  isVerified: boolean
  avatarUrl: string | null
  city: string | null
}

interface InspirationItem {
  id: string
  title: string
  description: string
  category: InspirationCategory
  categories?: InspirationCategory[]
  tags: string[]
  tagItems?: { slug: string; label: string }[]
  imageUrl: string | null
  location: string | null
  priceRangeFrom: number | null
  priceRangeTo: number | null
  currency: string
  isAdminCurated: boolean
  costNote?: string | null
  media?: {
    id: string
    url: string
    mediaType: 'IMAGE' | 'VIDEO' | 'EXTERNAL'
    isCover: boolean
  }[]
  vendorProfile: VendorProfile | null
  likeCount?: number
  saveCount?: number
}

interface Event {
  id: string
  title: string
  checklist?: { id: string; title: string }[]
  budgetItems?: { id: string; label: string | null; vendorName?: string | null; category: string }[]
}

interface SavedEntry {
  id: string
  notes: string | null
  event: { id: string; title: string }
  inspirationItem: InspirationItem
  checklistItem: { id: string; title: string } | null
  budgetItem: { id: string; label: string | null; category: string } | null
  scheduleItems: { id: string; title: string }[]
}

interface GroupedSaved {
  inspirationItem: InspirationItem
  events: { id: string; title: string }[]
  notes: string[]
  checklistItems: { id: string; title: string }[]
  budgetItems: { id: string; label: string | null; category: string }[]
  scheduleItems: { id: string; title: string }[]
}

function groupSaved(entries: SavedEntry[]): GroupedSaved[] {
  const groups = new Map<string, GroupedSaved>()
  for (const entry of entries) {
    const id = entry.inspirationItem.id
    const existing = groups.get(id)
    if (!existing) {
      groups.set(id, {
        inspirationItem: entry.inspirationItem,
        events: [entry.event],
        notes: entry.notes ? [entry.notes] : [],
        checklistItems: entry.checklistItem ? [entry.checklistItem] : [],
        budgetItems: entry.budgetItem ? [entry.budgetItem] : [],
        scheduleItems: entry.scheduleItems ?? [],
      })
      continue
    }
    if (!existing.events.some((event) => event.id === entry.event.id)) {
      existing.events.push(entry.event)
    }
    if (entry.notes && !existing.notes.includes(entry.notes)) {
      existing.notes.push(entry.notes)
    }
    if (
      entry.checklistItem &&
      !existing.checklistItems.some((item) => item.id === entry.checklistItem!.id)
    ) {
      existing.checklistItems.push(entry.checklistItem)
    }
    if (
      entry.budgetItem &&
      !existing.budgetItems.some((item) => item.id === entry.budgetItem!.id)
    ) {
      existing.budgetItems.push(entry.budgetItem)
    }
    for (const block of entry.scheduleItems ?? []) {
      if (!existing.scheduleItems.some((item) => item.id === block.id)) {
        existing.scheduleItems.push(block)
      }
    }
  }
  return [...groups.values()]
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { id: InspirationCategory | 'ALL'; label: string; icon: React.ElementType }[] = [
  { id: 'ALL', label: 'All', icon: Sparkles },
  { id: 'PERFORMANCE', label: 'Performance', icon: Drama },
  { id: 'VENUE', label: 'Venues', icon: Building2 },
  { id: 'DECOR', label: 'Decor', icon: Palette },
  { id: 'MUSIC', label: 'Music', icon: Music },
  { id: 'FASHION', label: 'Fashion', icon: Shirt },
  { id: 'FOOD', label: 'Food', icon: Utensils },
]

const CATEGORY_COLORS: Record<InspirationCategory, { bg: string; text: string }> = {
  PERFORMANCE: { bg: 'color-mix(in srgb, #8b5cf6 12%, transparent)', text: '#8b5cf6' },
  VENUE: { bg: 'color-mix(in srgb, #0ea5e9 12%, transparent)', text: '#0ea5e9' },
  DECOR: { bg: 'color-mix(in srgb, #f59e0b 12%, transparent)', text: '#f59e0b' },
  MUSIC: { bg: 'color-mix(in srgb, #ec4899 12%, transparent)', text: '#ec4899' },
  FASHION: { bg: 'color-mix(in srgb, #14b8a6 12%, transparent)', text: '#14b8a6' },
  FOOD: { bg: 'color-mix(in srgb, #f97316 12%, transparent)', text: '#f97316' },
  OTHER: {
    bg: 'color-mix(in srgb, var(--color-muted) 12%, transparent)',
    text: 'var(--color-muted)',
  },
}

function CategoryBadges({
  item,
}: {
  item: { category: InspirationCategory; categories?: InspirationCategory[] }
}) {
  return (
    <div className="absolute top-3 left-3 flex max-w-[70%] flex-wrap gap-1">
      {lookCategories(item).map((c) => (
        <span
          key={c}
          className="rounded-full px-2 py-1 text-[10px] font-semibold tracking-wide uppercase"
          style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          {c.replaceAll('_', ' ')}
        </span>
      ))}
    </div>
  )
}

// ─── Matching vendor types ────────────────────────────────────────────────────

interface MatchedVendor {
  id: string
  slug: string
  businessName: string
  category: string
  avatarUrl: string | null
  city: string | null
  isVerified: boolean
  averageRating: number | null
  totalReviews: number
  estimatedPriceFrom: number | null
  estimatedPriceTo: number | null
  currency: string
  _matchType: 'direct' | 'semantic' | 'category'
  _score: number
}

// ─── Find vendors panel ───────────────────────────────────────────────────────

function MatchedVendorRow({ vendor }: { vendor: MatchedVendor }) {
  const initials = vendor.businessName.slice(0, 2).toUpperCase()

  return (
    <Link
      href={`/vendors/${vendor.slug}`}
      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-black/4 dark:hover:bg-white/4"
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
        style={{
          background: vendor.avatarUrl
            ? 'transparent'
            : 'color-mix(in srgb, var(--color-brand-primary) 15%, transparent)',
          color: 'var(--color-brand-primary)',
        }}
      >
        {vendor.avatarUrl ? (
          <img
            src={vendor.avatarUrl}
            alt={vendor.businessName}
            className="h-full w-full rounded-xl object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className="truncate text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {vendor.businessName}
          </p>
          {vendor.isVerified && (
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: 'color-mix(in srgb, #0ea5e9 12%, transparent)',
                color: '#0ea5e9',
              }}
            >
              Verified
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {vendor.category.replace('_', ' ')}
          </span>
          {vendor.city && (
            <>
              <span style={{ color: 'var(--color-border)' }}>·</span>
              <span
                className="flex items-center gap-0.5 text-[11px]"
                style={{ color: 'var(--color-muted)' }}
              >
                <MapPin size={9} /> {vendor.city}
              </span>
            </>
          )}
          {vendor.averageRating && (
            <>
              <span style={{ color: 'var(--color-border)' }}>·</span>
              <span
                className="flex items-center gap-0.5 text-[11px]"
                style={{ color: 'var(--color-muted)' }}
              >
                <Star size={9} /> {vendor.averageRating.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        {vendor.estimatedPriceFrom != null ? (
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {vendor.currency}
            {vendor.estimatedPriceFrom.toLocaleString()}
            {vendor.estimatedPriceTo ? `–${vendor.estimatedPriceTo.toLocaleString()}` : '+'}
          </p>
        ) : null}
        <ArrowRight size={13} className="mt-0.5 ml-auto" style={{ color: 'var(--color-muted)' }} />
      </div>
    </Link>
  )
}

function FindVendorsPanel({ item, onClose }: { item: InspirationItem; onClose: () => void }) {
  const { data: vendors = [], isPending: loading } = useQuery({
    queryKey: queryKeys.inspirationMatchingVendors(item.id),
    queryFn: async () => {
      const { data } = await proxyClient.get(`/inspiration/${item.id}/matching-vendors`)
      return Array.isArray(data) ? (data as MatchedVendor[]) : []
    },
  })

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="absolute top-0 right-0 flex h-full w-full max-w-md flex-col shadow-2xl"
        style={{
          background: 'var(--color-card)',
          borderLeft: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <p
              className="text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: 'var(--color-brand-primary)' }}
            >
              Matching Vendors
            </p>
            <p
              className="mt-0.5 line-clamp-1 text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {item.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/8 dark:hover:bg-white/8"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2
                size={22}
                className="animate-spin"
                style={{ color: 'var(--color-brand-primary)' }}
              />
            </div>
          ) : vendors.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Users size={28} style={{ color: 'var(--color-muted)', opacity: 0.4 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                No vendors found yet
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                As more vendors join and build profiles, they&apos;ll appear here automatically.
              </p>
              <Link
                href="/vendors"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--color-brand-primary)' }}
              >
                Browse all vendors <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <>
              <p className="px-5 pt-4 pb-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                {vendors[0]._matchType === 'direct'
                  ? 'This vendor created this inspiration item'
                  : vendors[0]._matchType === 'semantic'
                    ? `${vendors.length} vendors matched by AI similarity`
                    : `${vendors.length} vendors matched by category`}
              </p>
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {vendors.map((v) => (
                  <MatchedVendorRow key={v.id} vendor={v} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <Link
            href="/vendors"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
              color: 'var(--color-brand-primary)',
            }}
          >
            <Search size={14} /> Browse all vendors
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Save-to-event modal (2-step: event → optional link) ─────────────────────

interface ChecklistItem {
  id: string
  title: string
}
interface BudgetItem {
  id: string
  label: string | null
  vendorName?: string | null
  category: string
}
interface ScheduleBlock {
  id: string
  title: string
  startTime: string | null
}

function SaveModal({
  item,
  onClose,
  onSaved,
}: {
  item: InspirationItem
  onClose: () => void
  onSaved: (itemId: string, eventId: string) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [scheduleItems, setScheduleItems] = useState<ScheduleBlock[]>([])
  const [linkedChecklist, setLinkedChecklist] = useState('')
  const [linkedBudget, setLinkedBudget] = useState('')
  const [linkedSchedules, setLinkedSchedules] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [linksLoading, setLinksLoading] = useState(false)

  useEffect(() => {
    proxyClient
      .get('/events')
      .then(({ data }) => {
        const arr = Array.isArray(data) ? data : []
        setEvents(arr)
        if (arr.length > 0) setSelectedEvent(arr[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (step !== 2 || !selectedEvent) return
    let cancelled = false
    setLinksLoading(true)
    setLinkedChecklist('')
    setLinkedBudget('')
    setLinkedSchedules([])

    Promise.all([
      proxyClient.get<ChecklistItem[]>(`/events/${selectedEvent}/checklist`),
      proxyClient.get<BudgetItem[]>(`/events/${selectedEvent}/budget`),
      proxyClient.get<ScheduleBlock[]>(`/events/${selectedEvent}/schedule`),
    ])
      .then(([checklistRes, budgetRes, scheduleRes]) => {
        if (cancelled) return
        setChecklist(Array.isArray(checklistRes.data) ? checklistRes.data : [])
        setBudgetItems(Array.isArray(budgetRes.data) ? budgetRes.data : [])
        setScheduleItems(Array.isArray(scheduleRes.data) ? scheduleRes.data : [])
      })
      .catch(() => {
        if (cancelled) return
        setChecklist([])
        setBudgetItems([])
        setScheduleItems([])
      })
      .finally(() => {
        if (!cancelled) setLinksLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [step, selectedEvent])

  async function handleSave() {
    if (!selectedEvent) return
    setSaving(true)
    setError('')
    try {
      await proxyClient.post(`/inspiration/${item.id}/save`, {
        eventId: selectedEvent,
        notes: notes || undefined,
        checklistItemId: linkedChecklist || undefined,
        budgetItemId: linkedBudget || undefined,
        scheduleItemIds: linkedSchedules,
      })
      onSaved(item.id, selectedEvent)
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectCls = 'w-full rounded-xl px-3 py-2 text-sm'
  const selectStyle = {
    background: 'color-mix(in srgb, var(--color-text-primary) 5%, transparent)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b p-5" style={{ borderColor: 'var(--color-border)' }}>
          <div className="mb-1 flex items-center justify-between">
            <p
              className="text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: 'var(--color-muted)' }}
            >
              Save to mood board · Step {step}/2
            </p>
            <div className="flex gap-1">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className="h-1 w-8 rounded-full transition-colors"
                  style={{
                    background: step >= s ? 'var(--color-brand-primary)' : 'var(--color-border)',
                  }}
                />
              ))}
            </div>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {item.title}
          </p>
        </div>

        {/* Step 1: choose event + notes */}
        {step === 1 && (
          <div className="space-y-4 p-5">
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-muted)' }}
              >
                Choose event
              </label>
              {events.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No events yet.{' '}
                  <Link
                    href="/events/new"
                    className="underline"
                    style={{ color: 'var(--color-brand-primary)' }}
                  >
                    Create one →
                  </Link>
                </p>
              ) : (
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className={selectCls}
                  style={selectStyle}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-muted)' }}
              >
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="What caught your eye?"
                className="w-full resize-none rounded-xl px-3 py-2 text-sm"
                style={selectStyle}
              />
            </div>
            {error && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                {error}
              </p>
            )}
          </div>
        )}

        {/* Step 2: optional links */}
        {step === 2 && (
          <div className="space-y-4 p-5">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Optionally link this inspiration to a checklist task, budget line, or one or more
              schedule blocks.
            </p>
            {linksLoading ? (
              <div
                className="flex items-center justify-center gap-2 py-6 text-sm"
                style={{ color: 'var(--color-muted)' }}
              >
                <Loader2 size={14} className="animate-spin" />
                Loading tasks, budget lines, and schedule…
              </div>
            ) : (
              <>
                <LinkChoiceList
                  label="Link to checklist item (optional)"
                  empty="No checklist tasks on this event"
                  items={checklist.map((c) => ({ id: c.id, label: c.title }))}
                  value={linkedChecklist}
                  onChange={setLinkedChecklist}
                />
                <LinkChoiceList
                  label="Link to budget item (optional)"
                  empty="No budget lines on this event"
                  items={budgetItems.map((b) => ({
                    id: b.id,
                    label: b.label || b.vendorName || b.category.replaceAll('_', ' '),
                  }))}
                  value={linkedBudget}
                  onChange={setLinkedBudget}
                />
                <LinkChoiceList
                  label="Link to schedule blocks (optional)"
                  empty="No schedule blocks on this event"
                  items={scheduleItems.map((block) => ({
                    id: block.id,
                    label: block.startTime ? `${block.title} · ${block.startTime}` : block.title,
                  }))}
                  values={linkedSchedules}
                  onToggle={(id) =>
                    setLinkedSchedules((prev) =>
                      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
                    )
                  }
                  multiple
                />
              </>
            )}
            {error && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                {error}
              </p>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex gap-2 px-5 pb-5">
          {step === 1 ? (
            <>
              <button
                onClick={onClose}
                className="h-9 flex-1 rounded-xl text-sm font-medium"
                style={{
                  background: 'color-mix(in srgb, var(--color-text-primary) 6%, transparent)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedEvent}
                className="h-9 flex-1 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{
                  background: 'var(--color-brand-primary)',
                  color: 'var(--color-primary-foreground)',
                }}
              >
                Next →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="h-9 flex-1 rounded-xl text-sm font-medium"
                style={{
                  background: 'color-mix(in srgb, var(--color-text-primary) 6%, transparent)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{
                  background: 'var(--color-brand-primary)',
                  color: 'var(--color-primary-foreground)',
                }}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <BookmarkCheck size={14} />
                )}
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LinkChoiceList({
  label,
  empty,
  items,
  value,
  values,
  onChange,
  onToggle,
  multiple = false,
}: {
  label: string
  empty: string
  items: { id: string; label: string }[]
  value?: string
  values?: string[]
  onChange?: (id: string) => void
  onToggle?: (id: string) => void
  multiple?: boolean
}) {
  const selectedIds = multiple ? (values ?? []) : value ? [value] : []
  const noneSelected = selectedIds.length === 0

  function clear() {
    if (multiple) {
      for (const id of selectedIds) onToggle?.(id)
      return
    }
    onChange?.('')
  }

  return (
    <div>
      <p
        className="mb-2 block text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: 'var(--color-muted)' }}
      >
        {label}
        {multiple && selectedIds.length > 0 && (
          <span className="ml-1 font-normal tracking-normal normal-case">
            ({selectedIds.length})
          </span>
        )}
      </p>
      <div
        className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl p-1"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <button
          type="button"
          onClick={clear}
          className="w-full rounded-lg px-3 py-1.5 text-left text-sm"
          style={{
            background: noneSelected
              ? 'color-mix(in srgb, var(--color-brand-primary) 14%, transparent)'
              : 'transparent',
            color: noneSelected ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
          }}
        >
          — No link —
        </button>
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            {empty}
          </p>
        ) : (
          items.map((item) => {
            const selected = selectedIds.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (multiple ? onToggle?.(item.id) : onChange?.(item.id))}
                className="w-full rounded-lg px-3 py-1.5 text-left text-sm"
                style={{
                  background: selected
                    ? 'color-mix(in srgb, var(--color-brand-primary) 14%, transparent)'
                    : 'transparent',
                  color: selected ? 'var(--color-brand-primary)' : 'var(--color-text-primary)',
                }}
              >
                {item.label}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Inspiration card ─────────────────────────────────────────────────────────

function InspirationCard({
  item,
  saved,
  liked,
  onSaveClick,
  onLikeClick,
  onFindVendors,
  onTagClick,
  onOpen,
}: {
  item: InspirationItem
  saved: boolean
  liked: boolean
  onSaveClick: (item: InspirationItem) => void
  onLikeClick: (item: InspirationItem) => void
  onFindVendors: (item: InspirationItem) => void
  onTagClick?: (slug: string) => void
  onOpen: (item: InspirationItem) => void
}) {
  const cat = CATEGORY_COLORS[lookCategories(item)[0] ?? item.category]

  return (
    <div
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-all hover:shadow-lg"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--color-border)',
      }}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item)
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Image / placeholder */}
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden"
        style={{ background: cat.bg }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-40">
            <Sparkles size={32} style={{ color: cat.text }} />
          </div>
        )}
        <CategoryBadges item={item} />
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onLikeClick(item)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110"
            style={{
              background: liked ? 'var(--color-brand-primary)' : 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
              color: liked ? 'var(--color-primary-foreground)' : '#fff',
            }}
            title={liked ? 'Unlike' : 'Like'}
            aria-pressed={liked}
          >
            <Heart size={14} className={liked ? 'fill-current' : ''} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSaveClick(item)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110"
            style={{
              background: saved ? 'var(--color-brand-primary)' : 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
              color: saved ? 'var(--color-primary-foreground)' : '#fff',
            }}
            title={saved ? 'Saved to mood board' : 'Save to mood board'}
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3
            className="text-sm leading-snug font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {item.title}
          </h3>
          <p
            className="mt-1 line-clamp-2 text-xs leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {item.description}
          </p>
        </div>

        {/* Tags */}
        {((item.tagItems && item.tagItems.length > 0) || item.tags.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {(item.tagItems ?? item.tags.map((label) => ({ slug: label, label })))
              .slice(0, 4)
              .map((tag) => (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTagClick?.(tag.slug)
                  }}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: cat.bg, color: cat.text }}
                >
                  {tag.label}
                </button>
              ))}
            {(item.tagItems ?? item.tags).length > 4 && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{ color: 'var(--color-muted)' }}
              >
                +{(item.tagItems ?? item.tags).length - 4}
              </span>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="mt-auto flex items-center gap-3 pt-1">
          {(item.location || item.vendorProfile?.city) && (
            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--color-muted)' }}
            >
              <MapPin size={10} /> {item.location ?? item.vendorProfile?.city}
            </span>
          )}
          {item.priceRangeFrom != null && (
            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--color-muted)' }}
            >
              <DollarSign size={10} />
              {item.currency}
              {item.priceRangeFrom.toLocaleString()}
              {item.priceRangeTo ? `–${item.priceRangeTo.toLocaleString()}` : '+'}
            </span>
          )}
          {(item.likeCount ?? 0) > 0 && (
            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--color-muted)' }}
            >
              <Heart size={10} /> {item.likeCount}
            </span>
          )}
        </div>

        {/* Vendor link / find vendors */}
        {item.vendorProfile ? (
          <Link
            href={`/vendors/${item.vendorProfile.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors"
            style={{
              background: 'color-mix(in srgb, var(--color-brand-primary) 8%, transparent)',
              color: 'var(--color-brand-primary)',
            }}
          >
            <span>View vendor: {item.vendorProfile.businessName}</span>
            <ChevronRight size={12} />
          </Link>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onFindVendors(item)
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors"
            style={{
              background: 'color-mix(in srgb, var(--color-brand-primary) 8%, transparent)',
              color: 'var(--color-brand-primary)',
            }}
          >
            <span className="flex items-center gap-1">
              <Users size={11} /> Find matching vendors
            </span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function SavedCard({
  group,
  removing,
  onUnsave,
  onFindVendors,
  onOpen,
}: {
  group: GroupedSaved
  removing: boolean
  onUnsave: () => void
  onFindVendors: (item: InspirationItem) => void
  onOpen: (item: InspirationItem) => void
}) {
  const item = group.inspirationItem
  const cat = CATEGORY_COLORS[lookCategories(item)[0] ?? item.category] ?? CATEGORY_COLORS.OTHER

  return (
    <div
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden"
        style={{ background: cat.bg }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <Sparkles size={32} style={{ color: cat.text, opacity: 0.4 }} />
        )}
        <CategoryBadges item={item} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onUnsave()
          }}
          disabled={removing}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', color: '#fff' }}
          title="Remove from saved"
        >
          {removing ? <Loader2 size={14} className="animate-spin" /> : <BookmarkX size={14} />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3
            className="text-sm leading-snug font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {item.title}
          </h3>
          <p
            className="mt-1 line-clamp-2 text-xs leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {item.description}
          </p>
        </div>

        {group.notes.length > 0 && (
          <p
            className="rounded-lg px-2 py-1.5 text-xs italic"
            style={{
              background: 'color-mix(in srgb, var(--color-text-primary) 4%, transparent)',
              color: 'var(--color-text-secondary)',
            }}
          >
            “{group.notes.join(' · ')}”
          </p>
        )}

        <p
          className="inline-flex w-fit flex-wrap items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium"
          style={{
            background: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
            color: 'var(--color-brand-primary)',
          }}
        >
          <CalendarDays size={10} className="shrink-0" />
          {group.events.map((event, index) => (
            <span key={event.id}>
              {index > 0 && ', '}
              <Link href={`/events/${event.id}`} className="hover:underline">
                {event.title}
              </Link>
            </span>
          ))}
        </p>

        {(group.checklistItems.length > 0 ||
          group.budgetItems.length > 0 ||
          group.scheduleItems.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {group.scheduleItems.map((block) => (
              <span
                key={block.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  color: 'var(--color-brand-primary)',
                  background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
                }}
              >
                <Clock size={9} /> {block.title}
              </span>
            ))}
            {group.checklistItems.map((task) => (
              <span
                key={task.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  color: 'var(--color-text-secondary)',
                  background: 'color-mix(in srgb, var(--color-muted) 12%, transparent)',
                }}
              >
                <CheckSquare size={9} /> {task.title}
              </span>
            ))}
            {group.budgetItems.map((budget) => (
              <span
                key={budget.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  color: 'var(--color-brand-primary)',
                  background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
                }}
              >
                <Receipt size={9} /> {budget.label ?? budget.category.replaceAll('_', ' ')}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-1">
          {item.vendorProfile ? (
            <Link
              href={`/vendors/${item.vendorProfile.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium"
              style={{
                background: 'color-mix(in srgb, var(--color-brand-primary) 8%, transparent)',
                color: 'var(--color-brand-primary)',
              }}
            >
              <span>View vendor: {item.vendorProfile.businessName}</span>
              <ChevronRight size={12} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onFindVendors(item)
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium"
              style={{
                background: 'color-mix(in srgb, var(--color-brand-primary) 8%, transparent)',
                color: 'var(--color-brand-primary)',
              }}
            >
              <span className="flex items-center gap-1">
                <Users size={11} /> Find matching vendors
              </span>
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  'Igbo entrance dance',
  'hall with high ceilings',
  'outdoor garden venue',
  'live afrobeats band',
  'gold and emerald decor',
  'Yoruba traditional ceremony',
]

export function InspirationClient({
  initialTag,
  initialItemId,
}: {
  initialTag?: string
  initialItemId?: string
}) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<InspirationCategory | 'ALL'>('ALL')
  const [activeTag, setActiveTag] = useState(initialTag ?? '')
  const [view, setView] = useState<'browse' | 'saved'>('browse')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [saveModal, setSaveModal] = useState<InspirationItem | null>(null)
  const [vendorPanelItem, setVendorPanelItem] = useState<InspirationItem | null>(null)
  const [detailItem, setDetailItem] = useState<InspirationItem | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)
  const openedQueryItem = useRef<string | null>(null)
  const [feedParams, setFeedParams] = useState({
    q: '',
    cat: 'ALL' as InspirationCategory | 'ALL',
    tag: initialTag ?? '',
  })

  const { data: browseTags = [] } = useQuery({
    queryKey: queryKeys.inspirationTags,
    queryFn: async () => {
      const { data } =
        await proxyClient.get<{ slug: string; label: string; isCurated: boolean }[]>(
          '/inspiration/tags',
        )
      return Array.isArray(data) ? data : []
    },
  })

  const {
    data: savedEntries = [],
    isPending: savedLoading,
    refetch: loadSaved,
  } = useQuery({
    queryKey: queryKeys.inspirationSaved,
    queryFn: async () => {
      const { data } = await proxyClient.get<SavedEntry[]>('/inspiration/saved')
      return Array.isArray(data) ? data : []
    },
  })
  const savedIds = useMemo(
    () => new Set(savedEntries.map((entry) => entry.inspirationItem.id)),
    [savedEntries],
  )

  const { data: likedIdList = [] } = useQuery({
    queryKey: queryKeys.inspirationLikedIds,
    queryFn: async () => {
      const { data } = await proxyClient.get<string[]>('/inspiration/liked/ids')
      return Array.isArray(data) ? data : []
    },
  })
  const likedIds = useMemo(() => new Set(likedIdList), [likedIdList])

  useEffect(() => {
    if (view === 'saved') return
    if (isFirstRender.current) {
      isFirstRender.current = false
      setFeedParams({ q: query, cat: activeCategory, tag: activeTag })
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFeedParams({ q: query, cat: activeCategory, tag: activeTag })
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeCategory, activeTag, view])

  const {
    data: items = [],
    isFetching: loading,
    isFetched: hasSearched,
  } = useQuery({
    queryKey: queryKeys.inspirationFeed(feedParams.q, feedParams.cat, feedParams.tag),
    enabled: view === 'browse',
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (feedParams.q.trim()) params.q = feedParams.q.trim()
      if (feedParams.cat !== 'ALL') params.category = feedParams.cat
      if (feedParams.tag.trim()) params.tag = feedParams.tag.trim()
      const { data } = await proxyClient.get('/inspiration', { params })
      return Array.isArray(data) ? (data as InspirationItem[]) : []
    },
  })

  function bumpLikeCount(itemId: string, delta: number) {
    const nextCount = (count: number | undefined) => Math.max(0, (count ?? 0) + delta)

    queryClient.setQueryData<InspirationItem[]>(
      queryKeys.inspirationFeed(feedParams.q, feedParams.cat, feedParams.tag),
      (prev) =>
        (prev ?? []).map((item) =>
          item.id === itemId ? { ...item, likeCount: nextCount(item.likeCount) } : item,
        ),
    )
    queryClient.setQueryData<SavedEntry[]>(queryKeys.inspirationSaved, (prev) =>
      (prev ?? []).map((entry) =>
        entry.inspirationItem.id === itemId
          ? {
              ...entry,
              inspirationItem: {
                ...entry.inspirationItem,
                likeCount: nextCount(entry.inspirationItem.likeCount),
              },
            }
          : entry,
      ),
    )
    queryClient.setQueryData<{ id: string; likeCount?: number }[]>(queryKeys.likedLooks, (prev) =>
      (prev ?? []).map((item) =>
        item.id === itemId ? { ...item, likeCount: nextCount(item.likeCount) } : item,
      ),
    )
    setDetailItem((prev) =>
      prev?.id === itemId ? { ...prev, likeCount: nextCount(prev.likeCount) } : prev,
    )
  }

  async function toggleLike(item: InspirationItem) {
    const next = !likedIds.has(item.id)
    queryClient.setQueryData<string[]>(queryKeys.inspirationLikedIds, (prev) => {
      const current = prev ?? []
      return next ? [...current, item.id] : current.filter((id) => id !== item.id)
    })
    bumpLikeCount(item.id, next ? 1 : -1)
    try {
      if (next) await proxyClient.post(`/inspiration/${item.id}/like`)
      else await proxyClient.delete(`/inspiration/${item.id}/like`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.likedLooks })
    } catch {
      queryClient.setQueryData<string[]>(queryKeys.inspirationLikedIds, (prev) => {
        const current = prev ?? []
        return next ? current.filter((id) => id !== item.id) : [...current, item.id]
      })
      bumpLikeCount(item.id, next ? -1 : 1)
    }
  }

  useEffect(() => {
    if (!initialItemId) return
    if (openedQueryItem.current === initialItemId) return
    const fromFeed = items.find((i) => i.id === initialItemId)
    if (fromFeed) {
      openedQueryItem.current = initialItemId
      setDetailItem(fromFeed)
      return
    }
    const fromSaved = savedEntries.find(
      (e) => e.inspirationItem.id === initialItemId,
    )?.inspirationItem
    if (fromSaved) {
      openedQueryItem.current = initialItemId
      setDetailItem(fromSaved)
      return
    }
    if (!hasSearched && savedLoading) return
    openedQueryItem.current = initialItemId
    let cancelled = false
    proxyClient
      .get<InspirationItem>(`/inspiration/${initialItemId}`)
      .then(({ data }) => {
        if (!cancelled && data) setDetailItem(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [initialItemId, items, savedEntries, hasSearched, savedLoading])

  function handleSaved() {
    void loadSaved()
  }

  async function handleUnsave(group: GroupedSaved) {
    setRemovingId(group.inspirationItem.id)
    try {
      await Promise.all(
        group.events.map((event) =>
          proxyClient.delete(`/inspiration/${group.inspirationItem.id}/save`, {
            params: { eventId: event.id },
          }),
        ),
      )
      queryClient.setQueryData<SavedEntry[]>(queryKeys.inspirationSaved, (prev) =>
        (prev ?? []).filter((row) => row.inspirationItem.id !== group.inspirationItem.id),
      )
    } finally {
      setRemovingId(null)
    }
  }

  const q = query.trim().toLowerCase()
  const groupedSaved = groupSaved(savedEntries)
  const visibleSaved = groupedSaved.filter((group) => {
    const item = group.inspirationItem
    if (activeCategory !== 'ALL' && !lookInCategory(item, activeCategory)) return false
    if (!q) return true
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      group.events.some((event) => event.title.toLowerCase().includes(q))
    )
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-16 sm:px-6 lg:px-8">
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'var(--color-brand-primary)' }} />
          <span
            className="text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-brand-primary)' }}
          >
            Inspiration
          </span>
        </div>
        <h1
          className="font-display mb-2 text-3xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Find your vision
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Search for dances, venues, decor, music, fashion — describe what you want in plain words.
        </p>
        <div
          className="mt-4 inline-flex rounded-xl p-1"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
          role="tablist"
        >
          {[
            { id: 'browse' as const, label: 'Browse', icon: Sparkles },
            { id: 'saved' as const, label: 'Saved', icon: BookmarkCheck },
          ].map(({ id, label, icon: Icon }) => {
            const active = view === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium"
                style={{
                  background: active ? 'var(--color-brand-primary)' : 'transparent',
                  color: active ? 'var(--color-primary-foreground)' : 'var(--color-text-secondary)',
                }}
              >
                <Icon size={13} />
                {label}
                {id === 'saved' && groupedSaved.length > 0 && (
                  <span className="text-[10px] font-semibold opacity-80">
                    {groupedSaved.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div
        className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 2px 12px rgba(0,0,0,.06)',
        }}
      >
        {loading ? (
          <Loader2
            size={18}
            className="shrink-0 animate-spin"
            style={{ color: 'var(--color-brand-primary)' }}
          />
        ) : (
          <Search size={18} className="shrink-0" style={{ color: 'var(--color-muted)' }} />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            view === 'saved'
              ? 'Search your saved ideas…'
              : 'Try "Igbo entrance dance" or "hall with high ceilings"…'
          }
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="shrink-0 text-xs"
            style={{ color: 'var(--color-muted)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Example queries */}
      {!query && view === 'browse' && (
        <div className="mb-6 flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className="rounded-full px-3 py-1.5 text-xs transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--color-text-primary) 5%, transparent)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* ── Category filters ────────────────────────────────────────── */}
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const active = activeCategory === id
          return (
            <button
              key={id}
              onClick={() => setActiveCategory(id as InspirationCategory | 'ALL')}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all"
              style={{
                background: active ? 'var(--color-brand-primary)' : 'var(--card-bg)',
                border: `1px solid ${active ? 'transparent' : 'var(--color-border)'}`,
                color: active ? 'var(--color-primary-foreground)' : 'var(--color-text-secondary)',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          )
        })}
      </div>

      {view === 'browse' && browseTags.length > 0 && (
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-2">
          {browseTags.map((tag) => {
            const active = activeTag === tag.slug
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => setActiveTag(active ? '' : tag.slug)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap"
                style={{
                  background: active ? 'var(--color-brand-primary)' : 'var(--card-bg)',
                  border: `1px solid ${active ? 'transparent' : 'var(--color-border)'}`,
                  color: active ? 'var(--color-primary-foreground)' : 'var(--color-text-secondary)',
                }}
              >
                {tag.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Results grid ────────────────────────────────────────────── */}
      {view === 'saved' ? (
        savedLoading ? (
          <div className="flex justify-center py-20">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: 'var(--color-brand-primary)' }}
            />
          </div>
        ) : savedEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Bookmark size={32} style={{ color: 'var(--color-muted)', opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Nothing saved yet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Bookmark ideas from Browse and they will show up here.
            </p>
            <button
              type="button"
              onClick={() => setView('browse')}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium"
              style={{
                background: 'var(--color-brand-primary)',
                color: 'var(--color-primary-foreground)',
              }}
            >
              <Sparkles size={14} /> Browse inspiration
            </button>
          </div>
        ) : visibleSaved.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Search size={32} style={{ color: 'var(--color-muted)', opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              No saved ideas match this filter
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSaved.map((group) => (
              <SavedCard
                key={group.inspirationItem.id}
                group={group}
                removing={removingId === group.inspirationItem.id}
                onUnsave={() => void handleUnsave(group)}
                onFindVendors={setVendorPanelItem}
                onOpen={setDetailItem}
              />
            ))}
          </div>
        )
      ) : loading && items.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2
            size={28}
            className="animate-spin"
            style={{ color: 'var(--color-brand-primary)' }}
          />
        </div>
      ) : items.length === 0 && hasSearched ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Search size={32} style={{ color: 'var(--color-muted)', opacity: 0.4 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {query.trim() ? `No results for “${query.trim()}”` : 'No inspiration yet'}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {query.trim()
              ? 'Try different words or browse a category'
              : 'Looks will show up here once they are published.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <InspirationCard
              key={item.id}
              item={item}
              saved={savedIds.has(item.id)}
              liked={likedIds.has(item.id)}
              onSaveClick={setSaveModal}
              onLikeClick={(look) => void toggleLike(look)}
              onFindVendors={setVendorPanelItem}
              onTagClick={setActiveTag}
              onOpen={setDetailItem}
            />
          ))}
        </div>
      )}

      {/* Save modal */}
      {saveModal && (
        <SaveModal
          item={saveModal}
          onClose={() => setSaveModal(null)}
          onSaved={() => handleSaved()}
        />
      )}

      {/* Find vendors panel */}
      {vendorPanelItem && (
        <FindVendorsPanel item={vendorPanelItem} onClose={() => setVendorPanelItem(null)} />
      )}

      {detailItem && (
        <InspirationDetail
          item={detailItem}
          saved={savedIds.has(detailItem.id)}
          liked={likedIds.has(detailItem.id)}
          likeCount={detailItem.likeCount ?? 0}
          onClose={() => setDetailItem(null)}
          onSaveClick={() => {
            setSaveModal(detailItem)
          }}
          onLikeClick={() => void toggleLike(detailItem)}
          onFindVendors={() => {
            setVendorPanelItem(detailItem)
            setDetailItem(null)
          }}
        />
      )}
    </div>
  )
}
