'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useHydratedState } from '@/lib/use-synced-state'
import Link from 'next/link'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Clock,
  MapPin,
  Calendar,
  DollarSign,
  ListTodo,
  Loader2,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
} from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { useLazyGet } from '@/lib/use-lazy-get'
import { TableSkeleton } from '@/components/ui/skeleton'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import { useTranslations } from 'next-intl'
import type {
  EventBudgetItem,
  EventChecklistItem,
  EventJourneyStop,
  EventScheduleItem,
} from '@/lib/api.types'
import { cn } from '@/lib/utils'
import { EVENT_TYPE_LABELS } from '@/lib/event-type-labels'
import { composeItinerary } from '@/lib/event-itinerary'
import { formatEventDate } from '@/lib/event-timing'
import { useMoodBoardLinks } from './mood-board-context'
import { useEventAccess } from './event-access-context'
import { EventItemComments } from './event-item-comments'

function formatTime(hhmm: string | null) {
  if (!hhmm) return null
  const [hStr, m] = hhmm.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${m} ${suffix}`
}

function budgetLabel(item: EventBudgetItem, tCat: (key: string) => string) {
  return item.label || item.vendorName || getVendorCategoryLabel(item.category, tCat)
}

const fieldStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
} as const

interface Props {
  eventId: string
  itinerary?: boolean
  childrenEvents?: EventJourneyStop[]
  initialItems?: EventScheduleItem[]
  budgetItems?: EventBudgetItem[]
  checklistItems?: EventChecklistItem[]
  focusItemId?: string
  onItemsChange?: (items: EventScheduleItem[]) => void
  onOpenLinkedItem?: (kind: 'budget' | 'checklist' | 'moodboard', id: string) => void
  onChecklistChange?: (items: EventChecklistItem[]) => void
  onCollapse?: () => void
}

export function ScheduleSection({
  eventId,
  itinerary = false,
  childrenEvents = [],
  initialItems,
  budgetItems: budgetProp,
  checklistItems: checklistProp,
  focusItemId,
  onItemsChange,
  onOpenLinkedItem,
  onChecklistChange,
  onCollapse,
}: Props) {
  const tCat = useTranslations('vendorCategories')
  const { canEdit, canSee } = useEventAccess()
  const { reload: reloadMoodBoard } = useMoodBoardLinks()
  const fetchedSchedule = useLazyGet<EventScheduleItem[]>(
    initialItems ? null : `/events/${eventId}/schedule`,
  )
  const fetchedBudget = useLazyGet<EventBudgetItem[]>(
    budgetProp || !canSee('BUDGET') ? null : `/events/${eventId}/budget`,
  )
  const fetchedChecklist = useLazyGet<EventChecklistItem[]>(
    checklistProp || !canSee('CHECKLIST') ? null : `/events/${eventId}/checklist`,
  )
  const [items, setItems] = useHydratedState(
    fetchedSchedule.data === undefined
      ? initialItems
      : Array.isArray(fetchedSchedule.data)
        ? fetchedSchedule.data
        : [],
    initialItems ?? [],
  )
  const [adding, setAdding] = useState(false)
  const budgetItems = budgetProp ?? fetchedBudget.data ?? []
  const checklistItems = checklistProp ?? fetchedChecklist.data ?? []
  const loading = !initialItems && fetchedSchedule.loading && items.length === 0

  useEffect(() => {
    if (!focusItemId) return
    const timer = window.setTimeout(() => {
      document
        .getElementById(`schedule-item-${focusItemId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusItemId])

  function commit(next: EventScheduleItem[]) {
    setItems(next)
    onItemsChange?.(next)
  }

  const days = useMemo(
    () => (itinerary ? composeItinerary(childrenEvents, items) : []),
    [itinerary, childrenEvents, items],
  )

  const sorted = [...items].sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime)
    if (a.startTime) return -1
    if (b.startTime) return 1
    return a.sortOrder - b.sortOrder
  })

  const empty = itinerary ? days.length === 0 : sorted.length === 0

  function renderBlock(item: EventScheduleItem, isLast: boolean) {
    return (
      <ScheduleRow
        key={item.id}
        item={item}
        isLast={isLast}
        focused={item.id === focusItemId}
        requireDate={itinerary}
        budgetItems={budgetItems}
        checklistItems={checklistItems}
        tCat={tCat}
        onUpdated={(next) => commit(items.map((row) => (row.id === next.id ? next : row)))}
        onDeleted={() => commit(items.filter((row) => row.id !== item.id))}
        eventId={eventId}
        onOpenLinkedItem={onOpenLinkedItem}
        onChecklistToggle={(taskId, isCompleted) => {
          const previous = checklistItems
          onChecklistChange?.(
            checklistItems.map((row) => (row.id === taskId ? { ...row, isCompleted } : row)),
          )
          void proxyClient
            .patch(`/events/${eventId}/checklist/${taskId}`, { isCompleted })
            .catch(() => onChecklistChange?.(previous))
        }}
      />
    )
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="text-muted hover:text-foreground -ml-1 rounded-md p-1"
              aria-label="Collapse"
            >
              <ChevronRight size={14} className="rotate-90" />
            </button>
          )}
          <Clock size={15} style={{ color: 'var(--color-brand-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Schedule
          </span>
          {items.length > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
              {items.length} {items.length === 1 ? 'block' : 'blocks'}
            </span>
          )}
        </div>
        {!adding && canEdit('SCHEDULE') && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
              color: 'var(--color-brand-primary)',
            }}
          >
            <Plus size={12} />
            Add block
          </button>
        )}
      </div>

      <div className="space-y-3 p-5">
        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : (
          <>
            {adding && (
              <ScheduleForm
                requireDate={itinerary}
                budgetItems={budgetItems}
                checklistItems={checklistItems}
                onCancel={() => setAdding(false)}
                onSave={async (payload) => {
                  const { data } = await proxyClient.post<EventScheduleItem>(
                    `/events/${eventId}/schedule`,
                    payload,
                  )
                  commit([...items, data])
                  await reloadMoodBoard()
                  setAdding(false)
                }}
              />
            )}

            {empty && !adding && (
              <div className="py-8 text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  No schedule yet
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {itinerary
                    ? 'Add dates and times for this event. Sub-events show up here on their own day.'
                    : 'Build the day timeline and link each block to budget lines, checklist tasks, or saved inspiration.'}
                </p>
              </div>
            )}

            {itinerary ? (
              <div className="space-y-6">
                {days.map((day) => (
                  <section key={day.date ?? 'undated'}>
                    <h3
                      className="mb-2 text-xs font-semibold tracking-wide uppercase"
                      style={{
                        color: day.date ? 'var(--color-text-primary)' : 'var(--color-muted)',
                      }}
                    >
                      {day.label}
                    </h3>
                    <ol className="relative space-y-0">
                      {day.rows.map((row, index) =>
                        row.kind === 'event' ? (
                          <ChildBeat
                            key={row.id}
                            child={row.child}
                            isLast={index === day.rows.length - 1}
                          />
                        ) : (
                          renderBlock(row.item, index === day.rows.length - 1)
                        ),
                      )}
                    </ol>
                  </section>
                ))}
              </div>
            ) : (
              <ol className="relative space-y-0">
                {sorted.map((item, index) => renderBlock(item, index === sorted.length - 1))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ChildBeat({ child, isLast }: { child: EventJourneyStop; isLast: boolean }) {
  const typeLabel = EVENT_TYPE_LABELS[child.eventType] ?? child.eventType
  return (
    <li className="relative flex gap-4 pb-5 last:pb-0">
      {!isLast && (
        <span
          className="absolute top-8 bottom-0 left-[15px] w-px"
          style={{ background: 'var(--color-border)' }}
        />
      )}
      <div
        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--color-brand-primary) 14%, transparent)',
          color: 'var(--color-brand-primary)',
          border: '1.5px solid var(--color-brand-primary)',
        }}
      >
        <Calendar size={12} />
      </div>
      <Link
        href={`/events/${child.id}`}
        aria-label={`Open ${child.title}`}
        className="min-w-0 flex-1 py-1.5 transition-opacity hover:opacity-80"
      >
        <p
          className="text-[11px] font-semibold tracking-wide uppercase"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          Event
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {child.title}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>
          {[formatEventDate(child.estimatedDate), typeLabel, child.location]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </Link>
    </li>
  )
}

const LINK_TONES = {
  budget: { color: '#2563eb', bg: 'color-mix(in srgb, #3b82f6 12%, transparent)' },
  checklist: { color: '#16a34a', bg: 'color-mix(in srgb, #22c55e 12%, transparent)' },
  inspiration: {
    color: 'var(--color-brand-primary)',
    bg: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
  },
} as const

function ScheduleRow({
  item,
  isLast,
  focused,
  budgetItems,
  checklistItems,
  tCat,
  eventId,
  onUpdated,
  onDeleted,
  onOpenLinkedItem,
  onChecklistToggle,
  requireDate,
}: {
  item: EventScheduleItem
  isLast: boolean
  focused?: boolean
  requireDate?: boolean
  budgetItems: EventBudgetItem[]
  checklistItems: EventChecklistItem[]
  tCat: (key: string) => string
  eventId: string
  onUpdated: (item: EventScheduleItem) => void
  onDeleted: () => void
  onOpenLinkedItem?: (kind: 'budget' | 'checklist' | 'moodboard', id: string) => void
  onChecklistToggle?: (taskId: string, isCompleted: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(!!focused)
  if (focused && !expanded) setExpanded(true)
  const [deleting, startDelete] = useTransition()
  const { entriesByScheduleId, reload: reloadMoodBoard } = useMoodBoardLinks()
  const { canEdit } = useEventAccess()
  const linkedInspirations = entriesByScheduleId.get(item.id) ?? []
  const budgets = item.budgetItems ?? []
  const tasks = item.checklistItems ?? []
  const hasLinks = budgets.length > 0 || tasks.length > 0 || linkedInspirations.length > 0

  function isDone(task: { id: string; isCompleted?: boolean }) {
    return (
      checklistItems.find((row) => row.id === task.id)?.isCompleted ?? task.isCompleted ?? false
    )
  }

  const checklistDone = tasks.filter(isDone).length

  if (editing) {
    return (
      <li className="pb-4">
        <ScheduleForm
          initial={item}
          requireDate={requireDate}
          budgetItems={budgetItems}
          checklistItems={checklistItems}
          onCancel={() => setEditing(false)}
          onSave={async (payload) => {
            const { data } = await proxyClient.patch<EventScheduleItem>(
              `/events/${eventId}/schedule/${item.id}`,
              payload,
            )
            onUpdated(data)
            await reloadMoodBoard()
            setEditing(false)
          }}
        />
      </li>
    )
  }

  const start = formatTime(item.startTime)
  const end = formatTime(item.endTime)

  return (
    <li id={`schedule-item-${item.id}`} className="relative flex gap-4 pb-5 last:pb-0">
      {!isLast && (
        <span
          className="absolute top-8 bottom-0 left-[15px] w-px"
          style={{ background: 'var(--color-border)' }}
        />
      )}
      <div
        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{
          background: 'color-mix(in srgb, var(--color-brand-primary) 14%, transparent)',
          color: 'var(--color-brand-primary)',
        }}
      >
        <Clock size={12} />
      </div>
      <div
        className="min-w-0 flex-1 rounded-xl transition-colors"
        style={{
          background: expanded
            ? 'color-mix(in srgb, var(--color-text-primary) 3%, transparent)'
            : undefined,
          outline: focused ? '1px solid var(--color-brand-primary)' : undefined,
        }}
      >
        <div className="flex items-start gap-1">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left hover:opacity-90"
          >
            <div className="flex items-start gap-2">
              <ChevronRight
                size={14}
                className={cn(
                  'text-muted mt-0.5 shrink-0 transition-transform',
                  expanded && 'rotate-90',
                )}
              />
              <div className="min-w-0 flex-1">
                {(start || end) && (
                  <p
                    className="text-[11px] font-medium tabular-nums"
                    style={{ color: 'var(--color-brand-primary)' }}
                  >
                    {start ?? '—'}
                    {end ? ` – ${end}` : ''}
                  </p>
                )}
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {item.title}
                </p>
                {item.location && (
                  <p
                    className="mt-0.5 flex items-center gap-1 text-xs"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <MapPin size={10} />
                    {item.location}
                  </p>
                )}
                {!expanded && hasLinks && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {budgets.length > 0 && (
                      <TypeCount
                        tone="budget"
                        icon={<DollarSign size={9} />}
                        label="Budget"
                        count={budgets.length}
                      />
                    )}
                    {tasks.length > 0 && (
                      <TypeCount
                        tone="checklist"
                        icon={
                          checklistDone === tasks.length ? (
                            <CheckCircle2 size={9} />
                          ) : (
                            <ListTodo size={9} />
                          )
                        }
                        label={`${checklistDone}/${tasks.length} Checklist`}
                      />
                    )}
                    {linkedInspirations.length > 0 && (
                      <TypeCount
                        tone="inspiration"
                        icon={<Sparkles size={9} />}
                        label="Inspiration"
                        count={linkedInspirations.length}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1 pt-1 pr-1">
            {canEdit('SCHEDULE') && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg p-1.5 hover:opacity-70"
                  style={{ color: 'var(--color-muted)' }}
                  aria-label="Edit block"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    startDelete(async () => {
                      await proxyClient.delete(`/events/${eventId}/schedule/${item.id}`)
                      onDeleted()
                    })
                  }}
                  className="rounded-lg p-1.5 hover:opacity-70 disabled:opacity-40"
                  style={{ color: 'var(--color-muted)' }}
                  aria-label="Delete block"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </>
            )}
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 pr-2 pb-3 pl-8">
            {item.notes && (
              <CollapsibleGroup
                label="Notes"
                icon={<FileText size={11} />}
                color="var(--color-muted)"
              >
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                  {item.notes}
                </p>
              </CollapsibleGroup>
            )}
            {!hasLinks && !item.notes && (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Nothing linked yet. Edit this block to add budget, checklist, or inspiration.
              </p>
            )}
            {budgets.length > 0 && (
              <LinkedGroup
                label="Budget"
                icon={<DollarSign size={11} />}
                tone="budget"
                count={budgets.length}
              >
                {budgets.map((budget) => (
                  <li key={budget.id}>
                    <button
                      type="button"
                      onClick={() => onOpenLinkedItem?.('budget', budget.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-opacity hover:opacity-80"
                      style={{
                        background: LINK_TONES.budget.bg,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <span className="min-w-0 truncate">
                        {budget.label ||
                          budget.vendorName ||
                          getVendorCategoryLabel(budget.category, tCat)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span
                          className="font-medium tabular-nums"
                          style={{ color: LINK_TONES.budget.color }}
                        >
                          CA${budget.allocatedAmount.toLocaleString('en-CA')}
                        </span>
                        <ChevronRight size={12} style={{ color: LINK_TONES.budget.color }} />
                      </span>
                    </button>
                  </li>
                ))}
              </LinkedGroup>
            )}
            {tasks.length > 0 && (
              <LinkedGroup
                label="Checklist"
                icon={<ListTodo size={11} />}
                tone="checklist"
                count={tasks.length}
              >
                {tasks.map((task) => {
                  const done = isDone(task)
                  return (
                    <li key={task.id}>
                      <div
                        className="flex items-center gap-0.5 rounded-lg"
                        style={{ background: LINK_TONES.checklist.bg }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            canEdit('CHECKLIST') && onChecklistToggle?.(task.id, !done)
                          }
                          className="shrink-0 rounded-lg p-1.5 hover:opacity-80"
                          style={{ color: LINK_TONES.checklist.color }}
                          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenLinkedItem?.('checklist', task.id)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 pr-2.5 text-left text-xs transition-opacity hover:opacity-80"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <span
                            className={`min-w-0 truncate ${done ? 'line-through opacity-55' : ''}`}
                          >
                            {task.title}
                          </span>
                          <ChevronRight
                            size={12}
                            className="shrink-0"
                            style={{ color: LINK_TONES.checklist.color }}
                          />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </LinkedGroup>
            )}
            {linkedInspirations.length > 0 && (
              <LinkedGroup
                label="Inspiration"
                icon={<Sparkles size={11} />}
                tone="inspiration"
                count={linkedInspirations.length}
              >
                {linkedInspirations.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onOpenLinkedItem?.('moodboard', entry.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-opacity hover:opacity-80"
                      style={{
                        background: LINK_TONES.inspiration.bg,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {entry.inspirationItem.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.inspirationItem.imageUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                          style={{
                            background:
                              'color-mix(in srgb, var(--color-brand-primary) 18%, transparent)',
                          }}
                        >
                          <Sparkles size={12} style={{ color: LINK_TONES.inspiration.color }} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{entry.inspirationItem.title}</span>
                      <ChevronRight
                        size={12}
                        className="shrink-0"
                        style={{ color: LINK_TONES.inspiration.color }}
                      />
                    </button>
                  </li>
                ))}
              </LinkedGroup>
            )}
            <EventItemComments subjectType="SCHEDULE_ITEM" subjectId={item.id} />
          </div>
        )}
      </div>
    </li>
  )
}

function TypeCount({
  tone,
  icon,
  label,
  count,
}: {
  tone: keyof typeof LINK_TONES
  icon: ReactNode
  label: string
  count?: number
}) {
  const { color, bg } = LINK_TONES[tone]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: bg, color }}
    >
      {icon}
      {count != null ? `${count} ${label}` : label}
    </span>
  )
}

function CollapsibleGroup({
  label,
  icon,
  color,
  count,
  children,
}: {
  label: string
  icon: ReactNode
  color: string
  count?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-1.5 flex w-full items-center gap-1.5 rounded-md text-left hover:opacity-80"
      >
        <ChevronRight
          size={14}
          className={cn('shrink-0 transition-transform duration-150', open && 'rotate-90')}
          style={{ color }}
        />
        <span className="shrink-0" style={{ color }}>
          {icon}
        </span>
        <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color }}>
          {label}
          {count != null ? ` · ${count}` : ''}
        </span>
      </button>
      {open && children}
    </div>
  )
}

function LinkedGroup({
  label,
  icon,
  tone,
  count,
  children,
}: {
  label: string
  icon: ReactNode
  tone: keyof typeof LINK_TONES
  count?: number
  children: ReactNode
}) {
  const { color } = LINK_TONES[tone]
  return (
    <CollapsibleGroup label={label} icon={icon} color={color} count={count}>
      <ul className="space-y-1">{children}</ul>
    </CollapsibleGroup>
  )
}

function ScheduleForm({
  initial,
  requireDate,
  budgetItems,
  checklistItems,
  onCancel,
  onSave,
}: {
  initial?: EventScheduleItem
  requireDate?: boolean
  budgetItems: EventBudgetItem[]
  checklistItems: EventChecklistItem[]
  onCancel: () => void
  onSave: (payload: {
    title: string
    date?: string | null
    startTime: string | null
    endTime: string | null
    location: string | null
    notes: string | null
    budgetItemIds: string[]
    checklistItemIds: string[]
    inspirationItemIds: string[]
  }) => Promise<void>
}) {
  const tCat = useTranslations('vendorCategories')
  const { entries, loading: moodBoardLoading } = useMoodBoardLinks()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [startTime, setStartTime] = useState(initial?.startTime ?? '')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [budgetItemIds, setBudgetItemIds] = useState(
    () => initial?.budgetItems?.map((item) => item.id) ?? [],
  )
  const [checklistItemIds, setChecklistItemIds] = useState(
    () => initial?.checklistItems?.map((item) => item.id) ?? [],
  )
  const [inspirationItemIds, setInspirationItemIds] = useState<string[]>([])
  const [inspirationsReady, setInspirationsReady] = useState(!initial)
  const hydratedInspirations = useRef(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!initial || hydratedInspirations.current || moodBoardLoading) return
    setInspirationItemIds(
      entries
        .filter((entry) => (entry.scheduleItems ?? []).some((block) => block.id === initial.id))
        .map((entry) => entry.inspirationItem.id),
    )
    hydratedInspirations.current = true
    setInspirationsReady(true)
  }, [initial, entries, moodBoardLoading])

  function toggleId(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
  }

  function submit() {
    if (title.trim().length < 2) {
      setError('Give this block a name')
      return
    }
    if (requireDate && !date) {
      setError('Pick a date')
      return
    }
    startTransition(async () => {
      setError('')
      try {
        await onSave({
          title: title.trim(),
          ...(requireDate ? { date } : {}),
          startTime: startTime || null,
          endTime: endTime || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
          budgetItemIds,
          checklistItemIds,
          inspirationItemIds,
        })
      } catch {
        setError('Could not save this block.')
      }
    })
  }

  return (
    <div
      className="space-y-3 rounded-xl p-4"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Ceremony, Getting ready, Reception"
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={fieldStyle}
      />
      {requireDate && (
        <label className="block text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={fieldStyle}
          />
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Starts
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={fieldStyle}
          />
        </label>
        <label className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Ends
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={fieldStyle}
          />
        </label>
      </div>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={fieldStyle}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className="w-full resize-none rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={fieldStyle}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LinkPicker
          label="Budget lines"
          empty="No budget lines yet"
          selectedCount={budgetItemIds.length}
          items={budgetItems.map((item) => ({
            id: item.id,
            label: budgetLabel(item, tCat),
          }))}
          selectedIds={budgetItemIds}
          onToggle={(id) => setBudgetItemIds((prev) => toggleId(prev, id))}
          icon={<DollarSign size={10} />}
        />
        <LinkPicker
          label="Checklist tasks"
          empty="No checklist tasks yet"
          selectedCount={checklistItemIds.length}
          items={checklistItems.map((item) => ({
            id: item.id,
            label: item.title,
          }))}
          selectedIds={checklistItemIds}
          onToggle={(id) => setChecklistItemIds((prev) => toggleId(prev, id))}
          icon={<ListTodo size={10} />}
        />
      </div>
      <LinkPicker
        label="Saved inspiration"
        empty={
          moodBoardLoading ? 'Loading saved inspiration…' : 'Save ideas from Inspiration first'
        }
        selectedCount={inspirationItemIds.length}
        items={
          moodBoardLoading
            ? []
            : entries.map((entry) => ({
                id: entry.inspirationItem.id,
                label: entry.inspirationItem.title,
              }))
        }
        selectedIds={inspirationItemIds}
        onToggle={(id) => setInspirationItemIds((prev) => toggleId(prev, id))}
        icon={<Sparkles size={10} />}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs"
          style={{ color: 'var(--color-muted)' }}
        >
          <X size={12} /> Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || (Boolean(initial) && !inspirationsReady)}
          className="bg-gold-600 text-brand-900 hover:bg-gold-500 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
      </div>
    </div>
  )
}

function LinkPicker({
  label,
  empty,
  items,
  selectedIds,
  selectedCount,
  onToggle,
  icon,
}: {
  label: string
  empty: string
  items: { id: string; label: string }[]
  selectedIds: string[]
  selectedCount: number
  onToggle: (id: string) => void
  icon: ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
        {label}
        {selectedCount > 0 && <span className="ml-1 font-normal">({selectedCount})</span>}
      </p>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {empty}
        </p>
      ) : (
        <div
          className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-lg p-1.5"
          style={{ border: '1px solid var(--color-border)' }}
        >
          {items.map((item) => {
            const selected = selectedIds.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                aria-pressed={selected}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
                style={
                  selected
                    ? {
                        background:
                          'color-mix(in srgb, var(--color-brand-primary) 16%, transparent)',
                        color: 'var(--color-brand-primary)',
                        border: '1px solid var(--color-brand-primary)',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                      }
                }
              >
                {icon}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
