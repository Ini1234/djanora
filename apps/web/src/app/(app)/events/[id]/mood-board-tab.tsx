'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  BookmarkX,
  MapPin,
  DollarSign,
  ChevronRight,
  Loader2,
  Bookmark,
  CheckSquare,
  Receipt,
  Clock,
} from 'lucide-react'
import { useMoodBoardLinks } from './mood-board-context'
import { useEventAccess } from './event-access-context'
import { EventItemComments } from './event-item-comments'

const CATEGORIES = [
  'ALL',
  'PERFORMANCE',
  'VENUE',
  'DECOR',
  'MUSIC',
  'FASHION',
  'FOOD',
  'OTHER',
] as const
type CategoryFilter = (typeof CATEGORIES)[number]

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
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

export function MoodBoardTab({ focusEntryId }: { focusEntryId?: string }) {
  const { entries, loading, removeEntry } = useMoodBoardLinks()
  const { canEdit } = useEventAccess()
  const [removing, setRemoving] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('ALL')

  async function handleRemove(inspirationItemId: string) {
    setRemoving(inspirationItemId)
    try {
      await removeEntry(inspirationItemId)
    } finally {
      setRemoving(null)
    }
  }

  const filtered =
    activeFilter === 'ALL'
      ? entries
      : entries.filter((e) => e.inspirationItem.category === activeFilter)

  useEffect(() => {
    if (!focusEntryId) return
    setActiveFilter('ALL')
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`mood-entry-${focusEntryId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusEntryId])

  // Count per category (for pill badges)
  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.inspirationItem.category] = (acc[e.inspirationItem.category] ?? 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: 'var(--color-brand-primary)' }}
        />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)' }}
        >
          <Bookmark size={24} style={{ color: 'var(--color-brand-primary)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Your mood board is empty
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Save inspiration items to build your vision for this event
          </p>
        </div>
        <Link
          href="/inspiration"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
        >
          <Sparkles size={14} /> Browse Inspiration
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header + add more */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Saved ideas
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>
            {entries.length} item{entries.length !== 1 ? 's' : ''} · {Object.keys(counts).length}{' '}
            categories
          </p>
        </div>
        <Link
          href="/inspiration"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium"
          style={{
            background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
            color: 'var(--color-brand-primary)',
          }}
        >
          <Sparkles size={11} /> Add more
        </Link>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.filter((c) => c === 'ALL' || counts[c]).map((cat) => {
          const active = activeFilter === cat
          const color = cat === 'ALL' ? undefined : CATEGORY_COLORS[cat]
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase transition-all"
              style={{
                background: active
                  ? (color?.text ?? 'var(--color-brand-primary)')
                  : (color?.bg ?? 'color-mix(in srgb, var(--color-text-primary) 6%, transparent)'),
                color: active ? '#fff' : (color?.text ?? 'var(--color-text-secondary)'),
                border: '1px solid transparent',
              }}
            >
              {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              {cat !== 'ALL' && counts[cat] && <span className="opacity-80">{counts[cat]}</span>}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
          No items in this category yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => {
            const item = entry.inspirationItem
            const cat = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.OTHER

            return (
              <div
                key={entry.id}
                id={`mood-entry-${entry.id}`}
                className="flex flex-col overflow-hidden rounded-2xl"
                style={{
                  background: 'var(--card-bg)',
                  border:
                    entry.id === focusEntryId
                      ? '1px solid var(--color-brand-primary)'
                      : '1px solid var(--color-border)',
                }}
              >
                {/* Image */}
                <div
                  className="relative flex h-32 items-center justify-center"
                  style={{ background: cat.bg }}
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Sparkles size={28} style={{ color: cat.text, opacity: 0.4 }} />
                  )}
                  <div
                    className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {item.category}
                  </div>
                  {canEdit('MOODBOARD') && (
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={removing === item.id}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full"
                      style={{
                        background: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                      }}
                      title="Remove"
                    >
                      {removing === item.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <BookmarkX size={11} />
                      )}
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p
                    className="text-sm leading-snug font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="line-clamp-2 text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {item.description}
                  </p>

                  {entry.notes && (
                    <p
                      className="rounded-lg px-2 py-1 text-xs italic"
                      style={{
                        background: 'color-mix(in srgb, var(--color-text-primary) 4%, transparent)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      &ldquo;{entry.notes}&rdquo;
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    {item.location && (
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        <MapPin size={9} /> {item.location}
                      </span>
                    )}
                    {item.priceRangeFrom != null && (
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        <DollarSign size={9} />
                        {item.currency}
                        {item.priceRangeFrom.toLocaleString()}
                        {item.priceRangeTo ? `–${item.priceRangeTo.toLocaleString()}` : '+'}
                      </span>
                    )}
                  </div>

                  {/* Linked planning item badges */}
                  {(entry.checklistItem ||
                    entry.budgetItem ||
                    (entry.scheduleItems?.length ?? 0) > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(entry.scheduleItems ?? []).map((block) => (
                        <span
                          key={block.id}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background:
                              'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
                            color: 'var(--color-brand-primary)',
                          }}
                        >
                          <Clock size={9} /> {block.title}
                        </span>
                      ))}
                      {entry.checklistItem && (
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background: 'color-mix(in srgb, #22c55e 12%, transparent)',
                            color: '#16a34a',
                          }}
                        >
                          <CheckSquare size={9} /> {entry.checklistItem.title}
                        </span>
                      )}
                      {entry.budgetItem && (
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background: 'color-mix(in srgb, #3b82f6 12%, transparent)',
                            color: '#2563eb',
                          }}
                        >
                          <Receipt size={9} />{' '}
                          {entry.budgetItem.label ?? entry.budgetItem.category.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Vendor link */}
                  {item.vendorProfile && (
                    <Link
                      href={`/vendors/${item.vendorProfile.slug}`}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      style={{
                        background:
                          'color-mix(in srgb, var(--color-brand-primary) 8%, transparent)',
                        color: 'var(--color-brand-primary)',
                      }}
                    >
                      <span>{item.vendorProfile.businessName}</span>
                      <ChevronRight size={11} />
                    </Link>
                  )}
                  <EventItemComments subjectType="MOOD_BOARD_ITEM" subjectId={entry.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
