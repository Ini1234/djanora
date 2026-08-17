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
  SlidersHorizontal,
  ChevronDown,
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
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import { cn } from '@/lib/utils'
import { VENDOR_CATEGORY_KEYS, getVendorCategoryLabel } from '@/lib/vendor-categories'
import type { EventChecklistItem, UserVendorContact } from '@/lib/api.types'
import { useMoodBoardLinks } from './mood-board-context'
import { useEventAccess } from './event-access-context'
import { EventItemComments } from './event-item-comments'

interface Props {
  eventId: string
  initialItems: EventChecklistItem[]
  focusItemId?: string
  onItemsChange?: (items: EventChecklistItem[]) => void
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey =
  'default' | 'due-asc' | 'due-desc' | 'todo-first' | 'done-first' | 'overdue-first' | 'alpha'
type FilterKey = 'all' | 'todo' | 'done' | 'overdue' | 'has-date' | 'mine'

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
  else r.sort((a, b) => a.sortOrder - b.sortOrder)

  return r
}

// ─── Linked Inspirations mini-section ────────────────────────────────────────

function LinkedInspirations({ checklistItemId }: { checklistItemId: string }) {
  const { loading, entriesByChecklistId } = useMoodBoardLinks()
  const items = entriesByChecklistId.get(checklistItemId) ?? []

  if (loading) return null
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      <p className="text-brand-600 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
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
                <Sparkles size={12} className="text-brand-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-brand-200 truncate text-xs font-medium">{insp.title}</p>
              <p className="text-brand-600 text-[10px]">
                {insp.category.charAt(0) + insp.category.slice(1).toLowerCase()}
              </p>
            </div>
            <Link
              href="/inspiration"
              className="text-brand-600 hover:text-gold-300 transition-colors"
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
  const [vendorName, setVendorName] = useState(
    item.vendorProfile?.businessName ?? item.userVendorContact?.name ?? '',
  )
  const [vendorProfileId, setVendorProfileId] = useState<string | null>(
    item.vendorProfileId ?? null,
  )
  const [userVendorContactId, setUserVendorContactId] = useState<string | null>(
    item.userVendorContactId ?? null,
  )

  // ── Derived view values ──────────────────────────────────────────────────
  const [liveItem, setLiveItem] = useState(item)
  const vendorDisplayName = liveItem.vendorProfile?.businessName ?? liveItem.userVendorContact?.name
  const isContact = !!liveItem.userVendorContact
  const isRegistered = !!liveItem.vendorProfile

  // Reset edit state from latest item when entering edit mode
  const enterEdit = useCallback(() => {
    setTitle(liveItem.title)
    setDueDate(liveItem.dueDate ? new Date(liveItem.dueDate).toISOString().split('T')[0] : '')
    setNotifyEmail(liveItem.notifyByEmail)
    setNotifySms(liveItem.notifyBySms)
    setNeedsVendor(liveItem.needsVendor ?? false)
    setVendorCategory(liveItem.vendorCategory ?? '')
    setVendorName(liveItem.vendorProfile?.businessName ?? liveItem.userVendorContact?.name ?? '')
    setVendorProfileId(liveItem.vendorProfileId ?? null)
    setUserVendorContactId(liveItem.userVendorContactId ?? null)
    setIsEditing(true)
  }, [liveItem])

  async function save() {
    if (!canEdit('CHECKLIST')) return
    const t = title.trim()
    if (!t) return
    const { data: updated } = await proxyClient.patch<EventChecklistItem>(
      `/events/${eventId}/checklist/${liveItem.id}`,
      {
        title: t,
        dueDate: dueDate || null,
        notifyByEmail: notifyEmail,
        notifyBySms: notifySms,
        needsVendor,
        vendorCategory: needsVendor ? vendorCategory || null : null,
        vendorProfileId: needsVendor ? (vendorProfileId ?? null) : null,
        userVendorContactId: needsVendor ? (userVendorContactId ?? null) : null,
      },
    )
    setLiveItem(updated)
    onSaved(updated)
    setIsEditing(false)
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
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (isEditing) setIsEditing(false)
          else onClose()
        }}
      />

      {/* Drawer panel */}
      <div className="animate-in slide-in-from-bottom md:slide-in-from-right fixed inset-x-0 bottom-0 z-50 flex flex-col border-t border-white/10 bg-[#0f0f0f] shadow-2xl shadow-black/60 duration-200 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[380px] md:border-t-0 md:border-l">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 border-b border-white/8 px-5 pt-5 pb-4">
          {!isEditing &&
            (canEdit('CHECKLIST') ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle()
                  setLiveItem((prev) => ({ ...prev, isCompleted: !prev.isCompleted }))
                }}
                className="text-brand-600 hover:text-gold-400 mt-0.5 shrink-0 transition-colors"
                aria-label={liveItem.isCompleted ? 'Mark incomplete' : 'Mark complete'}
              >
                {liveItem.isCompleted ? (
                  <CheckCircle2 size={18} className="text-gold-400" />
                ) : (
                  <Circle size={18} />
                )}
              </button>
            ) : (
              <span className="text-brand-600 mt-0.5 shrink-0" aria-hidden>
                {liveItem.isCompleted ? (
                  <CheckCircle2 size={18} className="text-gold-400" />
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
                className="placeholder:text-brand-600 border-gold-500/30 focus:border-gold-500/60 w-full border-b bg-transparent pb-1 text-sm font-medium text-white transition-colors focus:outline-none"
                placeholder="Task title"
              />
            ) : (
              <>
                <p
                  className={cn(
                    'text-sm leading-snug font-medium',
                    liveItem.isCompleted ? 'text-brand-500 line-through' : 'text-white',
                  )}
                >
                  {liveItem.title}
                </p>
                {liveItem.isCompleted && (
                  <p className="text-brand-700 mt-0.5 text-[10px]">Completed</p>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={() => startTransition(save)}
                  disabled={!title.trim() || isPending}
                  className="bg-gold-600/15 border-gold-500/25 text-gold-300 hover:bg-gold-600/25 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-40"
                >
                  <Check size={11} /> {isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-brand-600 hover:text-brand-200 rounded-lg p-1.5 transition-colors hover:bg-white/6"
                  aria-label="Cancel edit"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                {canEdit('CHECKLIST') && (
                  <button
                    onClick={enterEdit}
                    className="text-brand-600 hover:text-brand-200 rounded-lg p-1.5 transition-colors hover:bg-white/6"
                    aria-label="Edit task"
                  >
                    <Pencil size={13} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-brand-600 hover:text-brand-200 rounded-lg p-1.5 transition-colors hover:bg-white/6"
                  aria-label="Close"
                >
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
              {/* Due date */}
              <div className="space-y-1">
                <p className="text-brand-600 text-[10px] font-semibold tracking-wider uppercase">
                  Due date
                </p>
                <div className="flex items-center gap-2">
                  <CalendarDays size={13} className="text-brand-600 shrink-0" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="text-brand-200 focus:border-gold-500/30 flex-1 border-b border-white/10 bg-transparent pb-0.5 text-sm [color-scheme:dark] transition-colors focus:outline-none"
                  />
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueDate('')
                        setNotifyEmail(false)
                        setNotifySms(false)
                      }}
                      className="text-brand-600 transition-colors hover:text-red-400"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Reminders */}
              {dueDate && (
                <div className="space-y-1">
                  <p className="text-brand-600 text-[10px] font-semibold tracking-wider uppercase">
                    Remind via
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNotifyEmail((v) => !v)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all',
                        notifyEmail
                          ? 'bg-brand-700/50 border-brand-500/50 text-brand-200'
                          : 'text-brand-500 hover:text-brand-300 border-white/8 hover:border-white/15',
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
                          ? 'bg-brand-700/50 border-brand-500/50 text-brand-200'
                          : 'text-brand-500 hover:text-brand-300 border-white/8 hover:border-white/15',
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
                vendorName={vendorName}
                vendorProfileId={vendorProfileId}
                userVendorContactId={userVendorContactId}
                onToggle={() => {
                  const next = !needsVendor
                  setNeedsVendor(next)
                  if (!next) {
                    setVendorCategory('')
                    setVendorName('')
                    setVendorProfileId(null)
                    setUserVendorContactId(null)
                  }
                }}
                onCategoryChange={setVendorCategory}
                onVendorSelect={(name, profileId, contactId) => {
                  setVendorName(name)
                  setVendorProfileId(profileId)
                  setUserVendorContactId(contactId)
                }}
                onVendorClear={() => {
                  setVendorName('')
                  setVendorProfileId(null)
                  setUserVendorContactId(null)
                }}
              />
            </div>
          ) : (
            /* ── View mode ──────────────────────────────────────────────── */
            <>
              {/* Due date & reminders */}
              {(liveItem.dueDate || liveItem.notifyByEmail || liveItem.notifyBySms) && (
                <section className="space-y-2">
                  <p className="text-brand-600 text-[10px] font-semibold tracking-wider uppercase">
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
                              : 'text-brand-500',
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm',
                          isOverdue(liveItem.dueDate, liveItem.isCompleted)
                            ? 'text-red-300'
                            : isDueSoon(liveItem.dueDate, liveItem.isCompleted)
                              ? 'text-amber-300'
                              : 'text-brand-200',
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
                      <AlarmClock size={13} className="text-brand-600 shrink-0" />
                      <div className="flex items-center gap-1.5">
                        {liveItem.notifyByEmail && (
                          <span className="text-brand-400 inline-flex items-center gap-1 text-xs">
                            <Mail size={10} /> Email reminder
                          </span>
                        )}
                        {liveItem.notifyByEmail && liveItem.notifyBySms && (
                          <span className="text-brand-700 text-xs">·</span>
                        )}
                        {liveItem.notifyBySms && (
                          <span className="text-brand-400 inline-flex items-center gap-1 text-xs">
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
                  <p className="text-brand-600 text-[10px] font-semibold tracking-wider uppercase">
                    Vendor / Service
                  </p>

                  {liveItem.vendorCategory && (
                    <div className="flex items-center gap-2">
                      <Store size={12} className="text-brand-600 shrink-0" />
                      <span className="text-brand-300 text-xs">
                        {getVendorCategoryLabel(liveItem.vendorCategory, tCat)}
                      </span>
                    </div>
                  )}

                  {vendorDisplayName && (
                    <div className="border-gold-500/20 bg-gold-500/5 space-y-2.5 rounded-xl border p-3">
                      <div className="flex items-start gap-2">
                        <div className="bg-gold-500/10 border-gold-500/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                          {isContact ? (
                            <BookUser size={14} className="text-gold-400" />
                          ) : (
                            <Store size={14} className="text-gold-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-gold-200 truncate text-sm font-medium">
                              {vendorDisplayName}
                            </p>
                            {isRegistered && liveItem.vendorProfile?.isVerified && (
                              <BadgeCheck size={12} className="text-gold-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-brand-600 mt-0.5 text-[10px]">
                            {isRegistered ? 'Registered vendor' : 'Saved contact'}
                          </p>
                        </div>
                        {isRegistered && liveItem.vendorProfile?.slug && (
                          <Link
                            href={`/vendors/${liveItem.vendorProfile.slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-brand-600 hover:text-gold-300 shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/6"
                            aria-label="View vendor profile"
                          >
                            <ExternalLink size={12} />
                          </Link>
                        )}
                      </div>

                      {isContact && liveItem.userVendorContact && (
                        <div className="space-y-1.5 border-t border-white/6 pt-1">
                          {liveItem.userVendorContact.email && (
                            <a
                              href={`mailto:${liveItem.userVendorContact.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-brand-300 hover:text-gold-300 group flex items-center gap-2 text-xs transition-colors"
                            >
                              <Mail
                                size={11}
                                className="text-brand-600 group-hover:text-gold-400 shrink-0"
                              />
                              {liveItem.userVendorContact.email}
                            </a>
                          )}
                          {liveItem.userVendorContact.phone && (
                            <a
                              href={`tel:${liveItem.userVendorContact.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-brand-300 hover:text-gold-300 group flex items-center gap-2 text-xs transition-colors"
                            >
                              <Phone
                                size={11}
                                className="text-brand-600 group-hover:text-gold-400 shrink-0"
                              />
                              {liveItem.userVendorContact.phone}
                            </a>
                          )}
                          {liveItem.userVendorContact.website && (
                            <a
                              href={liveItem.userVendorContact.website}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-brand-300 hover:text-gold-300 group flex items-center gap-2 truncate text-xs transition-colors"
                            >
                              <Globe
                                size={11}
                                className="text-brand-600 group-hover:text-gold-400 shrink-0"
                              />
                              {liveItem.userVendorContact.website}
                            </a>
                          )}
                          {liveItem.userVendorContact.notes && (
                            <div className="text-brand-500 flex items-start gap-2 text-xs">
                              <FileText size={11} className="text-brand-700 mt-0.5 shrink-0" />
                              <p className="leading-relaxed">{liveItem.userVendorContact.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!vendorDisplayName &&
                    liveItem.vendorCategory &&
                    liveItem.vendorCategory !== 'OTHER' && (
                      <Link
                        href={`/vendors?category=${liveItem.vendorCategory}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-500 hover:text-gold-300 flex items-center gap-2 text-xs transition-colors"
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
                    <p className="text-brand-700 text-xs">No additional details yet.</p>
                    {canEdit('CHECKLIST') && (
                      <button
                        onClick={enterEdit}
                        className="text-brand-500 hover:text-gold-300 flex items-center gap-1.5 text-xs transition-colors"
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

function VendorSection({
  needsVendor,
  vendorCategory,
  vendorName,
  vendorProfileId,
  userVendorContactId,
  onToggle,
  onCategoryChange,
  onVendorSelect,
  onVendorClear,
}: {
  needsVendor: boolean
  vendorCategory: string
  vendorName: string
  vendorProfileId: string | null
  userVendorContactId: string | null
  onToggle: () => void
  onCategoryChange: (v: string) => void
  onVendorSelect: (name: string, profileId: string | null, contactId: string | null) => void
  onVendorClear: () => void
}) {
  const tCat = useTranslations('vendorCategories')
  const [registeredVendors, setRegisteredVendors] = useState<VendorOption[]>([])
  const [myContacts, setMyContacts] = useState<UserVendorContact[]>([])
  const [vendorSearch, setVendorSearch] = useState('')
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [customMode, setCustomMode] = useState(false)

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

  const filteredVendors = registeredVendors.filter((v) =>
    v.businessName.toLowerCase().includes(vendorSearch.toLowerCase()),
  )
  const filteredContacts = myContacts.filter((c) =>
    c.name.toLowerCase().includes(vendorSearch.toLowerCase()),
  )

  const handleCategoryChange = (cat: string) => {
    onCategoryChange(cat)
    onVendorClear()
    setVendorSearch('')
    setCustomMode(false)
  }

  const pickerOpen = needsVendor && vendorCategory && !vendorName

  return (
    <div className="space-y-1.5">
      {/* Toggle */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition-all',
          needsVendor
            ? 'bg-gold-500/10 border-gold-500/30 text-gold-300'
            : 'text-brand-500 hover:text-brand-300 border-white/8 hover:border-white/15',
        )}
      >
        <Store size={11} className={needsVendor ? 'text-gold-400' : 'text-brand-600'} />
        <span className="flex-1 text-left">
          {needsVendor ? 'Needs a vendor / service' : 'Needs a vendor or service?'}
        </span>
        {needsVendor ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {needsVendor && (
        <div className="space-y-1.5 pl-1">
          {/* Category picker */}
          <div className="flex items-center gap-2">
            <span className="text-brand-600 w-16 shrink-0 text-[10px]">Category</span>
            <select
              value={vendorCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="text-brand-200 focus:border-gold-500/40 flex-1 rounded-lg border border-white/10 bg-[#111] px-2 py-1 text-xs transition-colors focus:outline-none"
            >
              <option value="">— Select a category —</option>
              {VENDOR_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {getVendorCategoryLabel(key, tCat)}
                </option>
              ))}
            </select>
          </div>

          {/* Selected vendor chip */}
          {vendorName && (
            <div className="bg-gold-500/10 border-gold-500/20 flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
              {userVendorContactId ? (
                <BookUser size={11} className="text-gold-400 shrink-0" />
              ) : (
                <Store size={11} className="text-gold-400 shrink-0" />
              )}
              <span className="text-gold-300 flex-1 truncate text-xs">{vendorName}</span>
              {vendorProfileId && (
                <BadgeCheck
                  size={10}
                  className="text-gold-400 shrink-0"
                  aria-label="Registered vendor"
                />
              )}
              {userVendorContactId && <span className="text-brand-500 text-[9px]">saved</span>}
              <button
                type="button"
                onClick={() => {
                  onVendorClear()
                  setVendorSearch('')
                  setCustomMode(false)
                }}
                className="text-brand-600 transition-colors hover:text-red-400"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {/* Vendor picker — shown when category is set and no vendor selected yet */}
          {pickerOpen && vendorCategory && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/4 text-xs">
              {loadingVendors ? (
                <div className="text-brand-600 flex items-center justify-center gap-1.5 py-4">
                  <Loader2 size={11} className="animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  {/* My contacts section */}
                  {filteredContacts.length > 0 && !customMode && (
                    <div className="border-b border-white/8">
                      <div className="text-brand-600 flex items-center gap-1 px-2.5 py-1 text-[9px] font-semibold tracking-wider uppercase">
                        <BookUser size={8} /> My contacts
                      </div>
                      <ul className="max-h-24 overflow-y-auto">
                        {filteredContacts.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => onVendorSelect(c.name, null, c.id)}
                              className="group flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/6"
                            >
                              <BookUser size={10} className="text-brand-600 shrink-0" />
                              <span className="text-brand-200 group-hover:text-gold-200 flex-1 truncate">
                                {c.name}
                              </span>
                              {(c.email || c.phone) && (
                                <span className="text-brand-600 truncate text-[9px]">
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
                      <div className="text-brand-600 flex items-center gap-1 border-b border-white/6 px-2.5 py-1 text-[9px] font-semibold tracking-wider uppercase">
                        <Store size={8} /> Registered vendors
                      </div>
                      {registeredVendors.length > 3 && (
                        <div className="flex items-center gap-1.5 border-b border-white/6 px-2.5 py-1.5">
                          <Search size={9} className="text-brand-600 shrink-0" />
                          <input
                            type="text"
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value)}
                            placeholder="Search…"
                            className="text-brand-300 placeholder:text-brand-700 flex-1 bg-transparent focus:outline-none"
                          />
                        </div>
                      )}
                      <ul className="max-h-32 divide-y divide-white/5 overflow-y-auto">
                        {filteredVendors.map((v) => (
                          <li key={v.id}>
                            <button
                              type="button"
                              onClick={() => onVendorSelect(v.businessName, v.id, null)}
                              className="group flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/6"
                            >
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8">
                                <Store size={9} className="text-brand-600" />
                              </div>
                              <span className="text-brand-200 group-hover:text-gold-200 flex-1 truncate">
                                {v.businessName}
                              </span>
                              {v.isVerified && (
                                <BadgeCheck size={10} className="text-gold-400 shrink-0" />
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
                          <li className="text-brand-700 px-2.5 py-3 text-center italic">
                            No match for &ldquo;{vendorSearch}&rdquo;
                          </li>
                        )}
                      </ul>
                      <div className="border-t border-white/8">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMode(true)
                            setVendorSearch('')
                          }}
                          className="text-brand-600 hover:text-gold-300 flex w-full items-center gap-1.5 px-2.5 py-2 transition-colors hover:bg-white/4"
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
                          className="text-brand-600 hover:text-brand-300 flex w-full items-center gap-1.5 border-b border-white/8 px-2.5 py-1.5 transition-colors"
                        >
                          ← Back to list
                        </button>
                      )}
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <Store size={10} className="text-brand-600 shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          value={vendorSearch}
                          onChange={(e) => setVendorSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && vendorSearch.trim()) {
                              onVendorSelect(vendorSearch.trim(), null, null)
                              setVendorSearch('')
                            }
                          }}
                          placeholder="Type vendor name and press Enter"
                          className="text-brand-300 placeholder:text-brand-700 flex-1 bg-transparent focus:outline-none"
                        />
                        {vendorSearch.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              onVendorSelect(vendorSearch.trim(), null, null)
                              setVendorSearch('')
                            }}
                            className="bg-gold-600/15 border-gold-500/25 text-gold-300 hover:bg-gold-600/25 rounded border px-1.5 py-0.5 text-[9px] transition-colors"
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
      <span className="text-brand-600 w-14 shrink-0 text-[10px]">Remind via</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleEmail}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-all',
            notifyEmail
              ? 'bg-brand-700/50 border-brand-500/50 text-brand-200'
              : 'text-brand-600 hover:text-brand-400 border-white/8 hover:border-white/15',
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
              ? 'bg-brand-700/50 border-brand-500/50 text-brand-200'
              : 'text-brand-600 hover:text-brand-400 border-white/8 hover:border-white/15',
          )}
        >
          <MessageSquare size={8} /> SMS
        </button>
      </div>
    </div>
  )
}

// ─── Edit form (inline) ───────────────────────────────────────────────────────

function EditRow({
  item,
  eventId,
  onSaved,
  onCancel,
}: {
  item: EventChecklistItem
  eventId: string
  onSaved: (updated: EventChecklistItem) => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const { canEdit } = useEventAccess()
  const [title, setTitle] = useState(item.title)
  const [dueDate, setDueDate] = useState(
    item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : '',
  )
  const [notifyEmail, setNotifyEmail] = useState(item.notifyByEmail)
  const [notifySms, setNotifySms] = useState(item.notifyBySms)
  const [needsVendor, setNeedsVendor] = useState(item.needsVendor ?? false)
  const [vendorCategory, setVendorCategory] = useState(item.vendorCategory ?? '')
  // display-only — derived from FK at init, updated when user picks a new vendor
  const [vendorName, setVendorName] = useState(
    item.vendorProfile?.businessName ?? item.userVendorContact?.name ?? '',
  )
  const [vendorProfileId, setVendorProfileId] = useState<string | null>(
    item.vendorProfileId ?? null,
  )
  const [userVendorContactId, setUserVendorContactId] = useState<string | null>(
    item.userVendorContactId ?? null,
  )
  const [assigneeUserId, setAssigneeUserId] = useState(item.assigneeUserId ?? '')
  const [assignees, setAssignees] = useState<
    { id: string; firstName: string | null; lastName: string | null; email: string }[]
  >([])
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])
  useEffect(() => {
    proxyClient
      .get<{ id: string; firstName: string | null; lastName: string | null; email: string }[]>(
        `/events/${eventId}/members/mentionable`,
        { params: { surface: 'CHECKLIST' } },
      )
      .then(({ data }) => setAssignees(Array.isArray(data) ? data : []))
      .catch(() => setAssignees([]))
  }, [eventId])

  async function save() {
    if (!canEdit('CHECKLIST')) return
    const t = title.trim()
    if (!t) return
    try {
      const { data: updated } = await proxyClient.patch<EventChecklistItem>(
        `/events/${eventId}/checklist/${item.id}`,
        {
          title: t,
          dueDate: dueDate || null,
          notifyByEmail: notifyEmail,
          notifyBySms: notifySms,
          needsVendor,
          vendorCategory: needsVendor ? vendorCategory || null : null,
          vendorProfileId: needsVendor ? (vendorProfileId ?? null) : null,
          userVendorContactId: needsVendor ? (userVendorContactId ?? null) : null,
          assigneeUserId: assigneeUserId || null,
        },
      )
      onSaved(updated)
    } catch {
      // Keep the editor open so the user can retry.
    }
  }

  return (
    <div className="mx-0.5 mb-1 space-y-2.5 rounded-xl border border-white/12 bg-white/3 p-3">
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            startTransition(save)
          }
          if (e.key === 'Escape') onCancel()
        }}
        className="placeholder:text-brand-600 focus:border-gold-500/40 w-full border-b border-white/10 bg-transparent pb-1.5 text-sm text-white transition-colors focus:outline-none"
        placeholder="Task title"
      />

      <select
        value={assigneeUserId}
        onChange={(e) => setAssigneeUserId(e.target.value)}
        className="text-brand-200 w-full border-b border-white/10 bg-transparent py-1 text-xs"
      >
        <option value="">Unassigned</option>
        {assignees.map((person) => (
          <option key={person.id} value={person.id}>
            {[person.firstName, person.lastName].filter(Boolean).join(' ') || person.email}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <CalendarDays size={11} className="text-brand-600 shrink-0" />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-brand-300 focus:border-gold-500/30 flex-1 border-b border-white/8 bg-transparent pb-0.5 text-xs [color-scheme:dark] transition-colors focus:outline-none"
        />
        {dueDate && (
          <button
            type="button"
            onClick={() => {
              setDueDate('')
              setNotifyEmail(false)
              setNotifySms(false)
            }}
            className="text-brand-600 transition-colors hover:text-red-400"
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
        vendorName={vendorName}
        vendorProfileId={vendorProfileId}
        userVendorContactId={userVendorContactId}
        onToggle={() => {
          const next = !needsVendor
          setNeedsVendor(next)
          if (!next) {
            setVendorCategory('')
            setVendorName('')
            setVendorProfileId(null)
            setUserVendorContactId(null)
          }
        }}
        onCategoryChange={setVendorCategory}
        onVendorSelect={(name, profileId, contactId) => {
          setVendorName(name)
          setVendorProfileId(profileId)
          setUserVendorContactId(contactId)
        }}
        onVendorClear={() => {
          setVendorName('')
          setVendorProfileId(null)
          setUserVendorContactId(null)
        }}
      />

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => startTransition(save)}
          disabled={!title.trim() || isPending}
          className="bg-gold-600/15 border-gold-500/25 text-gold-300 hover:bg-gold-600/25 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={11} /> {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-brand-500 hover:text-brand-200 rounded-lg border border-white/8 px-2.5 py-1 text-xs transition-colors"
        >
          Cancel
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
  const [vendorName, setVendorName] = useState('')
  const [vendorProfileId, setVendorProfileId] = useState<string | null>(null)
  const [userVendorContactId, setUserVendorContactId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = useCallback(async () => {
    if (!canEdit('CHECKLIST')) return
    const t = title.trim()
    if (!t) return
    const tempId = `tmp-${Date.now()}`
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
      vendorProfileId: null,
      userVendorContactId: null,
      userVendorContact: null,
      vendorProfile: null,
    }
    onAdded(optimistic)
    onClose()
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
          vendorProfileId: needsVendor ? (vendorProfileId ?? null) : null,
          userVendorContactId: needsVendor ? (userVendorContactId ?? null) : null,
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
    vendorProfileId,
    userVendorContactId,
    canEdit,
  ])

  return (
    <div className="border-gold-500/20 mx-0.5 space-y-2.5 rounded-xl border bg-white/3 p-3">
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
        className="placeholder:text-brand-600 focus:border-gold-500/30 w-full border-b border-white/8 bg-transparent pb-1.5 text-sm text-white transition-colors focus:outline-none"
      />

      {expanded && (
        <>
          <div className="flex items-center gap-2">
            <CalendarDays size={11} className="text-brand-600 shrink-0" />
            <span className="text-brand-600 w-12 shrink-0 text-[10px]">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-brand-300 focus:border-gold-500/30 flex-1 border-b border-white/8 bg-transparent pb-0.5 text-xs [color-scheme:dark] transition-colors focus:outline-none"
            />
            {dueDate && (
              <button
                type="button"
                onClick={() => {
                  setDueDate('')
                  setNotifyEmail(false)
                  setNotifySms(false)
                }}
                className="text-brand-600 transition-colors hover:text-red-400"
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
            vendorName={vendorName}
            vendorProfileId={vendorProfileId}
            userVendorContactId={userVendorContactId}
            onToggle={() => {
              const next = !needsVendor
              setNeedsVendor(next)
              if (!next) {
                setVendorCategory('')
                setVendorName('')
                setVendorProfileId(null)
                setUserVendorContactId(null)
              }
            }}
            onCategoryChange={setVendorCategory}
            onVendorSelect={(name, profileId, contactId) => {
              setVendorName(name)
              setVendorProfileId(profileId)
              setUserVendorContactId(contactId)
            }}
            onVendorClear={() => {
              setVendorName('')
              setVendorProfileId(null)
              setUserVendorContactId(null)
            }}
          />
        </>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => startTransition(submit)}
          disabled={!title.trim() || isPending}
          className="bg-gold-600/15 border-gold-500/25 text-gold-300 hover:bg-gold-600/25 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={11} /> {isPending ? 'Adding…' : 'Add task'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-brand-500 hover:text-brand-200 rounded-lg border border-white/8 px-2.5 py-1 text-xs transition-colors"
        >
          Cancel
        </button>
        <span className="text-brand-700 ml-auto text-[10px]">↵ to add · Esc to close</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChecklistSection({ eventId, initialItems, focusItemId, onItemsChange }: Props) {
  const tCl = useTranslations('checklist')
  const tCat = useTranslations('vendorCategories')
  const { canEdit, viewer } = useEventAccess()
  const [items, setItems] = useState<EventChecklistItem[]>(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('default')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const skipNotify = useRef(true)
  const onItemsChangeRef = useRef(onItemsChange)
  onItemsChangeRef.current = onItemsChange

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

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'default', label: tCl('sort.default') },
    { value: 'due-asc', label: tCl('sort.dueAsc') },
    { value: 'due-desc', label: tCl('sort.dueDesc') },
    { value: 'overdue-first', label: tCl('sort.overdueFirst') },
    { value: 'todo-first', label: tCl('sort.todoFirst') },
    { value: 'done-first', label: tCl('sort.doneFirst') },
    { value: 'alpha', label: tCl('sort.alpha') },
  ]

  const total = items.length
  const doneCount = items.filter((i) => i.isCompleted).length
  const overdueCount = items.filter((i) => isOverdue(i.dueDate, i.isCompleted)).length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const displayed = useMemo(
    () => applySortFilter(items, sortBy, filterBy, viewer.userId),
    [items, sortBy, filterBy, viewer.userId],
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
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/4 p-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Checklist</h2>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <span className="rounded-full border border-red-500/20 bg-red-500/12 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                {overdueCount} overdue
              </span>
            )}
            <span className="text-brand-500 text-xs tabular-nums">
              {doneCount}/{total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/6">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              'from-gold-600 to-gold-400 bg-gradient-to-r',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Filter + Sort bar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Filter pills */}
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
                      : 'border-white/15 bg-white/8 text-white'
                    : 'text-brand-500 hover:text-brand-300 border-transparent',
                )}
              >
                {opt.label}
                {opt.value !== 'all' && <span className="text-[9px] opacity-60">{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Sort button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSortMenu((v) => !v)}
            className={cn(
              'flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors',
              sortBy !== 'default'
                ? 'bg-gold-600/12 border-gold-500/25 text-gold-400'
                : 'text-brand-500 hover:text-brand-300 border-white/8 hover:border-white/15',
            )}
          >
            <SlidersHorizontal size={10} />
            Sort
            <ChevronDown
              size={9}
              className={cn('transition-transform', showSortMenu && 'rotate-180')}
            />
          </button>

          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute top-full right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#111111] py-1.5 shadow-2xl shadow-black/50">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortBy(opt.value)
                      setShowSortMenu(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors',
                      sortBy === opt.value
                        ? 'text-gold-300 bg-gold-600/8'
                        : 'text-brand-400 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {opt.label}
                    {sortBy === opt.value && <Check size={10} className="text-gold-400 shrink-0" />}
                  </button>
                ))}
                {sortBy !== 'default' && (
                  <>
                    <div className="my-1 border-t border-white/6" />
                    <button
                      onClick={() => {
                        setSortBy('default')
                        setShowSortMenu(false)
                      }}
                      className="text-brand-600 w-full px-3 py-1.5 text-left text-xs transition-colors hover:text-red-400"
                    >
                      Reset sort
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {(sortBy !== 'default' || filterBy !== 'all') && (
          <button
            onClick={() => {
              setSortBy('default')
              setFilterBy('all')
            }}
            className="text-brand-600 flex shrink-0 items-center gap-0.5 text-[10px] transition-colors hover:text-red-400"
          >
            <X size={9} />
          </button>
        )}
      </div>

      {/* ── Item list ───────────────────────────────────────────────────────── */}
      <div className="-mx-1 max-h-[340px] space-y-0.5 overflow-y-auto px-1">
        {displayed.length === 0 && !showAdd && (
          <p className="text-brand-600 py-8 text-center text-xs">
            {total === 0 ? 'No tasks yet.' : 'Nothing matches this filter.'}
          </p>
        )}

        {displayed.map((item) =>
          editingId === item.id ? (
            <EditRow
              key={item.id}
              item={item}
              eventId={eventId}
              onSaved={(updated) => {
                setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={item.id}
              id={`checklist-item-${item.id}`}
              className={cn(
                'group flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-white/3',
                item.isCompleted && 'opacity-45',
                item.id === focusItemId && 'bg-gold-500/10',
              )}
              onClick={() => setOpenItemId(item.id)}
            >
              {/* Checkbox */}
              {canEdit('CHECKLIST') ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(item)
                  }}
                  className="text-brand-600 hover:text-gold-400 mt-0.5 shrink-0 transition-colors"
                  aria-label={item.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                >
                  {item.isCompleted ? (
                    <CheckCircle2 size={15} className="text-gold-400" />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>
              ) : (
                <span className="text-brand-600 mt-0.5 shrink-0" aria-hidden>
                  {item.isCompleted ? (
                    <CheckCircle2 size={15} className="text-gold-400" />
                  ) : (
                    <Circle size={15} />
                  )}
                </span>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm leading-snug',
                    item.isCompleted ? 'text-brand-600 line-through' : 'text-brand-100',
                  )}
                >
                  {item.title}
                  {item.assignee && (
                    <span className="text-gold-500 ml-2 text-[10px] font-normal no-underline">
                      {[item.assignee.firstName, item.assignee.lastName]
                        .filter(Boolean)
                        .join(' ') || 'Assigned'}
                    </span>
                  )}
                </p>

                {/* Metadata row */}
                {(item.dueDate || item.notifyByEmail || item.notifyBySms || item.needsVendor) &&
                  !item.isCompleted && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {item.dueDate && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[10px]',
                            isOverdue(item.dueDate, item.isCompleted)
                              ? 'text-red-400'
                              : isDueSoon(item.dueDate, item.isCompleted)
                                ? 'text-amber-400'
                                : 'text-brand-500',
                          )}
                        >
                          <CalendarDays size={9} />
                          {isOverdue(item.dueDate, item.isCompleted) && (
                            <span className="font-medium">Overdue · </span>
                          )}
                          {fmtDate(item.dueDate)}
                        </span>
                      )}
                      {item.dueDate && (item.notifyByEmail || item.notifyBySms) && (
                        <span className="text-brand-700">·</span>
                      )}
                      {item.notifyByEmail && (
                        <span className="text-brand-600 inline-flex items-center gap-0.5 text-[9px]">
                          <Mail size={8} /> Email
                        </span>
                      )}
                      {item.notifyBySms && (
                        <span className="text-brand-600 inline-flex items-center gap-0.5 text-[9px]">
                          <MessageSquare size={8} /> SMS
                        </span>
                      )}

                      {/* Vendor badge */}
                      {item.needsVendor && (
                        <>
                          {(item.dueDate || item.notifyByEmail || item.notifyBySms) && (
                            <span className="text-brand-700">·</span>
                          )}
                          {item.vendorProfile || item.userVendorContact ? (
                            <span className="border-gold-500/30 bg-gold-500/10 text-gold-300 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
                              {item.userVendorContact ? <BookUser size={8} /> : <Store size={8} />}
                              {item.vendorProfile?.businessName ?? item.userVendorContact?.name}
                              {item.vendorProfile?.isVerified && (
                                <BadgeCheck size={8} className="text-gold-400" />
                              )}
                            </span>
                          ) : item.vendorCategory && item.vendorCategory !== 'OTHER' ? (
                            <span className="border-gold-500/25 bg-gold-500/8 text-gold-400 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
                              <Store size={8} />
                              {getVendorCategoryLabel(item.vendorCategory!, tCat)}
                            </span>
                          ) : (
                            <span className="text-brand-500 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/4 px-1.5 py-0.5 text-[10px]">
                              <Store size={8} />
                              {item.vendorCategory === 'OTHER'
                                ? 'Other service needed'
                                : 'Vendor needed'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
              </div>

              {/* Actions */}
              <div className="mt-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {canEdit('CHECKLIST') && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(item.id)
                        setShowAdd(false)
                      }}
                      className="text-brand-600 hover:text-brand-300 rounded-md p-1 transition-colors hover:bg-white/5"
                      aria-label="Edit"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                      }}
                      className="text-brand-600 rounded-md p-1 transition-colors hover:bg-red-500/8 hover:text-red-400"
                      aria-label="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* ── Item detail drawer ────────────────────────────────────────────────── */}
      {openItemId &&
        (() => {
          const openItem = items.find((i) => i.id === openItemId)
          return openItem ? (
            <ItemDrawer
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
          onClick={() => {
            setShowAdd(true)
            setEditingId(null)
          }}
          className="text-brand-600 hover:text-brand-300 group -mt-1 flex items-center gap-2 text-xs transition-colors"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md border border-dashed border-white/10 transition-colors group-hover:border-white/20">
            <Plus size={10} className="group-hover:text-gold-400 transition-colors" />
          </span>
          Add task
        </button>
      ) : null}
    </div>
  )
}
