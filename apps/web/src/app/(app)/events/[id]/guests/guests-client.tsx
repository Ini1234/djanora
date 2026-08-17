'use client'

import { useState, useTransition } from 'react'
import {
  UserPlus,
  Trash2,
  Mail,
  Send,
  Check,
  X,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Edit2,
  Phone,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
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
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
          <CheckCircle2 size={9} /> Attending
        </span>
      )
    case 'DECLINED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
          <XCircle size={9} /> Declined
        </span>
      )
    case 'MAYBE':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
          <HelpCircle size={9} /> Maybe
        </span>
      )
    case 'PENDING':
      return (
        <span className="bg-brand-600/20 border-brand-500/30 text-brand-400 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
          <Clock size={9} /> Awaiting
        </span>
      )
    default:
      return (
        <span className="text-brand-500 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-1.5 py-0.5 text-[10px]">
          Not invited
        </span>
      )
  }
}

// ─── Add Guest Form ─────────────────────────────────────────────────────────

function AddGuestForm({ eventId, onAdded }: { eventId: string; onAdded: (g: Guest) => void }) {
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
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        note: '',
        plusOneAllowed: false,
        tableNumber: '',
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add guest')
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
        <UserPlus size={15} className="text-gold-400" /> Add Guest
      </h3>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-brand-400 mb-1 block text-xs">First Name *</label>
          <input
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            placeholder="Adaeze"
            className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-brand-400 mb-1 block text-xs">Last Name</label>
          <input
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            placeholder="Okafor"
            className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-brand-400 mb-1 block text-xs">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="adaeze@example.com"
            className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-brand-400 mb-1 block text-xs">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+1 613 555 0100"
            className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-brand-400 mb-1 block text-xs">Table No.</label>
          <input
            value={form.tableNumber}
            onChange={(e) => update('tableNumber', e.target.value)}
            placeholder="Table 5"
            className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <button
              type="button"
              onClick={() => update('plusOneAllowed', !form.plusOneAllowed)}
              className={cn(
                'relative h-5 w-10 rounded-full transition-colors',
                form.plusOneAllowed ? 'bg-gold-600' : 'bg-white/10',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                  form.plusOneAllowed ? 'left-5' : 'left-0.5',
                )}
              />
            </button>
            <span className="text-brand-300 text-sm">Plus one allowed</span>
          </label>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-brand-400 mb-1 block text-xs">Note</label>
        <input
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          placeholder="Dietary requirements, relationship, etc."
          className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
        />
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <button
        onClick={() => startTransition(submit)}
        disabled={isPending}
        className="bg-gold-600/15 hover:bg-gold-600/25 border-gold-500/30 text-gold-300 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
      const { data: updated } = await proxyClient.post<Guest>(
        `/events/${eventId}/guests/${guest.id}/invite`,
        {
          via,
          customNote: customNote.trim() || undefined,
        },
      )
      onSent(updated)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
        <Check size={16} className="shrink-0 text-emerald-400" />
        <p className="text-sm text-emerald-300">Invite sent to {guestDisplayName(guest)}!</p>
        <button onClick={onClose} className="text-brand-500 hover:text-brand-300 ml-auto">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Send invite to {guestDisplayName(guest)}</p>
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
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                via === opt && !disabled
                  ? 'bg-gold-600/20 border-gold-500/40 text-gold-300'
                  : 'text-brand-400 hover:text-brand-200 border-white/10 bg-white/4 disabled:cursor-not-allowed disabled:opacity-30',
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
        <label className="text-brand-400 mb-1 block text-xs">Personal message (optional)</label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="We'd love to see you there! Please RSVP by…"
          rows={2}
          className="placeholder:text-brand-500 focus:border-gold-500/50 w-full resize-none rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={() => startTransition(send)}
        disabled={isPending || (!canEmail && !canSms)}
        className="bg-gold-600/15 hover:bg-gold-600/25 border-gold-500/30 text-gold-300 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
      const { data: updated } = await proxyClient.patch<Guest>(
        `/events/${eventId}/guests/${guest.id}`,
        {
          firstName: editForm.firstName.trim() || guest.firstName,
          lastName: editForm.lastName.trim() || undefined,
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          note: editForm.note.trim() || undefined,
          tableNumber: editForm.tableNumber.trim() || undefined,
          plusOneAllowed: editForm.plusOneAllowed,
        },
      )
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
    <div className="rounded-xl border border-white/8 bg-white/3 p-4 transition-colors hover:border-white/12">
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
                <label className="text-brand-500 mb-0.5 block text-[10px]">{label}</label>
                <input
                  value={editForm[field as keyof typeof editForm] as string}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setEditForm((prev) => ({ ...prev, plusOneAllowed: !prev.plusOneAllowed }))
              }
              className={cn(
                'relative h-4 w-8 shrink-0 rounded-full transition-colors',
                editForm.plusOneAllowed ? 'bg-gold-600' : 'bg-white/10',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
                  editForm.plusOneAllowed ? 'left-4' : 'left-0.5',
                )}
              />
            </button>
            <span className="text-brand-400 text-xs">Plus one allowed</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(save)}
              disabled={isPending}
              className="bg-gold-600/15 hover:bg-gold-600/25 border-gold-500/30 text-gold-300 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="text-brand-400 hover:text-brand-200 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            {/* Avatar initial */}
            <div className="bg-gold-600/20 border-gold-500/30 text-gold-400 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
              {guest.firstName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{guestDisplayName(guest)}</p>
                {rsvpBadge(rsvp)}
                {guest.plusOneAllowed && (
                  <span className="bg-brand-700/40 border-brand-500/30 text-brand-400 rounded-full border px-1.5 py-0.5 text-[10px]">
                    +1
                  </span>
                )}
                {guest.tableNumber && (
                  <span className="text-brand-400 rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5 text-[10px]">
                    {guest.tableNumber}
                  </span>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {guest.email && (
                  <span className="text-brand-400 flex items-center gap-1 text-xs">
                    <Mail size={9} /> {guest.email}
                  </span>
                )}
                {guest.phone && (
                  <span className="text-brand-400 flex items-center gap-1 text-xs">
                    <Phone size={9} /> {guest.phone}
                  </span>
                )}
              </div>

              {guest.note && <p className="text-brand-500 mt-0.5 text-xs italic">{guest.note}</p>}

              {/* RSVP response details */}
              {guest.invite?.rsvpStatus === 'ATTENDING' && (
                <div className="mt-1.5 space-y-0.5">
                  {guest.invite.plusOneName && (
                    <p className="text-brand-400 text-xs">
                      Plus one: <span className="text-brand-200">{guest.invite.plusOneName}</span>
                    </p>
                  )}
                  {guest.invite.dietaryNote && (
                    <p className="text-brand-400 text-xs">
                      Dietary: <span className="text-brand-200">{guest.invite.dietaryNote}</span>
                    </p>
                  )}
                  {guest.invite.guestMessage && (
                    <p className="text-brand-400 text-xs italic">
                      &ldquo;{guest.invite.guestMessage}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {canEdit('GUESTS') && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    setShowInvite((v) => !v)
                    setIsEditing(false)
                  }}
                  title="Send invite"
                  className="text-brand-400 hover:text-gold-300 hover:bg-gold-600/10 rounded-lg p-1.5 transition-colors"
                >
                  <Send size={13} />
                </button>
                <button
                  onClick={() => {
                    setIsEditing(true)
                    setShowInvite(false)
                  }}
                  title="Edit guest"
                  className="text-brand-400 hover:text-brand-200 rounded-lg p-1.5 transition-colors hover:bg-white/6"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => startTransition(remove)}
                  disabled={isPending}
                  title="Remove guest"
                  className="text-brand-500 rounded-lg p-1.5 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
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
  const [results, setResults] = useState<
    { guestId: string; success: boolean; error?: string }[] | null
  >(null)

  const selectedGuests = guests.filter((g) => selected.has(g.id))
  const canEmail = selectedGuests.some((g) => g.email)
  const canSms = selectedGuests.some((g) => g.phone)

  async function sendAll() {
    const { data: res } = await proxyClient.post<
      { guestId: string; success: boolean; error?: string }[]
    >(`/events/${eventId}/guests/bulk-invite`, {
      guestIds: Array.from(selected),
      via,
      customNote: customNote.trim() || undefined,
    })
    setResults(res)
    const { data: updatedGuests } = await proxyClient.get<Guest[]>(`/events/${eventId}/guests`)
    onDone(updatedGuests)
  }

  if (results) {
    const ok = results.filter((r) => r.success).length
    const fail = results.filter((r) => !r.success).length
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
        <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
        <p className="text-sm text-emerald-300">
          {ok} invite{ok !== 1 ? 's' : ''} sent{fail > 0 ? `, ${fail} failed` : ''}.
        </p>
        <button onClick={onClear} className="text-brand-500 hover:text-brand-300 ml-auto">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gold-600/8 border-gold-500/25 space-y-3 rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <span className="text-gold-300 text-sm font-medium">
          {selected.size} guest{selected.size !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-1.5">
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
                  'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  via === opt && !disabled
                    ? 'bg-gold-600/25 border-gold-500/50 text-gold-200'
                    : 'text-brand-400 hover:text-brand-200 border-white/10 bg-white/4 disabled:cursor-not-allowed disabled:opacity-30',
                )}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-brand-400 hover:text-brand-200 ml-auto"
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
          className="placeholder:text-brand-500 focus:border-gold-500/50 w-full resize-none rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-white transition-colors focus:outline-none"
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={() => startTransition(sendAll)}
          disabled={isPending}
          className="bg-gold-600/15 hover:bg-gold-600/25 border-gold-500/30 text-gold-300 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
        >
          <Send size={12} />{' '}
          {isPending ? 'Sending…' : `Send ${selected.size} Invite${selected.size !== 1 ? 's' : ''}`}
        </button>
        <button
          onClick={onClear}
          className="text-brand-400 hover:text-brand-200 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function GuestsClient({ eventId, initialGuests }: Props) {
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
    const matchSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      g.email?.includes(search) ||
      g.phone?.includes(search)

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
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: guests.length, color: 'text-white' },
          { label: 'Attending', value: attending, color: 'text-emerald-400' },
          { label: 'Declined', value: declined, color: 'text-red-400' },
          { label: 'Awaiting', value: awaiting + notInvited, color: 'text-gold-400' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-center"
          >
            <p className={cn('text-2xl font-semibold', color)}>{value}</p>
            <p className="text-brand-400 mt-0.5 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={13} className="text-brand-500 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests…"
            className="placeholder:text-brand-500 focus:border-gold-500/40 w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pr-3 pl-9 text-sm text-white transition-colors focus:outline-none"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-brand-200 focus:border-gold-500/40 rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 text-sm [color-scheme:dark] transition-colors focus:outline-none sm:w-40"
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
              'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
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
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="text-brand-400 hover:text-brand-200 flex items-center gap-1.5 text-xs transition-colors"
            >
              <div
                className={cn(
                  'h-3.5 w-3.5 rounded border transition-colors',
                  selected.size === filtered.length && filtered.length > 0
                    ? 'bg-gold-500 border-gold-500'
                    : 'border-white/20',
                )}
              />
              {selected.size === filtered.length && filtered.length > 0
                ? 'Deselect all'
                : 'Select all'}
            </button>
            <span className="text-brand-500 text-xs">
              {filtered.length} guest{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/6 bg-white/2 py-12 text-center">
              <Users size={28} className="text-brand-600 mx-auto mb-3" />
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
                    <div
                      className={cn(
                        'h-3.5 w-3.5 rounded border transition-colors',
                        selected.has(guest.id) ? 'bg-gold-500 border-gold-500' : 'border-white/20',
                      )}
                    />
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
