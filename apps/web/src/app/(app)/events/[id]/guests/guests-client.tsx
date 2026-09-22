'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import {
  UserPlus,
  Trash2,
  Mail,
  Send,
  Check,
  X,
  Clock,
  Users,
  ChevronRight,
  Edit2,
  Phone,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Link2,
} from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import type { Event, Guest, GuestUnlockLink } from '@/lib/api.types'
import { useEventAccess } from '../event-access-context'
import { TableSkeleton } from '@/components/ui/skeleton'
import { DataPortMenu } from '@/components/data-port-menu'
import { useDjanChatLauncher } from '@/components/assistant/djan-chat-context'
import { GUEST_HEADERS, guestExportRows } from '@/lib/data-port-maps'
import { fileBase } from '@/lib/sheet-io'
import { DJAN_EVENT_REFRESH } from '@/components/assistant/djan-nav'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  eventId: string
  initialGuests?: Guest[]
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
        <span className="border-success/30 bg-success/15 text-success inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
          <CheckCircle2 size={9} /> Attending
        </span>
      )
    case 'DECLINED':
      return (
        <span className="border-danger/30 bg-danger/15 text-danger inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
          <XCircle size={9} /> Declined
        </span>
      )
    case 'MAYBE':
      return (
        <span className="border-warning/30 bg-warning/15 text-warning inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
          <HelpCircle size={9} /> Maybe
        </span>
      )
    case 'PENDING':
      return (
        <span className="bg-hover border-border text-muted inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
          <Clock size={9} /> Awaiting
        </span>
      )
    default:
      return (
        <span className="text-muted border-border bg-hover inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]">
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
    <div className="border-border bg-surface rounded-2xl border p-5">
      <h3 className="text-fg mb-4 flex items-center gap-2 font-semibold">
        <UserPlus size={15} className="text-primary" /> Add Guest
      </h3>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-muted mb-1 block text-xs">First Name *</label>
          <input
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            placeholder="Adaeze"
            className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs">Last Name</label>
          <input
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            placeholder="Okafor"
            className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="adaeze@example.com"
            className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+1 613 555 0100"
            className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
          />
        </div>
        <div>
          <label className="text-muted mb-1 block text-xs">Table No.</label>
          <input
            value={form.tableNumber}
            onChange={(e) => update('tableNumber', e.target.value)}
            placeholder="Table 5"
            className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <button
              type="button"
              onClick={() => update('plusOneAllowed', !form.plusOneAllowed)}
              className={cn(
                'relative h-5 w-10 rounded-full transition-colors',
                form.plusOneAllowed ? 'bg-primary' : 'bg-hover',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                  form.plusOneAllowed ? 'left-5' : 'left-0.5',
                )}
              />
            </button>
            <span className="text-muted text-sm">Plus one allowed</span>
          </label>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-muted mb-1 block text-xs">Note</label>
        <input
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          placeholder="Dietary requirements, relationship, etc."
          className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
        />
      </div>

      {error && <p className="text-danger mb-3 text-xs">{error}</p>}

      <button
        onClick={() => startTransition(submit)}
        disabled={isPending}
        className="bg-primary/15 hover:bg-primary/25 border-primary/30 text-primary flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
      <div className="border-success/25 bg-success/10 flex items-center gap-3 rounded-xl border p-4">
        <Check size={16} className="text-success shrink-0" />
        <p className="text-success text-sm">Invite sent to {guestDisplayName(guest)}!</p>
        <button onClick={onClose} className="text-muted hover:text-fg ml-auto">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="border-border bg-surface space-y-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-fg min-w-0 text-sm font-medium break-words">
          Send invite to {guestDisplayName(guest)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-target text-muted hover:text-fg inline-flex shrink-0 items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
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
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'text-muted hover:text-fg border-border bg-surface disabled:cursor-not-allowed disabled:opacity-30',
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
        <label className="text-muted mb-1 block text-xs">Personal message (optional)</label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="We'd love to see you there! Please RSVP by…"
          rows={2}
          className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full resize-none rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
        />
      </div>

      {error && <p className="text-danger text-xs">{error}</p>}

      <button
        onClick={() => startTransition(send)}
        disabled={isPending || (!canEmail && !canSms)}
        className="bg-primary/15 hover:bg-primary/25 border-primary/30 text-primary flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send size={13} />
        {isPending ? 'Sending…' : 'Send Invite'}
      </button>

      {!canEmail && !canSms && (
        <p className="text-danger text-xs">Add an email or phone number to send an invite.</p>
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
  const [unlockNote, setUnlockNote] = useState('')
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

  async function copyUnlockLink() {
    setUnlockNote('')
    try {
      const { data } = await proxyClient.post<GuestUnlockLink>(
        `/events/${eventId}/guests/${guest.id}/unlock-link`,
      )
      const ok = await copyText(data.url)
      setUnlockNote(
        ok
          ? `Copied. If they need the code: ${data.code}`
          : `Copy this link: ${data.url}. If they need the code: ${data.code}`,
      )
    } catch {
      setUnlockNote('Could not copy their site link.')
    }
  }

  async function remove() {
    if (!confirm(`Remove ${guestDisplayName(guest)} from the guest list?`)) return
    await proxyClient.delete(`/events/${eventId}/guests/${guest.id}`)
    onRemoved(guest.id)
  }

  const rsvp = guest.invite?.rsvpStatus

  return (
    <div className="border-border bg-surface hover:border-border rounded-xl border p-4 transition-colors">
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
                <label className="text-muted mb-0.5 block text-[10px]">{label}</label>
                <input
                  value={editForm[field as keyof typeof editForm] as string}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
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
                editForm.plusOneAllowed ? 'bg-primary' : 'bg-hover',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
                  editForm.plusOneAllowed ? 'left-4' : 'left-0.5',
                )}
              />
            </button>
            <span className="text-muted text-xs">Plus one allowed</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(save)}
              disabled={isPending}
              className="bg-primary/15 hover:bg-primary/25 border-primary/30 text-primary flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="text-muted hover:text-fg border-border bg-surface flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            {/* Avatar initial */}
            <div className="bg-primary/15 border-primary/30 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
              {guest.firstName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-fg text-sm font-medium">{guestDisplayName(guest)}</p>
                {rsvpBadge(rsvp)}
                {guest.plusOneAllowed && (
                  <span className="bg-hover border-border text-muted rounded-full border px-1.5 py-0.5 text-[10px]">
                    +1
                  </span>
                )}
                {guest.tableNumber && (
                  <span className="text-muted border-border bg-input rounded-full border px-1.5 py-0.5 text-[10px]">
                    {guest.tableNumber}
                  </span>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {guest.email && (
                  <span className="text-muted flex items-center gap-1 text-xs">
                    <Mail size={9} /> {guest.email}
                  </span>
                )}
                {guest.phone && (
                  <span className="text-muted flex items-center gap-1 text-xs">
                    <Phone size={9} /> {guest.phone}
                  </span>
                )}
              </div>

              {guest.note && <p className="text-muted mt-0.5 text-xs italic">{guest.note}</p>}
              {unlockNote && <p className="text-muted mt-1 text-xs">{unlockNote}</p>}

              {/* RSVP response details */}
              {guest.invite?.rsvpStatus === 'ATTENDING' && (
                <div className="mt-1.5 space-y-0.5">
                  {guest.invite.plusOneName && (
                    <p className="text-muted text-xs">
                      Plus one: <span className="text-fg">{guest.invite.plusOneName}</span>
                    </p>
                  )}
                  {guest.invite.dietaryNote && (
                    <p className="text-muted text-xs">
                      Dietary: <span className="text-fg">{guest.invite.dietaryNote}</span>
                    </p>
                  )}
                  {guest.invite.guestMessage && (
                    <p className="text-muted text-xs italic">
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
                    void copyUnlockLink()
                    setShowInvite(false)
                    setIsEditing(false)
                  }}
                  title="Copy site link"
                  className="text-muted hover:text-primary hover:bg-primary/10 rounded-lg p-1.5 transition-colors"
                >
                  <Link2 size={13} />
                </button>
                <button
                  onClick={() => {
                    setShowInvite((v) => !v)
                    setIsEditing(false)
                  }}
                  title="Send invite"
                  className="text-muted hover:text-primary hover:bg-primary/10 rounded-lg p-1.5 transition-colors"
                >
                  <Send size={13} />
                </button>
                <button
                  onClick={() => {
                    setIsEditing(true)
                    setShowInvite(false)
                  }}
                  title="Edit guest"
                  className="text-muted hover:text-fg hover:bg-hover rounded-lg p-1.5 transition-colors"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => startTransition(remove)}
                  disabled={isPending}
                  title="Remove guest"
                  className="text-muted hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 transition-colors disabled:opacity-40"
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
      <div className="border-success/25 bg-success/10 flex items-center gap-3 rounded-xl border p-3">
        <CheckCircle2 size={15} className="text-success shrink-0" />
        <p className="text-success text-sm">
          {ok} invite{ok !== 1 ? 's' : ''} sent{fail > 0 ? `, ${fail} failed` : ''}.
        </p>
        <button onClick={onClear} className="text-muted hover:text-fg ml-auto">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-primary/10 border-primary/25 space-y-3 rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label="Optional personal message"
          className="text-primary hover:text-fg shrink-0"
        >
          <ChevronRight size={14} className={cn('transition-transform', expanded && 'rotate-90')} />
        </button>
        <span className="text-primary text-sm font-medium">
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
                    ? 'bg-primary/25 border-primary/50 text-primary'
                    : 'text-muted hover:text-fg border-border bg-surface disabled:cursor-not-allowed disabled:opacity-30',
                )}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {expanded && (
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="Optional personal message for all selected guests…"
          rows={2}
          className="placeholder:text-muted focus:border-primary/50 border-border bg-input text-fg w-full resize-none rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={() => startTransition(sendAll)}
          disabled={isPending}
          className="bg-primary/15 hover:bg-primary/25 border-primary/30 text-primary flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
        >
          <Send size={12} />{' '}
          {isPending ? 'Sending…' : `Send ${selected.size} Invite${selected.size !== 1 ? 's' : ''}`}
        </button>
        <button
          onClick={onClear}
          className="text-muted hover:text-fg border-border bg-surface rounded-lg border px-3 py-1.5 text-xs transition-colors"
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
  const { openChat } = useDjanChatLauncher()
  const [guests, setGuests] = useState<Guest[]>(initialGuests ?? [])
  const [loading, setLoading] = useState(!initialGuests)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    const load = () => {
      proxyClient
        .get<Guest[]>(`/events/${eventId}/guests`)
        .then(({ data }) => {
          if (!cancelled) setGuests(Array.isArray(data) ? data : [])
        })
        .catch(() => {
          if (!cancelled) setGuests([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    if (!initialGuests) load()
    window.addEventListener(DJAN_EVENT_REFRESH, load)
    return () => {
      cancelled = true
      window.removeEventListener(DJAN_EVENT_REFRESH, load)
    }
  }, [eventId, initialGuests])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const { attending, declined, awaiting, notInvited } = useMemo(() => {
    return {
      attending: guests.filter((g) => g.invite?.rsvpStatus === 'ATTENDING').length,
      declined: guests.filter((g) => g.invite?.rsvpStatus === 'DECLINED').length,
      awaiting: guests.filter((g) => g.invite?.rsvpStatus === 'PENDING').length,
      notInvited: guests.filter((g) => !g.invite).length,
    }
  }, [guests])

  const filtered = useMemo(() => {
    return guests.filter((g) => {
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
  }, [guests, search, filterStatus])

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
          { label: 'Total', value: guests.length, color: 'text-fg' },
          { label: 'Attending', value: attending, color: 'text-success' },
          { label: 'Declined', value: declined, color: 'text-danger' },
          { label: 'Awaiting', value: awaiting + notInvited, color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="border-border bg-surface rounded-xl border px-4 py-3 text-center"
          >
            <p className={cn('text-2xl font-semibold', color)}>{value}</p>
            <p className="text-muted mt-0.5 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={13} className="text-muted absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests…"
            className="placeholder:text-muted focus:border-primary/40 border-border bg-surface text-fg w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm transition-colors focus:outline-none"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-fg focus:border-primary/40 border-border bg-surface rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none sm:w-40"
        >
          <option value="all">All guests</option>
          <option value="attending">Attending</option>
          <option value="declined">Declined</option>
          <option value="awaiting">Awaiting RSVP</option>
          <option value="not_invited">Not invited</option>
        </select>

        <DataPortMenu
          fileBase={fileBase(event.title, 'guests')}
          sheetName="Guests"
          headers={GUEST_HEADERS}
          rows={guestExportRows(guests)}
          canImport={canEdit('GUESTS')}
          triggerClassName="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-hover"
          onAskDjan={({ filename, grid, truncated }) => {
            openChat({
              eventId,
              sheet: { kind: 'guests', filename, grid, truncated },
            })
          }}
        />

        {canEdit('GUESTS') && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
              showAdd
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-primary/10 hover:bg-primary/20 border-primary/25 text-primary',
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
              className="text-muted hover:text-fg flex items-center gap-1.5 text-xs transition-colors"
            >
              <div
                className={cn(
                  'h-3.5 w-3.5 rounded border transition-colors',
                  selected.size === filtered.length && filtered.length > 0
                    ? 'bg-primary border-primary'
                    : 'border-border',
                )}
              />
              {selected.size === filtered.length && filtered.length > 0
                ? 'Deselect all'
                : 'Select all'}
            </button>
            <span className="text-muted text-xs">
              {filtered.length} guest{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <TableSkeleton rows={6} cols={3} />
          ) : filtered.length === 0 ? (
            <div className="border-border bg-surface rounded-2xl border py-12 text-center">
              <Users size={28} className="text-muted mx-auto mb-3" />
              <p className="text-muted text-sm">
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
                        selected.has(guest.id) ? 'bg-primary border-primary' : 'border-border',
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
