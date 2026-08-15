'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Share2, Trash2, Copy, Check, Pencil, LogOut } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import type { ChildGrant, EventJourneyStop, EventMemberRole, EventSurface } from '@/lib/api.types'
import { ALL_EVENT_SURFACES } from '@/lib/api.types'

const SURFACE_LABELS: Record<EventSurface, string> = {
  SCHEDULE: 'Schedule',
  CHECKLIST: 'Checklist',
  BUDGET: 'Budget',
  MOODBOARD: 'Mood board',
  VENDORS: 'Vendors',
  GUESTS: 'Guests',
}

const ROLE_LABELS: Record<Exclude<EventMemberRole, 'HOST'>, string> = {
  EDITOR: 'Editor',
  COMMENTER: 'Commenter',
  VIEWER: 'Viewer',
}

type MemberRole = Exclude<EventMemberRole, 'HOST'>

interface MemberRow {
  id: string
  email: string
  role: MemberRole
  surfaces: EventSurface[]
  childGrants?: ChildGrant[]
  acceptedAt: string | null
  createdAt: string
  inviteUrl?: string
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null
}

interface HostRow {
  id: string
  email: string
  user: { firstName: string | null; lastName: string | null; email: string } | null
}

function displayName(person: {
  email: string
  user: { firstName: string | null; lastName: string | null } | null
}) {
  const name = [person.user?.firstName, person.user?.lastName].filter(Boolean).join(' ')
  return name || person.email
}

function initials(person: {
  email: string
  user: { firstName: string | null; lastName: string | null } | null
}) {
  const first = person.user?.firstName?.[0]
  const last = person.user?.lastName?.[0]
  if (first || last) return `${first ?? ''}${last ?? ''}`.toUpperCase()
  return person.email.slice(0, 2).toUpperCase()
}

function toggleIn<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function RolePicker({
  value,
  onChange,
}: {
  value: MemberRole
  onChange: (role: MemberRole) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className="flex-1 text-xs py-1.5 rounded-lg border"
            style={{
              borderColor: value === r ? 'var(--color-brand-primary)' : 'var(--color-border)',
              color: value === r ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
              background: value === r ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)' : 'transparent',
            }}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
        {value === 'EDITOR' && 'Can change items on the selected pages.'}
        {value === 'COMMENTER' && 'Can view and comment — cannot change items.'}
        {value === 'VIEWER' && 'Can view only — cannot comment or change items.'}
      </p>
    </div>
  )
}

function ChildGrantPicker({
  subEvents,
  value,
  onChange,
  onToggleEvent,
}: {
  subEvents: EventJourneyStop[]
  value: ChildGrant[]
  onChange: (next: ChildGrant[]) => void
  onToggleEvent: (eventId: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
        Sub-events they can see
      </p>
      {subEvents.map((stop) => {
        const grant = value.find((g) => g.eventId === stop.id)
        return (
          <div key={stop.id} className="space-y-1.5">
            <button
              type="button"
              onClick={() => onToggleEvent(stop.id)}
              className="text-[11px] px-2 py-1 rounded-full border"
              style={{
                borderColor: grant ? 'var(--color-brand-primary)' : 'var(--color-border)',
                color: grant ? 'var(--color-brand-primary)' : 'var(--color-muted)',
                background: grant ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)' : 'transparent',
              }}
            >
              {stop.title}
            </button>
            {grant && (
              <SurfacePicker
                value={grant.surfaces}
                onToggle={(surface) => {
                  const nextSurfaces = toggleIn(grant.surfaces, surface)
                  if (nextSurfaces.length === 0) {
                    onChange(value.filter((g) => g.eventId !== stop.id))
                    return
                  }
                  onChange(value.map((g) => (g.eventId === stop.id ? { ...g, surfaces: nextSurfaces } : g)))
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SurfacePicker({
  value,
  onToggle,
}: {
  value: EventSurface[]
  onToggle: (surface: EventSurface) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_EVENT_SURFACES.map((s) => {
        const on = value.includes(s)
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            className="text-[11px] px-2 py-1 rounded-full border"
            style={{
              borderColor: on ? 'var(--color-brand-primary)' : 'var(--color-border)',
              color: on ? 'var(--color-brand-primary)' : 'var(--color-muted)',
              background: on ? 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)' : 'transparent',
            }}
          >
            {SURFACE_LABELS[s]}
          </button>
        )
      })}
    </div>
  )
}

function Avatar({ person }: { person: { email: string; user: { firstName: string | null; lastName: string | null } | null } }) {
  return (
    <span
      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
      style={{
        background: 'color-mix(in srgb, var(--color-brand-primary) 14%, transparent)',
        color: 'var(--color-brand-primary)',
      }}
    >
      {initials(person)}
    </span>
  )
}

export function EventPeopleSection({
  eventId,
  subEvents,
  isHost,
  inviteOpen,
  onInviteOpenChange,
}: {
  eventId: string
  subEvents?: EventJourneyStop[]
  isHost: boolean
  inviteOpen: boolean
  onInviteOpenChange: (open: boolean) => void
}) {
  const [host, setHost] = useState<HostRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('EDITOR')
  const [surfaces, setSurfaces] = useState<EventSurface[]>(['SCHEDULE', 'CHECKLIST'])
  const [childGrants, setChildGrants] = useState<ChildGrant[]>([])
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<MemberRole>('EDITOR')
  const [editSurfaces, setEditSurfaces] = useState<EventSurface[]>([])
  const [editChildGrants, setEditChildGrants] = useState<ChildGrant[]>([])
  const [pending, start] = useTransition()
  const router = useRouter()

  useEffect(() => {
    proxyClient
      .get<{ host: HostRow | null; members: MemberRow[] }>(`/events/${eventId}/members`)
      .then(({ data }) => {
        setHost(data.host)
        setMembers(data.members ?? [])
      })
      .catch(() => setError('Could not load people'))
      .finally(() => setLoading(false))
  }, [eventId])

  function startEdit(member: MemberRow) {
    setEditingId(member.id)
    setEditRole(member.role)
    setEditSurfaces(member.surfaces)
    setEditChildGrants(member.childGrants ?? [])
    setError('')
  }

  function toggleChildGrant(list: ChildGrant[], eventIdToToggle: string): ChildGrant[] {
    const existing = list.find((g) => g.eventId === eventIdToToggle)
    if (existing) return list.filter((g) => g.eventId !== eventIdToToggle)
    return [...list, { eventId: eventIdToToggle, surfaces: [...ALL_EVENT_SURFACES] }]
  }

  function invite() {
    setError('')
    if (!email.trim()) return
    if (surfaces.length === 0 && childGrants.length === 0) return
    start(async () => {
      try {
        const { data } = await proxyClient.post<MemberRow>(`/events/${eventId}/members`, {
          email: email.trim(),
          role,
          surfaces,
          childGrants: childGrants.length ? childGrants : undefined,
        })
        setMembers((prev) => [...prev, data])
        setEmail('')
        onInviteOpenChange(false)
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(typeof msg === 'string' ? msg : 'Could not send invite')
      }
    })
  }

  function saveEdit(memberId: string) {
    if (editSurfaces.length === 0 && editChildGrants.length === 0) return
    setError('')
    start(async () => {
      try {
        const { data } = await proxyClient.patch<MemberRow>(
          `/events/${eventId}/members/${memberId}`,
          { role: editRole, surfaces: editSurfaces, childGrants: editChildGrants },
        )
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...data } : m)))
        setEditingId(null)
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(typeof msg === 'string' ? msg : 'Could not update invite')
      }
    })
  }

  function remove(memberId: string) {
    start(async () => {
      await proxyClient.delete(`/events/${eventId}/members/${memberId}`)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      if (editingId === memberId) setEditingId(null)
    })
  }

  function leave() {
    if (!confirm('Leave this event? You will lose access until someone invites you again.')) return
    start(async () => {
      await proxyClient.post(`/events/${eventId}/leave`, {})
      router.push('/events')
    })
  }

  async function copyLink(member: MemberRow) {
    if (!member.inviteUrl) return
    await navigator.clipboard.writeText(member.inviteUrl)
    setCopiedId(member.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const pendingCount = members.filter((m) => !m.acceptedAt).length
  const acceptedCount = members.filter((m) => m.acceptedAt).length

  return (
    <section
      className="rounded-2xl overflow-hidden mb-8"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Share2 size={15} style={{ color: 'var(--color-brand-primary)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Shared with
            </h2>
          </div>
          {!loading && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {members.length === 0
                ? 'Only you so far'
                : `${acceptedCount} accepted · ${pendingCount} pending`}
            </p>
          )}
        </div>
        {isHost && (
          <button
            type="button"
            onClick={() => onInviteOpenChange(!inviteOpen)}
            className="shrink-0 h-8 px-3 rounded-lg text-xs font-semibold"
            style={{
              background: inviteOpen ? 'transparent' : 'var(--color-brand-primary)',
              color: inviteOpen ? 'var(--color-text-secondary)' : '#fff',
              border: inviteOpen ? '1px solid var(--color-border)' : 'none',
            }}
          >
            {inviteOpen ? 'Cancel' : 'Invite'}
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin" size={18} style={{ color: 'var(--color-brand-primary)' }} />
          </div>
        ) : (
          <>
            {isHost && inviteOpen && (
              <div
                className="space-y-3 rounded-xl px-3 py-3"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  We&apos;ll email them a join link. They need to sign in with that same email.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full text-sm rounded-xl px-3 py-2 focus:outline-none"
                  style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <RolePicker value={role} onChange={setRole} />
                <SurfacePicker value={surfaces} onToggle={(s) => setSurfaces((prev) => toggleIn(prev, s))} />
                {(subEvents?.length ?? 0) > 0 && (
                  <ChildGrantPicker
                    subEvents={subEvents ?? []}
                    value={childGrants}
                    onChange={setChildGrants}
                    onToggleEvent={(id) => setChildGrants((prev) => toggleChildGrant(prev, id))}
                  />
                )}
                <button
                  type="button"
                  disabled={pending || !email.trim() || (surfaces.length === 0 && childGrants.length === 0)}
                  onClick={invite}
                  className="w-full h-9 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
                >
                  {pending ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            )}

            {error && <p className="text-xs" style={{ color: 'var(--color-error, #c45c4a)' }}>{error}</p>}

            {host && (
              <div className="flex items-center gap-3">
                <Avatar person={host} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {displayName(host)}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--color-muted)' }}>{host.email}</p>
                </div>
                <span
                  className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{
                    color: 'var(--color-brand-primary)',
                    background: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
                  }}
                >
                  Host
                </span>
              </div>
            )}

            {members.map((m) => {
              const accepted = Boolean(m.acceptedAt)
              const editing = editingId === m.id
              return (
                <div key={m.id} className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <Avatar person={m} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {displayName(m)}
                        </p>
                        <span
                          className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={
                            accepted
                              ? { color: '#3d7a4a', background: 'rgba(61, 122, 74, 0.12)' }
                              : {
                                  color: 'var(--color-brand-primary)',
                                  background: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
                                }
                          }
                        >
                          {accepted ? 'Accepted' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-[11px] truncate" style={{ color: 'var(--color-muted)' }}>
                        {m.email} · {ROLE_LABELS[m.role]}
                        {!editing && ` · ${m.surfaces.map((s) => SURFACE_LABELS[s]).join(', ')}`}
                      </p>
                    </div>
                    {isHost && !editing && (
                      <div className="flex items-center shrink-0">
                        {!accepted && m.inviteUrl && (
                          <button
                            type="button"
                            onClick={() => copyLink(m)}
                            className="p-1.5 rounded-lg hover:opacity-70"
                            style={{ color: 'var(--color-muted)' }}
                            aria-label="Copy invite link"
                          >
                            {copiedId === m.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="p-1.5 rounded-lg hover:opacity-70"
                          style={{ color: 'var(--color-muted)' }}
                          aria-label="Edit invite"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(m.id)}
                          className="p-1.5 rounded-lg hover:opacity-70"
                          style={{ color: 'var(--color-muted)' }}
                          aria-label="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isHost && editing && (
                    <div className="pl-11 space-y-2.5">
                      <RolePicker value={editRole} onChange={setEditRole} />
                      <SurfacePicker
                        value={editSurfaces}
                        onToggle={(s) => setEditSurfaces((prev) => toggleIn(prev, s))}
                      />
                      {(subEvents?.length ?? 0) > 0 && (
                        <ChildGrantPicker
                          subEvents={subEvents ?? []}
                          value={editChildGrants}
                          onChange={setEditChildGrants}
                          onToggleEvent={(id) => setEditChildGrants((prev) => toggleChildGrant(prev, id))}
                        />
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="h-8 px-3 rounded-lg text-xs"
                          style={{ color: 'var(--color-muted)' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={pending || (editSurfaces.length === 0 && editChildGrants.length === 0)}
                          onClick={() => saveEdit(m.id)}
                          className="h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-40"
                          style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
                        >
                          {pending ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {!isHost && (
              <button
                type="button"
                disabled={pending}
                onClick={leave}
                className="flex items-center gap-1.5 text-xs mt-2 hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--color-muted)' }}
              >
                <LogOut size={12} />
                Leave event
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
