'use client'

import { useState, useTransition, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  Trash2,
  CalendarDays,
  X,
  Mail,
  MessageSquare,
  Pencil,
  Check,
  Plus,
  ChevronDown,
  ChevronRight,
  Store,
  ChevronUp,
  Search,
  Star,
  BadgeCheck,
  BookUser,
  Loader2,
  Phone,
  Globe,
  ExternalLink,
  FileText,
  AlarmClock,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import { useLazyGet } from '@/lib/use-lazy-get'
import { TableSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { VENDOR_CATEGORY_KEYS, getVendorCategoryLabel } from '@/lib/vendor-categories'
import type { EventChecklistItem, EventChecklistVendor, UserVendorContact } from '@/lib/api.types'
import { useMoodBoardLinks } from './mood-board-context'
import { useEventAccess } from './event-access-context'
import { EventItemComments } from './event-item-comments'

interface Props {
  eventId: string
  initialItems?: EventChecklistItem[]
  focusItemId?: string
  onItemsChange?: (items: EventChecklistItem[]) => void
  onCollapse?: () => void
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey =
  | 'default'
  | 'due-asc'
  | 'due-desc'
  | 'assignee-asc'
  | 'assignee-desc'
  | 'todo-first'
  | 'done-first'
  | 'overdue-first'
  | 'alpha'
type FilterKey = 'all' | 'todo' | 'done' | 'overdue' | 'has-date' | 'mine'
type GroupKey = 'none' | 'due' | 'person'

type VendorDraft = {
  name: string
  vendorProfileId: string | null
  userVendorContactId: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string | null, done: boolean) {
  if (!dateStr || done) return false
  return new Date(dateStr) < new Date(new Date().toDateString())
}

function isDueSoon(dateStr: string | null, done: boolean) {
  if (!dateStr || done) return false
  const diff =
    (new Date(dateStr).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000
  return diff >= 0 && diff <= 7
}

function applySortFilter(
  items: EventChecklistItem[],
  sort: SortKey,
  filter: FilterKey,
  myUserId?: string | null,
) {
  let r = [...items]
  if (filter === 'todo') r = r.filter((i) => !i.isCompleted)
  if (filter === 'done') r = r.filter((i) => i.isCompleted)
  if (filter === 'overdue') r = r.filter((i) => isOverdue(i.dueDate, i.isCompleted))
  if (filter === 'has-date') r = r.filter((i) => !!i.dueDate)
  if (filter === 'mine') r = r.filter((i) => i.assigneeUserId && i.assigneeUserId === myUserId)

  if (sort === 'due-asc')
    r.sort((a, b) =>
      !a.dueDate
        ? 1
        : !b.dueDate
          ? -1
          : new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )
  else if (sort === 'due-desc')
    r.sort((a, b) =>
      !a.dueDate
        ? 1
        : !b.dueDate
          ? -1
          : new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    )
  else if (sort === 'overdue-first')
    r.sort(
      (a, b) =>
        Number(isOverdue(b.dueDate, b.isCompleted)) - Number(isOverdue(a.dueDate, a.isCompleted)),
    )
  else if (sort === 'todo-first') r.sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
  else if (sort === 'done-first') r.sort((a, b) => Number(b.isCompleted) - Number(a.isCompleted))
  else if (sort === 'alpha') r.sort((a, b) => a.title.localeCompare(b.title))
  else if (sort === 'assignee-asc' || sort === 'assignee-desc') {
    r.sort((a, b) => {
      const an = a.assignee ? personName(a.assignee) : ''
      const bn = b.assignee ? personName(b.assignee) : ''
      if (!an && bn) return 1
      if (an && !bn) return -1
      const cmp = an.localeCompare(bn)
      return sort === 'assignee-desc' ? -cmp : cmp
    })
  } else r.sort((a, b) => a.sortOrder - b.sortOrder)

  return r
}

function dueBucket(item: EventChecklistItem): 'overdue' | 'this-week' | 'later' | 'none' | 'done' {
  if (item.isCompleted) return 'done'
  if (!item.dueDate) return 'none'
  if (isOverdue(item.dueDate, item.isCompleted)) return 'overdue'
  if (isDueSoon(item.dueDate, item.isCompleted)) return 'this-week'
  return 'later'
}

function groupItems(
  items: EventChecklistItem[],
  group: GroupKey,
  labels: {
    overdue: string
    thisWeek: string
    later: string
    noDate: string
    done: string
    unassigned: string
  },
): { key: string; label: string | null; items: EventChecklistItem[] }[] {
  if (group === 'none') return [{ key: 'all', label: null, items }]

  if (group === 'due') {
    const order = ['overdue', 'this-week', 'later', 'none', 'done'] as const
    const names = {
      overdue: labels.overdue,
      'this-week': labels.thisWeek,
      later: labels.later,
      none: labels.noDate,
      done: labels.done,
    }
    return order
      .map((key) => ({
        key,
        label: names[key],
        items: items.filter((item) => dueBucket(item) === key),
      }))
      .filter((section) => section.items.length > 0)
  }

  const map = new Map<string, { label: string; items: EventChecklistItem[] }>()
  for (const item of items) {
    const key = item.assigneeUserId || 'unassigned'
    const label = item.assignee ? personName(item.assignee) : labels.unassigned
    const bucket = map.get(key)
    if (bucket) bucket.items.push(item)
    else map.set(key, { label, items: [item] })
  }
  return [...map.entries()]
    .sort(([aKey, a], [bKey, b]) => {
      if (aKey === 'unassigned') return 1
      if (bKey === 'unassigned') return -1
      return a.label.localeCompare(b.label)
    })
    .map(([key, section]) => ({ key, label: section.label, items: section.items }))
}

function vendorDrafts(item: EventChecklistItem): VendorDraft[] {
  if (item.vendors && item.vendors.length > 0) {
    return item.vendors
      .map(vendorToDraft)
      .filter((row) => row.name || row.vendorProfileId || row.userVendorContactId)
  }
  const name = item.vendorProfile?.businessName ?? item.userVendorContact?.name ?? ''
  if (!name && !item.vendorProfileId && !item.userVendorContactId) return []
  return [
    {
      name,
      vendorProfileId: item.vendorProfileId,
      userVendorContactId: item.userVendorContactId,
    },
  ]
}

function vendorToDraft(vendor: EventChecklistVendor): VendorDraft {
  return {
    name: vendor.vendorProfile?.businessName ?? vendor.userVendorContact?.name ?? vendor.name ?? '',
    vendorProfileId: vendor.vendorProfileId,
    userVendorContactId: vendor.userVendorContactId,
  }
}

function vendorPayload(needsVendor: boolean, vendors: VendorDraft[]) {
  if (!needsVendor) {
    return {
      vendors: [] as {
        vendorProfileId: string | null
        userVendorContactId: string | null
        name: string | null
      }[],
    }
  }
  return {
    vendors: vendors
      .filter((row) => row.vendorProfileId || row.userVendorContactId || row.name.trim())
      .map((row) => ({
        vendorProfileId: row.vendorProfileId,
        userVendorContactId: row.userVendorContactId,
        name: row.name.trim() || null,
      })),
  }
}

function vendorDisplayName(vendor: EventChecklistVendor | VendorDraft) {
  if ('vendorProfile' in vendor) {
    return vendor.vendorProfile?.businessName ?? vendor.userVendorContact?.name ?? vendor.name ?? ''
  }
  return vendor.name
}

function vendorCellLabel(item: EventChecklistItem, tCat: (key: string) => string): string {
  const names = vendorDrafts(item)
    .map((row) => row.name)
    .filter(Boolean)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]}, ${names[1]}`
  if (names.length > 2) return `${names[0]} +${names.length - 1}`
  if (item.needsVendor && item.vendorCategory && item.vendorCategory !== 'OTHER') {
    return getVendorCategoryLabel(item.vendorCategory, tCat)
  }
  if (item.needsVendor) return 'Needed'
  return '—'
}

// ─── Linked Inspirations mini-section ────────────────────────────────────────

function LinkedInspirations({ checklistItemId }: { checklistItemId: string }) {
  const { loading, entriesByChecklistId } = useMoodBoardLinks()
  const items = entriesByChecklistId.get(checklistItemId) ?? []

  if (loading) return null
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      <p className="text-muted flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
        <Sparkles size={10} /> Saved Inspiration ({items.length})
      </p>
      <div className="space-y-1.5">
        {items.map(({ id, inspirationItem: insp }) => (
          <div
            key={id}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              {insp.imageUrl ? (
                <img src={insp.imageUrl} alt={insp.title} className="h-full w-full object-cover" />
              ) : (
                <Sparkles size={12} className="text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-xs font-medium">{insp.title}</p>
              <p className="text-muted text-[10px]">
                {insp.category.charAt(0) + insp.category.slice(1).toLowerCase()}
              </p>
            </div>
            <Link
              href="/inspiration"
              className="text-muted hover:text-foreground transition-colors"
              title="View in inspiration"
            >
              <ExternalLink size={11} />
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

type AssignablePerson = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || 'Someone'
}

function useAssignablePeople(eventId: string) {
  const [people, setPeople] = useState<AssignablePerson[]>([])
  useEffect(() => {
    proxyClient
      .get<AssignablePerson[]>(`/events/${eventId}/members/mentionable`, {
        params: { surface: 'CHECKLIST', includeSelf: true },
      })
      .then(({ data }) => setPeople(Array.isArray(data) ? data : []))
      .catch(() => setPeople([]))
  }, [eventId])
  return people
}

function AssigneeSelect({
  value,
  onChange,
  people,
}: {
  value: string
  onChange: (id: string) => void
  people: AssignablePerson[]
}) {
  return (
    <div className="flex items-center gap-2">
      <UserRound size={11} className="text-muted shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Assign to"
        className="text-foreground border-border bg-background w-full border-b py-1 text-xs focus:outline-none"
      >
        <option value="">Unassigned</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {personName(person)}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Item Detail Drawer ───────────────────────────────────────────────────────

function ItemDrawer({
  item,
  eventId,
  onClose,
  onSaved,
  onToggle,
}: {
  item: EventChecklistItem
  eventId: string
  onClose: () => void
  onSaved: (updated: EventChecklistItem) => void
  onToggle: () => void
}) {
  const tCat = useTranslations('vendorCategories')
  const { canEdit } = useEventAccess()
  const people = useAssignablePeople(eventId)
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)

  // ── Edit state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState(item.title)
  const [dueDate, setDueDate] = useState(
    item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : '',
  )
  const [notifyEmail, setNotifyEmail] = useState(item.notifyByEmail)
  const [notifySms, setNotifySms] = useState(item.notifyBySms)
  const [needsVendor, setNeedsVendor] = useState(item.needsVendor ?? false)
  const [vendorCategory, setVendorCategory] = useState(item.vendorCategory ?? '')
  const [vendors, setVendors] = useState<VendorDraft[]>(() => vendorDrafts(item))
  const [assigneeUserId, setAssigneeUserId] = useState(item.assigneeUserId ?? '')

  // ── Derived view values ──────────────────────────────────────────────────
  const [liveItem, setLiveItem] = useState(item)
  const liveVendors = liveItem.vendors?.length ? liveItem.vendors : vendorDrafts(liveItem)

  // Reset edit state from latest item when entering edit mode
  const enterEdit = useCallback(() => {
    setTitle(liveItem.title)
    setDueDate(liveItem.dueDate ? new Date(liveItem.dueDate).toISOString().split('T')[0] : '')
    setNotifyEmail(liveItem.notifyByEmail)
    setNotifySms(liveItem.notifyBySms)
    setNeedsVendor(liveItem.needsVendor ?? false)
    setVendorCategory(liveItem.vendorCategory ?? '')
    setVendors(vendorDrafts(liveItem))
    setAssigneeUserId(liveItem.assigneeUserId ?? '')
    setIsEditing(true)
  }, [liveItem])

  async function save() {
    if (!canEdit('CHECKLIST')) return
    const t = title.trim()
    if (!t) return
    try {
      const { data: updated } = await proxyClient.patch<EventChecklistItem>(
        `/events/${eventId}/checklist/${liveItem.id}`,
        {
          title: t,
          dueDate: dueDate || null,
          notifyByEmail: notifyEmail,
          notifyBySms: notifySms,
          needsVendor,
          vendorCategory: needsVendor ? vendorCategory || null : null,
          ...vendorPayload(needsVendor, vendors),
          assigneeUserId: assigneeUserId || null,
        },
      )
      setLiveItem(updated)
      onSaved(updated)
      setIsEditing(false)
    } catch {
      // Keep the editor open so the user can retry.
    }
  }

  // close on Escape — in edit mode Escape cancels edit, otherwise closes drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) setIsEditing(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isEditing, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="overlay fixed inset-0 z-40 backdrop-blur-[2px]"
        onClick={() => {
          if (isEditing) setIsEditing(false)
          else onClose()
        }}
      />

      {/* Drawer panel */}
      <div className="sheet animate-in slide-in-from-bottom md:slide-in-from-right fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col border-t shadow-2xl duration-200 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:max-h-none md:w-[380px] md:border-t-0 md:border-l">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="border-border flex items-start gap-3 border-b px-5 pt-5 pb-4">
          {!isEditing &&
            (canEdit('CHECKLIST') ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle()
                  setLiveItem((prev) => ({ ...prev, isCompleted: !prev.isCompleted }))
                }}
                className="text-muted hover:text-foreground mt-0.5 shrink-0 transition-colors"
                aria-label={liveItem.isCompleted ? 'Mark incomplete' : 'Mark complete'}
              >
                {liveItem.isCompleted ? (
                  <CheckCircle2 size={18} className="text-foreground" />
                ) : (
                  <Circle size={18} />
                )}
              </button>
            ) : (
              <span className="text-muted mt-0.5 shrink-0" aria-hidden>
                {liveItem.isCompleted ? (
                  <CheckCircle2 size={18} className="text-foreground" />
                ) : (
                  <Circle size={18} />
                )}
              </span>
            ))}
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    startTransition(save)
                  }
                }}
                className="placeholder:text-muted border-gold-500/30 focus:border-gold-500/60 text-foreground w-full border-b bg-transparent pb-1 text-sm font-medium transition-colors focus:outline-none"
                placeholder="Task title"
              />
            ) : (
              <>
                <p
                  className={cn(
                    'text-sm leading-snug font-medium',
                    liveItem.isCompleted ? 'text-muted line-through' : 'text-foreground',
                  )}
                >
                  {liveItem.title}
                </p>
                {liveItem.isCompleted && <p className="text-muted mt-0.5 text-[10px]">Completed</p>}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={() => startTransition(save)}
                  disabled={!title.trim() || isPending}
                  className="bg-gold-600/15 border-gold-500/25 text-foreground hover:bg-gold-600/25 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-40"
                >
                  <Check size={11} /> {isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="icon-btn"
                  aria-label="Cancel edit"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                {canEdit('CHECKLIST') && (
                  <button onClick={enterEdit} className="icon-btn" aria-label="Edit task">
                    <Pencil size={13} />
                  </button>
                )}
                <button onClick={onClose} className="icon-btn" aria-label="Close">
                  <X size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isEditing ? (
            /* ── Edit form ──────────────────────────────────────────────── */
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-muted text-[10px] font-semibold tracking-wider uppercase">
                  Assigned to
                </p>
                <AssigneeSelect
                  value={assigneeUserId}
                  onChange={setAssigneeUserId}
                  people={people}
                />
              </div>

              {/* Due date */}
              <div className="space-y-1">
                <p className="text-muted text-[10px] font-semibold tracking-wider uppercase">
                  Due date
                </p>
                <div className="flex items-center gap-2">
                  <CalendarDays size={13} className="text-muted shrink-0" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="text-foreground focus:border-gold-500/30 border-border flex-1 border-b bg-transparent pb-0.5 text-sm transition-colors focus:outline-none"
                  />
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueDate('')
                        setNotifyEmail(false)
                        setNotifySms(false)
                      }}
                      className="text-muted transition-colors hover:text-red-400"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Reminders */}
              {dueDate && (
                <div className="space-y-1">
                  <p className="text-muted text-[10px] font-semibold tracking-wider uppercase">
                    Remind via
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNotifyEmail((v) => !v)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all',
                        notifyEmail
                          ? 'bg-foreground/10 border-border text-foreground'
                          : 'text-muted hover:text-foreground border-border hover:border-border',
                      )}
                    >
                      <Mail size={11} /> Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifySms((v) => !v)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all',
                        notifySms
                          ? 'bg-foreground/10 border-border text-foreground'
                          : 'text-muted hover:text-foreground border-border hover:border-border',
                      )}
                    >
                      <MessageSquare size={11} /> SMS
                    </button>
                  </div>
                </div>
              )}

              {/* Vendor */}
              <VendorSection
                needsVendor={needsVendor}
                vendorCategory={vendorCategory}
                vendors={vendors}
                onToggle={() => {
                  const next = !needsVendor
                  setNeedsVendor(next)
                  if (!next) {
                    setVendorCategory('')
                    setVendors([])
                  }
                }}
                onCategoryChange={(cat) => {
                  setVendorCategory(cat)
                  setVendors([])
                }}
                onVendorsChange={setVendors}
              />
            </div>
          ) : (
            /* ── View mode ──────────────────────────────────────────────── */
            <>
              {liveItem.assignee && (
                <section className="space-y-2">
                  <p className="text-muted text-[10px] font-semibold tracking-wider uppercase">
                    Assigned to
                  </p>
                  <div className="flex items-center gap-2.5">
                    <UserRound size={13} className="text-muted shrink-0" />
                    <span className="text-foreground text-sm">{personName(liveItem.assignee)}</span>
                  </div>
                </section>
              )}

              {/* Due date & reminders */}
              {(liveItem.dueDate || liveItem.notifyByEmail || liveItem.notifyBySms) && (
                <section className="space-y-2">
                  <p className="text-muted text-[10px] font-semibold tracking-wider uppercase">
                    Schedule
                  </p>
                  {liveItem.dueDate && (
                    <div className="flex items-center gap-2.5">
                      <CalendarDays
                        size={13}
                        className={cn(
                          'shrink-0',
                          isOverdue(liveItem.dueDate, liveItem.isCompleted)
                            ? 'text-red-400'
                            : isDueSoon(liveItem.dueDate, liveItem.isCompleted)
                              ? 'text-amber-400'
                              : 'text-muted',
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm',
                          isOverdue(liveItem.dueDate, liveItem.isCompleted)
                            ? 'text-red-300'
                            : isDueSoon(liveItem.dueDate, liveItem.isCompleted)
                              ? 'text-amber-300'
                              : 'text-foreground',
                        )}
                      >
                        {isOverdue(liveItem.dueDate, liveItem.isCompleted) && (
                          <span className="font-medium">Overdue · </span>
                        )}
                        {new Date(liveItem.dueDate).toLocaleDateString('en-CA', {
                          weekday: 'short',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {(liveItem.notifyByEmail || liveItem.notifyBySms) && (
                    <div className="flex items-center gap-2.5">
                      <AlarmClock size={13} className="text-muted shrink-0" />
                      <div className="flex items-center gap-1.5">
                        {liveItem.notifyByEmail && (
                          <span className="text-muted inline-flex items-center gap-1 text-xs">
                            <Mail size={10} /> Email reminder
                          </span>
                        )}
                        {liveItem.notifyByEmail && liveItem.notifyBySms && (
                          <span className="text-muted text-xs">·</span>
                        )}
                        {liveItem.notifyBySms && (
                          <span className="text-muted inline-flex items-center gap-1 text-xs">
                            <MessageSquare size={10} /> SMS reminder
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Vendor / service info */}
              {liveItem.needsVendor && (
                <section className="space-y-3">
                  <p className="text-muted text-[10px] font-semibold tracking-wider uppercase">
                    Vendor / Service
                  </p>

                  {liveItem.vendorCategory && (
                    <div className="flex items-center gap-2">
                      <Store size={12} className="text-muted shrink-0" />
                      <span className="text-muted text-xs">
                        {getVendorCategoryLabel(liveItem.vendorCategory, tCat)}
                      </span>
                    </div>
                  )}

                  {liveVendors.length > 0 && (
                    <div className="space-y-2">
                      {liveVendors.map((vendor, index) => {
                        const contact =
                          'userVendorContact' in vendor ? vendor.userVendorContact : null
                        const profile = 'vendorProfile' in vendor ? vendor.vendorProfile : null
                        const isContact = !!vendor.userVendorContactId || !!contact
                        const isRegistered = !!vendor.vendorProfileId || !!profile
                        const name = vendorDisplayName(vendor)
                        return (
                          <div
                            key={
                              'id' in vendor && vendor.id
                                ? vendor.id
                                : `${vendor.vendorProfileId ?? vendor.userVendorContactId ?? name}-${index}`
                            }
                            className="border-gold-500/20 bg-gold-500/5 space-y-2.5 rounded-xl border p-3"
                          >
                            <div className="flex items-start gap-2">
                              <div className="bg-gold-500/10 border-gold-500/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                                {isContact ? (
                                  <BookUser size={14} className="text-foreground" />
                                ) : (
                                  <Store size={14} className="text-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-foreground truncate text-sm font-medium">
                                    {name || 'Vendor'}
                                  </p>
                                  {isRegistered && profile?.isVerified && (
                                    <BadgeCheck size={12} className="text-foreground shrink-0" />
                                  )}
                                </div>
                                <p className="text-muted mt-0.5 text-[10px]">
                                  {isRegistered
                                    ? 'Registered vendor'
                                    : isContact
                                      ? 'Saved contact'
                                      : 'Custom vendor'}
                                </p>
                              </div>
                              {isRegistered && profile?.slug && (
                                <Link
                                  href={`/vendors/${profile.slug}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted hover:text-foreground hover:bg-foreground/5 shrink-0 rounded-lg p-1.5 transition-colors"
                                  aria-label="View vendor profile"
                                >
                                  <ExternalLink size={12} />
                                </Link>
                              )}
                            </div>

                            {isContact && contact && (
                              <div className="border-border space-y-1.5 border-t pt-1">
                                {contact.email && (
                                  <a
                                    href={`mailto:${contact.email}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted hover:text-foreground group flex items-center gap-2 text-xs transition-colors"
                                  >
                                    <Mail
                                      size={11}
                                      className="text-muted group-hover:text-foreground shrink-0"
                                    />
                                    {contact.email}
                                  </a>
                                )}
                                {contact.phone && (
                                  <a
                                    href={`tel:${contact.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted hover:text-foreground group flex items-center gap-2 text-xs transition-colors"
                                  >
                                    <Phone
                                      size={11}
                                      className="text-muted group-hover:text-foreground shrink-0"
                                    />
                                    {contact.phone}
                                  </a>
                                )}
                                {contact.website && (
                                  <a
                                    href={contact.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted hover:text-foreground group flex items-center gap-2 truncate text-xs transition-colors"
                                  >
                                    <Globe
                                      size={11}
                                      className="text-muted group-hover:text-foreground shrink-0"
                                    />
                                    {contact.website}
                                  </a>
                                )}
                                {contact.notes && (
                                  <div className="text-muted flex items-start gap-2 text-xs">
                                    <FileText size={11} className="text-muted mt-0.5 shrink-0" />
                                    <p className="leading-relaxed">{contact.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {liveVendors.length === 0 &&
                    liveItem.vendorCategory &&
                    liveItem.vendorCategory !== 'OTHER' && (
                      <Link
                        href={`/vendors?category=${liveItem.vendorCategory}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted hover:text-foreground flex items-center gap-2 text-xs transition-colors"
                      >
                        <Search size={11} />
                        Browse {getVendorCategoryLabel(liveItem.vendorCategory, tCat)} →
                      </Link>
                    )}
                </section>
              )}

              {!liveItem.dueDate &&
                !liveItem.notifyByEmail &&
                !liveItem.notifyBySms &&
                !liveItem.needsVendor && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-muted text-xs">No additional details yet.</p>
                    {canEdit('CHECKLIST') && (
                      <button
                        onClick={enterEdit}
                        className="text-muted hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
                      >
                        <Pencil size={11} /> Add a due date or vendor
                      </button>
                    )}
                  </div>
                )}

              {/* Linked inspirations */}
              <LinkedInspirations checklistItemId={liveItem.id} />
              <EventItemComments subjectType="CHECKLIST_ITEM" subjectId={liveItem.id} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Vendor Section (toggle + category + vendor picker) ──────────────────────

interface VendorOption {
  id: string
  businessName: string
  isVerified: boolean
  averageRating: number | null
  totalReviews: number
  city: string | null
  avatarUrl: string | null
}

function vendorDraftKey(vendor: VendorDraft) {
  if (vendor.vendorProfileId) return `p:${vendor.vendorProfileId}`
  if (vendor.userVendorContactId) return `c:${vendor.userVendorContactId}`
  return `n:${vendor.name.trim().toLowerCase()}`
}

function VendorSection({
  needsVendor,
  vendorCategory,
  vendors,
  onToggle,
  onCategoryChange,
  onVendorsChange,
}: {
  needsVendor: boolean
  vendorCategory: string
  vendors: VendorDraft[]
  onToggle: () => void
  onCategoryChange: (v: string) => void
  onVendorsChange: (vendors: VendorDraft[]) => void
}) {
  const tCat = useTranslations('vendorCategories')
  const [registeredVendors, setRegisteredVendors] = useState<VendorOption[]>([])
  const [myContacts, setMyContacts] = useState<UserVendorContact[]>([])
  const [vendorSearch, setVendorSearch] = useState('')
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [adding, setAdding] = useState(false)

  const fetchVendorData = useCallback(async (cat: string) => {
    if (!cat) return
    setLoadingVendors(true)
    try {
      const [vRes, cRes] = await Promise.all([
        proxyClient.get<VendorOption[]>(`/vendors?category=${cat}`),
        proxyClient.get<UserVendorContact[]>(`/vendor-contacts?category=${cat}`),
      ])
      setRegisteredVendors(Array.isArray(vRes.data) ? vRes.data : [])
      setMyContacts(Array.isArray(cRes.data) ? cRes.data : [])
    } catch {
      setRegisteredVendors([])
      setMyContacts([])
    } finally {
      setLoadingVendors(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled && needsVendor && vendorCategory) fetchVendorData(vendorCategory)
    })
    return () => {
      cancelled = true
    }
  }, [needsVendor, vendorCategory, fetchVendorData])

  const selectedKeys = new Set(vendors.map(vendorDraftKey))
  const selectedProfileIds = new Set(
    vendors.map((vendor) => vendor.vendorProfileId).filter((id): id is string => !!id),
  )
  const selectedContactIds = new Set(
    vendors.map((vendor) => vendor.userVendorContactId).filter((id): id is string => !!id),
  )

  const filteredVendors = registeredVendors.filter(
    (v) =>
      !selectedProfileIds.has(v.id) &&
      v.businessName.toLowerCase().includes(vendorSearch.toLowerCase()),
  )
  const filteredContacts = myContacts.filter(
    (c) =>
      !selectedContactIds.has(c.id) && c.name.toLowerCase().includes(vendorSearch.toLowerCase()),
  )

  const addVendor = (draft: VendorDraft) => {
    if (!draft.vendorProfileId && !draft.userVendorContactId && !draft.name.trim()) return
    if (selectedKeys.has(vendorDraftKey(draft))) return
    onVendorsChange([...vendors, draft])
    setVendorSearch('')
    setCustomMode(false)
    setAdding(false)
  }

  const handleCategoryChange = (cat: string) => {
    onCategoryChange(cat)
    setVendorSearch('')
    setCustomMode(false)
    setAdding(false)
  }

  const pickerOpen = needsVendor && !!vendorCategory && (vendors.length === 0 || adding)

  return (
    <div className="space-y-1.5">
      {/* Toggle */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition-all',
          needsVendor
            ? 'bg-gold-500/10 border-gold-500/30 text-foreground'
            : 'text-muted hover:text-foreground border-border hover:border-border',
        )}
      >
        <ChevronRight
          size={14}
          className={cn('text-muted shrink-0 transition-transform', needsVendor && 'rotate-90')}
        />
        <Store size={11} className={needsVendor ? 'text-foreground' : 'text-muted'} />
        <span className="flex-1 text-left">
          {needsVendor ? 'Needs a vendor / service' : 'Needs a vendor or service?'}
        </span>
      </button>

      {needsVendor && (
        <div className="space-y-1.5 pl-1">
          {/* Category picker */}
          <div className="flex items-center gap-2">
            <span className="text-muted w-16 shrink-0 text-[10px]">Category</span>
            <select
              value={vendorCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="input flex-1"
            >
              <option value="">— Select a category —</option>
              {VENDOR_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {getVendorCategoryLabel(key, tCat)}
                </option>
              ))}
            </select>
          </div>

          {vendors.length > 0 && (
            <div className="space-y-1">
              {vendors.map((vendor, index) => (
                <div
                  key={vendorDraftKey(vendor) || `${vendor.name}-${index}`}
                  className="bg-gold-500/10 border-gold-500/20 flex items-center gap-1.5 rounded-lg border px-2 py-1.5"
                >
                  {vendor.userVendorContactId ? (
                    <BookUser size={11} className="text-foreground shrink-0" />
                  ) : (
                    <Store size={11} className="text-foreground shrink-0" />
                  )}
                  <span className="text-foreground flex-1 truncate text-xs">{vendor.name}</span>
                  {vendor.vendorProfileId && (
                    <BadgeCheck
                      size={10}
                      className="text-foreground shrink-0"
                      aria-label="Registered vendor"
                    />
                  )}
                  {vendor.userVendorContactId && (
                    <span className="text-muted text-[9px]">saved</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onVendorsChange(vendors.filter((_, i) => i !== index))}
                    className="text-muted transition-colors hover:text-red-400"
                    aria-label={`Remove ${vendor.name || 'vendor'}`}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {!pickerOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(true)
                    setVendorSearch('')
                    setCustomMode(false)
                  }}
                  className="text-muted hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
                >
                  <Plus size={10} /> Add another vendor
                </button>
              )}
            </div>
          )}

          {/* Vendor picker — shown when category is set and no vendor selected yet, or adding another */}
          {pickerOpen && vendorCategory && (
            <div className="border-border bg-card overflow-hidden rounded-xl border text-xs">
              {adding && (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    setVendorSearch('')
                    setCustomMode(false)
                  }}
                  className="text-muted hover:text-foreground border-border flex w-full items-center justify-between border-b px-2.5 py-1.5 transition-colors"
                >
                  <span>Add another vendor</span>
                  <X size={10} />
                </button>
              )}
              {loadingVendors ? (
                <div className="text-muted flex items-center justify-center gap-1.5 py-4">
                  <Loader2 size={11} className="animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  {/* My contacts section */}
                  {filteredContacts.length > 0 && !customMode && (
                    <div className="border-border border-b">
                      <div className="text-muted flex items-center gap-1 px-2.5 py-1 text-[9px] font-semibold tracking-wider uppercase">
                        <BookUser size={8} /> My contacts
                      </div>
                      <ul className="max-h-24 overflow-y-auto">
                        {filteredContacts.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() =>
                                addVendor({
                                  name: c.name,
                                  vendorProfileId: null,
                                  userVendorContactId: c.id,
                                })
                              }
                              className="group hover:bg-foreground/5 flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
                            >
                              <BookUser size={10} className="text-muted shrink-0" />
                              <span className="text-foreground group-hover:text-foreground flex-1 truncate">
                                {c.name}
                              </span>
                              {(c.email || c.phone) && (
                                <span className="text-muted truncate text-[9px]">
                                  {c.email ?? c.phone}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Registered vendors */}
                  {registeredVendors.length > 0 && !customMode && (
                    <>
                      <div className="text-muted border-border flex items-center gap-1 border-b px-2.5 py-1 text-[9px] font-semibold tracking-wider uppercase">
                        <Store size={8} /> Registered vendors
                      </div>
                      {registeredVendors.length > 3 && (
                        <div className="border-border flex items-center gap-1.5 border-b px-2.5 py-1.5">
                          <Search size={9} className="text-muted shrink-0" />
                          <input
                            type="text"
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value)}
                            placeholder="Search…"
                            className="text-muted placeholder:text-muted flex-1 bg-transparent focus:outline-none"
                          />
                        </div>
                      )}
                      <ul className="divide-border max-h-32 divide-y overflow-y-auto">
                        {filteredVendors.map((v) => (
                          <li key={v.id}>
                            <button
                              type="button"
                              onClick={() =>
                                addVendor({
                                  name: v.businessName,
                                  vendorProfileId: v.id,
                                  userVendorContactId: null,
                                })
                              }
                              className="group hover:bg-foreground/5 flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
                            >
                              <div className="bg-foreground/5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                                <Store size={9} className="text-muted" />
                              </div>
                              <span className="text-foreground group-hover:text-foreground flex-1 truncate">
                                {v.businessName}
                              </span>
                              {v.isVerified && (
                                <BadgeCheck size={10} className="text-foreground shrink-0" />
                              )}
                              {v.averageRating !== null && (
                                <span className="flex items-center gap-0.5 text-[9px] text-amber-400">
                                  <Star size={7} fill="currentColor" />
                                  {v.averageRating.toFixed(1)}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                        {filteredVendors.length === 0 && vendorSearch && (
                          <li className="text-muted px-2.5 py-3 text-center italic">
                            No match for &ldquo;{vendorSearch}&rdquo;
                          </li>
                        )}
                      </ul>
                      <div className="border-border border-t">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMode(true)
                            setVendorSearch('')
                          }}
                          className="text-muted hover:text-foreground hover:bg-foreground/5 flex w-full items-center gap-1.5 px-2.5 py-2 transition-colors"
                        >
                          <Plus size={10} /> Not listed — add by name
                        </button>
                      </div>
                    </>
                  )}

                  {/* Custom name input */}
                  {(registeredVendors.length === 0 || customMode) && (
                    <>
                      {customMode && registeredVendors.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMode(false)
                            setVendorSearch('')
                          }}
                          className="text-muted hover:text-foreground border-border flex w-full items-center gap-1.5 border-b px-2.5 py-1.5 transition-colors"
                        >
                          ← Back to list
                        </button>
                      )}
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <Store size={10} className="text-muted shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          value={vendorSearch}
                          onChange={(e) => setVendorSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && vendorSearch.trim()) {
                              e.preventDefault()
                              addVendor({
                                name: vendorSearch.trim(),
                                vendorProfileId: null,
                                userVendorContactId: null,
                              })
                            }
                          }}
                          placeholder="Type vendor name and press Enter"
                          className="text-muted placeholder:text-muted flex-1 bg-transparent focus:outline-none"
                        />
                        {vendorSearch.trim() && (
                          <button
                            type="button"
                            onClick={() =>
                              addVendor({
                                name: vendorSearch.trim(),
                                vendorProfileId: null,
                                userVendorContactId: null,
                              })
                            }
                            className="bg-gold-600/15 border-gold-500/25 text-foreground hover:bg-gold-600/25 rounded border px-1.5 py-0.5 text-[9px] transition-colors"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Reminder row ─────────────────────────────────────────────────────────────

function ReminderRow({
  dueDate,
  notifyEmail,
  notifySms,
  onToggleEmail,
  onToggleSms,
}: {
  dueDate: string
  notifyEmail: boolean
  notifySms: boolean
  onToggleEmail: () => void
  onToggleSms: () => void
}) {
  if (!dueDate) return null
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <span className="text-muted w-14 shrink-0 text-[10px]">Remind via</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleEmail}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-all',
            notifyEmail
              ? 'bg-foreground/10 border-border text-foreground'
              : 'text-muted hover:text-muted border-border hover:border-border',
          )}
        >
          <Mail size={8} /> Email
        </button>
        <button
          type="button"
          onClick={onToggleSms}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-all',
            notifySms
              ? 'bg-foreground/10 border-border text-foreground'
              : 'text-muted hover:text-muted border-border hover:border-border',
          )}
        >
          <MessageSquare size={8} /> SMS
        </button>
      </div>
    </div>
  )
}

// ─── Add row ──────────────────────────────────────────────────────────────────

function AddRow({
  eventId,
  onAdded,
  onClose,
}: {
  eventId: string
  onAdded: (item: EventChecklistItem) => void
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const { canEdit } = useEventAccess()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(false)
  const [notifySms, setNotifySms] = useState(false)
  const [needsVendor, setNeedsVendor] = useState(false)
  const [vendorCategory, setVendorCategory] = useState('')
  const [vendors, setVendors] = useState<VendorDraft[]>([])
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [expanded, setExpanded] = useState(false)
  const people = useAssignablePeople(eventId)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = useCallback(async () => {
    if (!canEdit('CHECKLIST')) return
    const t = title.trim()
    if (!t) return
    const tempId = `tmp-${Date.now()}`
    const assignee = people.find((p) => p.id === assigneeUserId) ?? null
    const payload = vendorPayload(needsVendor, vendors)
    const first = payload.vendors[0]
    const optimistic: EventChecklistItem = {
      id: tempId,
      title: t,
      isCompleted: false,
      dueDate: dueDate || null,
      sortOrder: 9999,
      notifyByEmail: notifyEmail,
      notifyBySms: notifySms,
      needsVendor,
      vendorCategory: needsVendor ? vendorCategory || null : null,
      vendors: payload.vendors.map((row) => ({
        vendorProfileId: row.vendorProfileId,
        userVendorContactId: row.userVendorContactId,
        name: row.name,
        vendorProfile: null,
        userVendorContact: null,
      })),
      vendorProfileId: first?.vendorProfileId ?? null,
      userVendorContactId: first?.userVendorContactId ?? null,
      userVendorContact: null,
      vendorProfile: null,
      assigneeUserId: assignee?.id ?? null,
      assignee: assignee
        ? { id: assignee.id, firstName: assignee.firstName, lastName: assignee.lastName }
        : null,
    }
    onAdded(optimistic)
    setTitle('')
    setDueDate('')
    setNotifyEmail(false)
    setNotifySms(false)
    setNeedsVendor(false)
    setVendorCategory('')
    setVendors([])
    setAssigneeUserId('')
    setExpanded(false)
    requestAnimationFrame(() => ref.current?.focus())
    try {
      const { data: created } = await proxyClient.post<EventChecklistItem>(
        `/events/${eventId}/checklist`,
        {
          title: t,
          ...(dueDate && { dueDate }),
          notifyByEmail: notifyEmail,
          notifyBySms: notifySms,
          needsVendor,
          vendorCategory: needsVendor ? vendorCategory || null : null,
          ...payload,
          ...(assigneeUserId && { assigneeUserId }),
        },
      )
      onAdded(created)
    } catch {
      onAdded({ ...optimistic, id: `REMOVE-${tempId}` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    dueDate,
    notifyEmail,
    notifySms,
    needsVendor,
    vendorCategory,
    vendors,
    assigneeUserId,
    people,
    canEdit,
  ])

  return (
    <div className="border-gold-500/20 bg-foreground/5 mx-0.5 space-y-2.5 rounded-xl border p-3">
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            startTransition(submit)
          }
          if (e.key === 'Escape') onClose()
        }}
        placeholder="What needs to be done?"
        className="placeholder:text-muted focus:border-gold-500/30 border-border text-foreground w-full border-b bg-transparent pb-1.5 text-sm transition-colors focus:outline-none"
      />

      {expanded && (
        <>
          <AssigneeSelect value={assigneeUserId} onChange={setAssigneeUserId} people={people} />

          <div className="flex items-center gap-2">
            <CalendarDays size={11} className="text-muted shrink-0" />
            <span className="text-muted w-12 shrink-0 text-[10px]">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-muted focus:border-gold-500/30 border-border flex-1 border-b bg-transparent pb-0.5 text-xs transition-colors focus:outline-none"
            />
            {dueDate && (
              <button
                type="button"
                onClick={() => {
                  setDueDate('')
                  setNotifyEmail(false)
                  setNotifySms(false)
                }}
                className="text-muted transition-colors hover:text-red-400"
              >
                <X size={10} />
              </button>
            )}
          </div>

          <ReminderRow
            dueDate={dueDate}
            notifyEmail={notifyEmail}
            notifySms={notifySms}
            onToggleEmail={() => setNotifyEmail((v) => !v)}
            onToggleSms={() => setNotifySms((v) => !v)}
          />

          <VendorSection
            needsVendor={needsVendor}
            vendorCategory={vendorCategory}
            vendors={vendors}
            onToggle={() => {
              const next = !needsVendor
              setNeedsVendor(next)
              if (!next) {
                setVendorCategory('')
                setVendors([])
              }
            }}
            onCategoryChange={(cat) => {
              setVendorCategory(cat)
              setVendors([])
            }}
            onVendorsChange={setVendors}
          />
        </>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => startTransition(submit)}
          disabled={!title.trim() || isPending}
          className="bg-gold-600/15 border-gold-500/25 text-foreground hover:bg-gold-600/25 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={11} /> {isPending ? 'Adding…' : 'Add task'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-foreground border-border rounded-lg border px-2.5 py-1 text-xs transition-colors"
        >
          Cancel
        </button>
        <span className="text-muted ml-auto text-[10px]">↵ to add · Esc to close</span>
      </div>
    </div>
  )
}

function SortTh({
  label,
  active,
  desc,
  onClick,
  className,
}: {
  label: string
  active: boolean
  desc?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <th
      className={cn(
        'px-2 py-2 text-left text-[10px] font-semibold tracking-wider uppercase',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1',
          active ? 'text-foreground' : 'text-muted hover:text-foreground',
        )}
      >
        {label}
        {active && (desc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </button>
    </th>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChecklistSection({
  eventId,
  initialItems,
  focusItemId,
  onItemsChange,
  onCollapse,
}: Props) {
  const tCl = useTranslations('checklist')
  const tCat = useTranslations('vendorCategories')
  const { canEdit, viewer } = useEventAccess()
  const people = useAssignablePeople(eventId)
  const fetched = useLazyGet<EventChecklistItem[]>(
    initialItems ? null : `/events/${eventId}/checklist`,
  )
  const [items, setItems] = useState<EventChecklistItem[]>(initialItems ?? [])
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('due-asc')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [groupBy, setGroupBy] = useState<GroupKey>('due')
  const skipNotify = useRef(true)
  const onItemsChangeRef = useRef(onItemsChange)
  onItemsChangeRef.current = onItemsChange

  useEffect(() => {
    if (fetched.data) setItems(Array.isArray(fetched.data) ? fetched.data : [])
  }, [fetched.data])

  const loading = !initialItems && fetched.loading && items.length === 0

  useEffect(() => {
    if (skipNotify.current) {
      skipNotify.current = false
      return
    }
    onItemsChangeRef.current?.(items)
  }, [items])

  const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
    { value: 'all', label: tCl('filters.all') },
    { value: 'todo', label: tCl('filters.todo') },
    { value: 'done', label: tCl('filters.done') },
    { value: 'overdue', label: tCl('filters.overdue') },
    { value: 'has-date', label: tCl('filters.dated') },
    { value: 'mine', label: 'Assigned to me' },
  ]

  const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
    { value: 'due', label: tCl('group.due') },
    { value: 'person', label: tCl('group.person') },
    { value: 'none', label: tCl('group.none') },
  ]

  const total = items.length
  const doneCount = items.filter((i) => i.isCompleted).length
  const overdueCount = items.filter((i) => isOverdue(i.dueDate, i.isCompleted)).length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const displayed = useMemo(
    () => applySortFilter(items, sortBy, filterBy, viewer.userId),
    [items, sortBy, filterBy, viewer.userId],
  )

  const grouped = useMemo(
    () =>
      groupItems(displayed, groupBy, {
        overdue: tCl('groups.overdue'),
        thisWeek: tCl('groups.thisWeek'),
        later: tCl('groups.later'),
        noDate: tCl('groups.noDate'),
        done: tCl('groups.done'),
        unassigned: tCl('groups.unassigned'),
      }),
    [displayed, groupBy, tCl],
  )

  useEffect(() => {
    if (!focusItemId) return
    setFilterBy('all')
    setOpenItemId(focusItemId)
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`checklist-item-${focusItemId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusItemId])

  // ── Toggle ────────────────────────────────────────────────────────────────
  async function toggle(item: EventChecklistItem) {
    if (!canEdit('CHECKLIST')) return
    const next = !item.isCompleted
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isCompleted: next } : i)))
    try {
      await proxyClient.patch(`/events/${eventId}/checklist/${item.id}`, { isCompleted: next })
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isCompleted: item.isCompleted } : i)),
      )
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteItem(itemId: string) {
    if (!canEdit('CHECKLIST')) return
    const snap = items
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    try {
      await proxyClient.delete(`/events/${eventId}/checklist/${itemId}`)
    } catch {
      setItems(snap)
    }
  }

  async function patchItem(
    item: EventChecklistItem,
    dto: Record<string, unknown>,
    optimistic: Partial<EventChecklistItem>,
  ) {
    if (!canEdit('CHECKLIST')) return
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...optimistic } : i)))
    try {
      const { data } = await proxyClient.patch<EventChecklistItem>(
        `/events/${eventId}/checklist/${item.id}`,
        dto,
      )
      setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)))
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
    }
  }

  // ── Optimistic add ────────────────────────────────────────────────────────
  function handleAdded(item: EventChecklistItem) {
    if (item.id.startsWith('REMOVE-')) {
      const tmp = item.id.replace('REMOVE-', '')
      setItems((prev) => prev.filter((i) => i.id !== tmp))
      return
    }
    setItems((prev) => {
      const hasTmp = prev.some((i) => i.id.startsWith('tmp-'))
      if (hasTmp && !item.id.startsWith('tmp-'))
        return prev.map((i) => (i.id.startsWith('tmp-') ? item : i))
      if (prev.find((i) => i.id === item.id)) return prev
      return [...prev, item]
    })
  }

  return (
    <div className="card flex flex-col gap-4 p-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
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
            <h2 className="text-foreground text-sm font-semibold">Checklist</h2>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <span className="rounded-full border border-red-500/20 bg-red-500/12 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                {overdueCount} overdue
              </span>
            )}
            <span className="text-muted text-xs tabular-nums">
              {doneCount}/{total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress">
          <div className="progress-bar transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Filter + group ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 scrollbar-none items-center gap-1 overflow-x-auto">
          {FILTER_OPTIONS.map((opt) => {
            const count =
              opt.value === 'all'
                ? total
                : opt.value === 'todo'
                  ? items.filter((i) => !i.isCompleted).length
                  : opt.value === 'done'
                    ? doneCount
                    : opt.value === 'overdue'
                      ? overdueCount
                      : opt.value === 'mine'
                        ? items.filter(
                            (i) => i.assigneeUserId && i.assigneeUserId === viewer.userId,
                          ).length
                        : items.filter((i) => !!i.dueDate).length
            if (opt.value !== 'all' && count === 0) return null
            const active = filterBy === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setFilterBy(opt.value)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap transition-all',
                  active
                    ? opt.value === 'overdue'
                      ? 'border-red-500/25 bg-red-500/12 text-red-300'
                      : 'border-border bg-foreground/5 text-foreground'
                    : 'text-muted hover:text-foreground border-transparent',
                )}
              >
                {opt.label}
                {opt.value !== 'all' && <span className="text-[9px] opacity-60">{count}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGroupBy(opt.value)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap transition-all',
                groupBy === opt.value
                  ? 'border-border bg-foreground/5 text-foreground'
                  : 'text-muted hover:text-foreground border-transparent',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="-mx-1 overflow-x-auto">
        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : displayed.length === 0 && !showAdd ? (
          <p className="text-muted py-8 text-center text-xs">
            {total === 0 ? 'No tasks yet.' : 'Nothing matches this filter.'}
          </p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="w-8 px-2 py-2" aria-hidden />
                <SortTh
                  label="Task"
                  active={sortBy === 'alpha'}
                  onClick={() => setSortBy(sortBy === 'alpha' ? 'due-asc' : 'alpha')}
                />
                <SortTh
                  label="Assigned"
                  active={sortBy === 'assignee-asc' || sortBy === 'assignee-desc'}
                  desc={sortBy === 'assignee-desc'}
                  onClick={() =>
                    setSortBy(sortBy === 'assignee-asc' ? 'assignee-desc' : 'assignee-asc')
                  }
                />
                <SortTh
                  label="Due"
                  active={sortBy === 'due-asc' || sortBy === 'due-desc'}
                  desc={sortBy === 'due-desc'}
                  onClick={() => setSortBy(sortBy === 'due-asc' ? 'due-desc' : 'due-asc')}
                />
                <th className="text-muted hidden px-2 py-2 text-left text-[10px] font-semibold tracking-wider uppercase md:table-cell">
                  Vendor
                </th>
                <th className="text-muted hidden px-2 py-2 text-left text-[10px] font-semibold tracking-wider uppercase lg:table-cell">
                  Remind
                </th>
                <th className="w-16 px-2 py-2" aria-hidden />
              </tr>
            </thead>
            {grouped.map((section) => (
              <tbody key={section.key} className="border-border border-b last:border-b-0">
                {section.label && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted bg-foreground/4 px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase"
                    >
                      {section.label}
                      <span className="ml-1.5 tabular-nums opacity-60">{section.items.length}</span>
                    </td>
                  </tr>
                )}
                {section.items.map((item) => (
                  <tr
                    key={item.id}
                    id={`checklist-item-${item.id}`}
                    className={cn(
                      'group hover:bg-foreground/5 border-border border-t',
                      item.isCompleted && 'opacity-45',
                      item.id === focusItemId && 'bg-foreground/5',
                    )}
                  >
                    <td className="px-2 py-2 align-middle">
                      {canEdit('CHECKLIST') ? (
                        <button
                          type="button"
                          onClick={() => toggle(item)}
                          className="text-muted hover:text-foreground transition-colors"
                          aria-label={item.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {item.isCompleted ? (
                            <CheckCircle2 size={15} className="text-foreground" />
                          ) : (
                            <Circle size={15} />
                          )}
                        </button>
                      ) : (
                        <span className="text-muted" aria-hidden>
                          {item.isCompleted ? (
                            <CheckCircle2 size={15} className="text-foreground" />
                          ) : (
                            <Circle size={15} />
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <button
                        type="button"
                        onClick={() => setOpenItemId(item.id)}
                        className={cn(
                          'text-left text-sm leading-snug',
                          item.isCompleted ? 'text-muted line-through' : 'text-foreground',
                        )}
                      >
                        {item.title}
                      </button>
                    </td>
                    <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                      {canEdit('CHECKLIST') ? (
                        <select
                          value={item.assigneeUserId ?? ''}
                          aria-label="Assign to"
                          onChange={(e) => {
                            const nextId = e.target.value
                            const person = people.find((p) => p.id === nextId)
                            void patchItem(
                              item,
                              { assigneeUserId: nextId || null },
                              {
                                assigneeUserId: nextId || null,
                                assignee: person
                                  ? {
                                      id: person.id,
                                      firstName: person.firstName,
                                      lastName: person.lastName,
                                    }
                                  : null,
                              },
                            )
                          }}
                          className="text-foreground border-border bg-background max-w-[140px] truncate border-b py-0.5 text-xs focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {personName(person)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted text-xs">
                          {item.assignee ? personName(item.assignee) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      {canEdit('CHECKLIST') ? (
                        <input
                          type="date"
                          value={
                            item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : ''
                          }
                          aria-label="Due date"
                          onChange={(e) => {
                            const next = e.target.value || null
                            void patchItem(item, { dueDate: next }, { dueDate: next })
                          }}
                          className={cn(
                            'border-border bg-background w-[8.5rem] border-b py-0.5 text-xs tabular-nums focus:outline-none',
                            isOverdue(item.dueDate, item.isCompleted)
                              ? 'text-red-400'
                              : isDueSoon(item.dueDate, item.isCompleted)
                                ? 'text-amber-400'
                                : 'text-foreground',
                          )}
                        />
                      ) : (
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            isOverdue(item.dueDate, item.isCompleted)
                              ? 'text-red-400'
                              : isDueSoon(item.dueDate, item.isCompleted)
                                ? 'text-amber-400'
                                : 'text-muted',
                          )}
                        >
                          {item.dueDate ? fmtDate(item.dueDate) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="text-muted hidden max-w-[140px] truncate px-2 py-2 text-xs md:table-cell">
                      {vendorCellLabel(item, tCat)}
                    </td>
                    <td className="text-muted hidden px-2 py-2 lg:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        {item.notifyByEmail && <Mail size={11} aria-label="Email reminder" />}
                        {item.notifyBySms && <MessageSquare size={11} aria-label="SMS reminder" />}
                        {!item.notifyByEmail && !item.notifyBySms && '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setOpenItemId(item.id)}
                          className="text-muted hover:text-foreground hover:bg-foreground/5 rounded-md p-1 transition-colors"
                          aria-label="Open task"
                        >
                          <Pencil size={11} />
                        </button>
                        {canEdit('CHECKLIST') && (
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="text-muted rounded-md p-1 transition-colors hover:bg-red-500/8 hover:text-red-400"
                            aria-label="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </div>

      {/* ── Item detail drawer ────────────────────────────────────────────────── */}
      {openItemId &&
        (() => {
          const openItem = items.find((i) => i.id === openItemId)
          return openItem ? (
            <ItemDrawer
              key={openItem.id}
              item={openItem}
              eventId={eventId}
              onClose={() => setOpenItemId(null)}
              onSaved={(updated) =>
                setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
              }
              onToggle={() => {
                toggle(openItem)
              }}
            />
          ) : null
        })()}

      {/* ── Add row ─────────────────────────────────────────────────────────── */}
      {showAdd ? (
        <AddRow eventId={eventId} onAdded={handleAdded} onClose={() => setShowAdd(false)} />
      ) : canEdit('CHECKLIST') ? (
        <button
          onClick={() => setShowAdd(true)}
          className="text-muted hover:text-foreground group -mt-1 flex items-center gap-2 text-xs transition-colors"
        >
          <span className="border-border group-hover:border-border flex h-5 w-5 items-center justify-center rounded-md border border-dashed transition-colors">
            <Plus size={10} className="group-hover:text-foreground transition-colors" />
          </span>
          Add task
        </button>
      ) : null}
    </div>
  )
}
