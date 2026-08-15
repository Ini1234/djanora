'use client'

import { useState, useTransition } from 'react'
import {
  UserPlus, Trash2, Mail, MessageSquare, Send, Check, X,
  Clock, Users, ChevronDown, ChevronUp, Edit2, Phone,
  CheckCircle2, XCircle, HelpCircle, Search,
} from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { cn } from '@/lib/utils'
import type { Guest, Event } from '@/lib/api.types'
import { useEventAccess } from '../event-access-context'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  eventId: string
  initialGuests: Guest[]
  event: Pick<Event, 'id' | 'title' | 'estimatedDate' | 'location'>
}

type InviteVia = 'email' | 'sms' | 'both'

// ─── Helpers ───────────────────────────────────────────────────────────────

function guestDisplayName(g: Guest) {
  return [g.firstName, g.lastName].filter(Boolean).join(' ')
}

function rsvpBadge(status: string | undefined) {
  switch (status) {
    case 'ATTENDING':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 size={9} /> Attending
        </span>
      )
    case 'DECLINED':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">
          <XCircle size={9} /> Declined
        </span>
      )
    case 'MAYBE':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
          <HelpCircle size={9} /> Maybe
        </span>
      )
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-400">
          <Clock size={9} /> Awaiting
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 border border-white/10 text-brand-500">
          Not invited
        </span>
      )
  }
}

// ─── Add Guest Form ─────────────────────────────────────────────────────────

function AddGuestForm({
  eventId,
  onAdded,
}: {
  eventId: string
  onAdded: (g: Guest) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    note: '',
    plusOneAllowed: false,
    tableNumber: '',
  })
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function submit() {
    if (!form.firstName.trim()) {
      setError('First name is required')
      return
    }
    try {
      const { data: guest } = await proxyClient.post<Guest>(`/events/${eventId}/guests`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        note: form.note.trim() || undefined,
        plusOneAllowed: form.plusOneAllowed,
        tableNumber: form.tableNumber.trim() || undefined,
      })
      onAdded(guest)
      setForm({ firstName: '', lastName: '', email: '', phone: '', note: '', plusOneAllowed: false, tableNumber: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add guest')
    }
  }

  return (
    <div className="rounded-2xl bg-white/4 border border-white/10 p-5">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <UserPlus size={15} className="text-gold-400" /> Add Guest
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-brand-400 mb-1">First Name *</label>
          <input
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            placeholder="Adaeze"
            className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-400 mb-1">Last Name</label>
          <input
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            placeholder="Okafor"
            className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-400 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="adaeze@example.com"
            className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-400 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+1 613 555 0100"
            className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-400 mb-1">Table No.</label>
          <input
            value={form.tableNumber}
            onChange={(e) => update('tableNumber', e.target.value)}
            placeholder="Table 5"
            className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => update('plusOneAllowed', !form.plusOneAllowed)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative',
                form.plusOneAllowed ? 'bg-gold-600' : 'bg-white/10',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                  form.plusOneAllowed ? 'left-5' : 'left-0.5',
                )}
              />
            </button>
            <span className="text-sm text-brand-300">Plus one allowed</span>
          </label>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-brand-400 mb-1">Note</label>
        <input
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          placeholder="Dietary requirements, relationship, etc."
          className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs mb-3">{error}</p>
      )}

      <button
        onClick={() => startTransition(submit)}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-600/15 hover:bg-gold-600/25 border border-gold-500/30 text-gold-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <UserPlus size={14} />
        {isPending ? 'Adding…' : 'Add Guest'}
      </button>
    </div>
  )
}

// ─── Send Invite Panel ──────────────────────────────────────────────────────

function InvitePanel({
  guest,
  eventId,
  onSent,
  onClose,
}: {
  guest: Guest
  eventId: string
  onSent: (g: Guest) => void
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [via, setVia] = useState<InviteVia>(
    guest.email && guest.phone ? 'both' : guest.email ? 'email' : 'sms',
  )
  const [customNote, setCustomNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const canEmail = !!guest.email
  const canSms = !!guest.phone

  async function send() {
    setError(null)
    try {
      const { data: updated } = await proxyClient.post<Guest>(`/events/${eventId}/guests/${guest.id}/invite`, {
        via,
        customNote: customNote.trim() || undefined,
      })
      onSent(updated)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    }
  }

  if (success) {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 flex items-center gap-3">
        <Check size={16} className="text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">Invite sent to {guestDisplayName(guest)}!</p>
        <button onClick={onClose} className="ml-auto text-brand-500 hover:text-brand-300">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white/4 border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">
          Send invite to {guestDisplayName(guest)}
        </p>
        <button onClick={onClose} className="text-brand-500 hover:text-brand-300">
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-2">
        {(['email', 'sms', 'both'] as const).map((opt) => {
          const disabled =
            (opt === 'email' && !canEmail) ||
            (opt === 'sms' && !canSms) ||
            (opt === 'both' && (!canEmail || !canSms))
          return (
            <button
              key={opt}
              onClick={() => !disabled && setVia(opt)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                via === opt && !disabled
                  ? 'bg-gold-600/20 border-gold-500/40 text-gold-300'
                  : 'bg-white/4 border-white/10 text-brand-400 hover:text-brand-200 disabled:opacity-30 disabled:cursor-not-allowed',
              )}
            >
              {opt === 'email' && <Mail size={11} />}
              {opt === 'sms' && <Phone size={11} />}
              {opt === 'both' && <Send size={11} />}
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          )
        })}
      </div>

      <div>
        <label className="block text-xs text-brand-400 mb-1">Personal message (optional)</label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="We'd love to see you there! Please RSVP by…"
          rows={2}
          className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={() => startTransition(send)}
        disabled={isPending || (!canEmail && !canSms)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-600/15 hover:bg-gold-600/25 border border-gold-500/30 text-gold-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send size={13} />
        {isPending ? 'Sending…' : 'Send Invite'}
      </button>

      {!canEmail && !canSms && (
        <p className="text-xs text-red-400">Add an email or phone number to send an invite.</p>
      )}
    </div>
  )
}

// ─── Guest Row ──────────────────────────────────────────────────────────────

function GuestRow({
  guest,
  eventId,
  onUpdated,
  onRemoved,
}: {
  guest: Guest
  eventId: string
  onUpdated: (g: Guest) => void
  onRemoved: (id: string) => void
}) {
  const { canEdit } = useEventAccess()
  const [isPending, startTransition] = useTransition()
  const [showInvite, setShowInvite] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: guest.firstName,
    lastName: guest.lastName ?? '',
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    note: guest.note ?? '',
    tableNumber: guest.tableNumber ?? '',
    plusOneAllowed: guest.plusOneAllowed,
  })

  async function save() {
    try {
      const { data: updated } = await proxyClient.patch<Guest>(`/events/${eventId}/guests/${guest.id}`, {
        firstName: editForm.firstName.trim() || guest.firstName,
        lastName: editForm.lastName.trim() || undefined,
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        note: editForm.note.trim() || undefined,
        tableNumber: editForm.tableNumber.trim() || undefined,
        plusOneAllowed: editForm.plusOneAllowed,
      })
      onUpdated(updated)
      setIsEditing(false)
    } catch {
      // silently ignore
    }
  }

  async function remove() {
    if (!confirm(`Remove ${guestDisplayName(guest)} from the guest list?`)) return
    await proxyClient.delete(`/events/${eventId}/guests/${guest.id}`)
    onRemoved(guest.id)
  }

  const rsvp = guest.invite?.rsvpStatus

  return (
    <div className="rounded-xl bg-white/3 border border-white/8 hover:border-white/12 transition-colors p-4">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { field: 'firstName', label: 'First Name', placeholder: 'Adaeze' },
              { field: 'lastName', label: 'Last Name', placeholder: 'Okafor' },
              { field: 'email', label: 'Email', placeholder: 'email@example.com' },
              { field: 'phone', label: 'Phone', placeholder: '+1 613 555 0100' },
              { field: 'tableNumber', label: 'Table No.', placeholder: 'Table 5' },
              { field: 'note', label: 'Note', placeholder: 'Any info…' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className="block text-[10px] text-brand-500 mb-0.5">{label}</label>
                <input
                  value={editForm[field as keyof typeof editForm] as string}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  placeholder={placeholder}
                  className="w-full text-xs bg-white/6 border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              onClick={() =>
                setEditForm((prev) => ({ ...prev, plusOneAllowed: !prev.plusOneAllowed }))
              }
              className={cn(
                'w-8 h-4 rounded-full transition-colors relative shrink-0',
                editForm.plusOneAllowed ? 'bg-gold-600' : 'bg-white/10',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                  editForm.plusOneAllowed ? 'left-4' : 'left-0.5',
                )}
              />
            </button>
            <span className="text-xs text-brand-400">Plus one allowed</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(save)}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-600/15 hover:bg-gold-600/25 border border-gold-500/30 text-gold-300 text-xs font-medium transition-colors disabled:opacity-40"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/4 border border-white/10 text-brand-400 text-xs hover:text-brand-200 transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            {/* Avatar initial */}
            <div className="w-8 h-8 rounded-full bg-gold-600/20 border border-gold-500/30 flex items-center justify-center shrink-0 text-gold-400 font-semibold text-sm">
              {guest.firstName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{guestDisplayName(guest)}</p>
                {rsvpBadge(rsvp)}
                {guest.plusOneAllowed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-700/40 border border-brand-500/30 text-brand-400">
                    +1
                  </span>
                )}
                {guest.tableNumber && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/6 border border-white/10 text-brand-400">
                    {guest.tableNumber}
                  </span>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {guest.email && (
                  <span className="text-xs text-brand-400 flex items-center gap-1">
                    <Mail size={9} /> {guest.email}
                  </span>
                )}
                {guest.phone && (
                  <span className="text-xs text-brand-400 flex items-center gap-1">
                    <Phone size={9} /> {guest.phone}
                  </span>
                )}
              </div>

              {guest.note && (
                <p className="text-xs text-brand-500 mt-0.5 italic">{guest.note}</p>
              )}

              {/* RSVP response details */}
              {guest.invite?.rsvpStatus === 'ATTENDING' && (
                <div className="mt-1.5 space-y-0.5">
                  {guest.invite.plusOneName && (
                    <p className="text-xs text-brand-400">
                      Plus one: <span className="text-brand-200">{guest.invite.plusOneName}</span>
                    </p>
                  )}
                  {guest.invite.dietaryNote && (
                    <p className="text-xs text-brand-400">
                      Dietary: <span className="text-brand-200">{guest.invite.dietaryNote}</span>
                    </p>
                  )}
                  {guest.invite.guestMessage && (
                    <p className="text-xs text-brand-400 italic">
                      "{guest.invite.guestMessage}"
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {canEdit('GUESTS') && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setShowInvite((v) => !v); setIsEditing(false) }}
                title="Send invite"
                className="p-1.5 rounded-lg text-brand-400 hover:text-gold-300 hover:bg-gold-600/10 transition-colors"
              >
                <Send size={13} />
              </button>
              <button
                onClick={() => { setIsEditing(true); setShowInvite(false) }}
                title="Edit guest"
                className="p-1.5 rounded-lg text-brand-400 hover:text-brand-200 hover:bg-white/6 transition-colors"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => startTransition(remove)}
                disabled={isPending}
                title="Remove guest"
                className="p-1.5 rounded-lg text-brand-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                <Trash2 size={13} />
              </button>
            </div>
            )}
          </div>

          {showInvite && canEdit('GUESTS') && (
            <div className="mt-3">
              <InvitePanel
                guest={guest}
                eventId={eventId}
                onSent={(updated) => {
                  onUpdated(updated)
                  setShowInvite(false)
                }}
                onClose={() => setShowInvite(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Bulk Invite Bar ────────────────────────────────────────────────────────

function BulkInviteBar({
  selected,
  guests,
  eventId,
  onDone,
  onClear,
}: {
  selected: Set<string>
  guests: Guest[]
  eventId: string
  onDone: (updatedGuests: Guest[]) => void
  onClear: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [via, setVia] = useState<InviteVia>('email')
  const [customNote, setCustomNote] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [results, setResults] = useState<{ guestId: string; success: boolean; error?: string }[] | null>(null)

  const selectedGuests = guests.filter((g) => selected.has(g.id))
  const canEmail = selectedGuests.some((g) => g.email)
  const canSms = selectedGuests.some((g) => g.phone)

  async function sendAll() {
    const { data: res } = await proxyClient.post<{ guestId: string; success: boolean; error?: string }[]>(
      `/events/${eventId}/guests/bulk-invite`,
      { guestIds: Array.from(selected), via, customNote: customNote.trim() || undefined },
    )
    setResults(res)
    const { data: updatedGuests } = await proxyClient.get<Guest[]>(`/events/${eventId}/guests`)
    onDone(updatedGuests)
  }

  if (results) {
    const ok = results.filter((r) => r.success).length
    const fail = results.filter((r) => !r.success).length
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 flex items-center gap-3">
        <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">
          {ok} invite{ok !== 1 ? 's' : ''} sent{fail > 0 ? `, ${fail} failed` : ''}.
        </p>
        <button onClick={onClear} className="ml-auto text-brand-500 hover:text-brand-300">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-gold-600/8 border border-gold-500/25 p-3 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gold-300 font-medium">
          {selected.size} guest{selected.size !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-1.5">
          {(['email', 'sms', 'both'] as const).map((opt) => {
            const disabled = (opt === 'email' && !canEmail) || (opt === 'sms' && !canSms) || (opt === 'both' && (!canEmail || !canSms))
            return (
              <button
                key={opt}
                onClick={() => !disabled && setVia(opt)}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors',
                  via === opt && !disabled
                    ? 'bg-gold-600/25 border-gold-500/50 text-gold-200'
                    : 'bg-white/4 border-white/10 text-brand-400 hover:text-brand-200 disabled:opacity-30 disabled:cursor-not-allowed',
                )}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-brand-400 hover:text-brand-200"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="Optional personal message for all selected guests…"
          rows={2}
          className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors resize-none"
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={() => startTransition(sendAll)}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-600/15 hover:bg-gold-600/25 border border-gold-500/30 text-gold-300 text-xs font-medium transition-colors disabled:opacity-40"
        >
          <Send size={12} /> {isPending ? 'Sending…' : `Send ${selected.size} Invite${selected.size !== 1 ? 's' : ''}`}
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1.5 rounded-lg bg-white/4 border border-white/10 text-brand-400 text-xs hover:text-brand-200 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function GuestsClient({ eventId, initialGuests, event }: Props) {
  const { canEdit } = useEventAccess()
  const [guests, setGuests] = useState<Guest[]>(initialGuests)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // ── Stats ──────────────────────────────────────────────────────────────────

  const attending = guests.filter((g) => g.invite?.rsvpStatus === 'ATTENDING').length
  const declined = guests.filter((g) => g.invite?.rsvpStatus === 'DECLINED').length
  const awaiting = guests.filter((g) => g.invite?.rsvpStatus === 'PENDING').length
  const notInvited = guests.filter((g) => !g.invite).length

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = guests.filter((g) => {
    const name = guestDisplayName(g).toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) ||
      g.email?.includes(search) || g.phone?.includes(search)

    const status = g.invite?.rsvpStatus ?? 'NONE'
    const matchFilter =
      filterStatus === 'all' ||
      (filterStatus === 'attending' && status === 'ATTENDING') ||
      (filterStatus === 'declined' && status === 'DECLINED') ||
      (filterStatus === 'awaiting' && status === 'PENDING') ||
      (filterStatus === 'not_invited' && !g.invite)

    return matchSearch && matchFilter
  })

  // ── Callbacks ──────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((g) => g.id)))
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: guests.length, color: 'text-white' },
          { label: 'Attending', value: attending, color: 'text-emerald-400' },
          { label: 'Declined', value: declined, color: 'text-red-400' },
          { label: 'Awaiting', value: awaiting + notInvited, color: 'text-gold-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-white/4 border border-white/8 px-4 py-3 text-center">
            <p className={cn('text-2xl font-semibold', color)}>{value}</p>
            <p className="text-xs text-brand-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests…"
            className="w-full text-sm bg-white/4 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/40 transition-colors"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 text-brand-200 focus:outline-none focus:border-gold-500/40 transition-colors [color-scheme:dark] sm:w-40"
        >
          <option value="all">All guests</option>
          <option value="attending">Attending</option>
          <option value="declined">Declined</option>
          <option value="awaiting">Awaiting RSVP</option>
          <option value="not_invited">Not invited</option>
        </select>

        {canEdit('GUESTS') && (
        <button
          onClick={() => setShowAdd((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
            showAdd
              ? 'bg-gold-600/20 border-gold-500/40 text-gold-200'
              : 'bg-gold-600/10 hover:bg-gold-600/20 border-gold-500/25 text-gold-400',
          )}
        >
          <UserPlus size={14} />
          Add Guest
        </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <AddGuestForm
          eventId={eventId}
          onAdded={(g) => {
            setGuests((prev) => [...prev, g])
            setShowAdd(false)
          }}
        />
      )}

      {/* Bulk invite bar */}
      {canEdit('GUESTS') && selected.size > 0 && (
        <BulkInviteBar
          selected={selected}
          guests={guests}
          eventId={eventId}
          onDone={(updated) => {
            setGuests(updated)
            setSelected(new Set())
          }}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Guest list */}
      <div>
        {filtered.length > 0 && canEdit('GUESTS') && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-200 transition-colors"
            >
              <div className={cn(
                'w-3.5 h-3.5 rounded border transition-colors',
                selected.size === filtered.length && filtered.length > 0
                  ? 'bg-gold-500 border-gold-500'
                  : 'border-white/20',
              )} />
              {selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-brand-500">
              {filtered.length} guest{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white/2 border border-white/6">
              <Users size={28} className="mx-auto mb-3 text-brand-600" />
              <p className="text-brand-400 text-sm">
                {guests.length === 0
                  ? 'No guests yet. Add your first guest above.'
                  : 'No guests match your search or filter.'}
              </p>
            </div>
          ) : (
            filtered.map((guest) => (
              <div key={guest.id} className="flex gap-2">
                {canEdit('GUESTS') && (
                <button
                  onClick={() => toggleSelect(guest.id)}
                  className="mt-4 shrink-0"
                  aria-label="Select guest"
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded border transition-colors',
                    selected.has(guest.id) ? 'bg-gold-500 border-gold-500' : 'border-white/20',
                  )} />
                </button>
                )}
                <div className="flex-1">
                  <GuestRow
                    guest={guest}
                    eventId={eventId}
                    onUpdated={(updated) =>
                      setGuests((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
                    }
                    onRemoved={(id) => setGuests((prev) => prev.filter((g) => g.id !== id))}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
