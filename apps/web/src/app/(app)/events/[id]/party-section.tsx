'use client'

import { useState, useTransition } from 'react'
import { Check, Heart, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { getErrorMessage } from '@/lib/errors'
import { useEventGet } from '@/lib/use-event-get'
import { TableSkeleton } from '@/components/ui/skeleton'
import type {
  EventPartyMember,
  EventPartyRoster,
  EventPartySide,
  EventPartyStatus,
} from '@/lib/api.types'
import { PartyPhoto } from './party-photo'
import { removePartyPhoto, uploadPartyPhoto } from './site/party-editor'
import { SiteFileButton } from './site/site-file-button'

const fieldStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
} as const

const SIDES: { id: EventPartySide; label: string }[] = [
  { id: 'BRIDE', label: 'Bride' },
  { id: 'GROOM', label: 'Groom' },
  { id: 'OTHER', label: 'Other' },
]

const STATUSES: { id: EventPartyStatus; label: string }[] = [
  { id: 'PENDING', label: 'Asked' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'DECLINED', label: 'Declined' },
]

const ROLE_HINTS: Record<EventPartySide, string[]> = {
  BRIDE: ['Maid of Honor', 'Matron of Honor', 'Bridesmaid', 'Flower Girl', 'Mother of the Bride'],
  GROOM: ['Best Man', 'Groomsman', 'Page Boy', 'Ring Bearer', 'Father of the Groom'],
  OTHER: ['Officiant', 'Usher', 'Coordinator', 'Host', 'Reader'],
}

function statusLabel(status: EventPartyStatus) {
  return STATUSES.find((row) => row.id === status)?.label ?? status
}

function partnerName(members: EventPartyMember[], member: EventPartyMember) {
  if (!member.pairedWithId) return null
  return members.find((row) => row.id === member.pairedWithId)?.name ?? null
}

function emptyDraft(): {
  name: string
  role: string
  side: EventPartySide
  photo: File | null
} {
  return { name: '', role: '', side: 'OTHER', photo: null }
}

export function PartySection({
  eventId,
  onCollapse,
}: {
  eventId: string
  onCollapse?: () => void
}) {
  const { data, setData, loading } = useEventGet<EventPartyRoster>(`/events/${eventId}/party`)
  const [draft, setDraft] = useState(emptyDraft)
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const members = data?.members ?? []
  const canEdit = data?.canEdit !== false

  function apply(next: EventPartyRoster) {
    setData(next)
  }

  function run(work: () => Promise<EventPartyRoster>) {
    startTransition(async () => {
      setError('')
      try {
        apply(await work())
      } catch (err) {
        setError(getErrorMessage(err, 'Could not update the wedding party'))
      }
    })
  }

  function addMember() {
    const name = draft.name.trim()
    if (!name) {
      setError('Add a name first')
      return
    }
    run(async () => {
      const { data: created } = await proxyClient.post<EventPartyRoster>(
        `/events/${eventId}/party`,
        {
          name,
          role: draft.role.trim(),
          side: draft.side,
        },
      )
      const known = new Set(members.map((row) => row.id))
      const added = created.members.find((row) => !known.has(row.id))
      const next =
        draft.photo && added ? await uploadPartyPhoto(eventId, added.id, draft.photo) : created
      setDraft(emptyDraft())
      setAdding(false)
      setOpenId(null)
      return next
    })
  }

  function patch(
    memberId: string,
    body: Partial<EventPartyMember> & { pairedWithId?: string | null },
  ) {
    run(async () => {
      const { data: next } = await proxyClient.patch<EventPartyRoster>(
        `/events/${eventId}/party/${memberId}`,
        body,
      )
      return next
    })
  }

  function remove(memberId: string) {
    if (!confirm('Remove this person from the wedding party?')) return
    run(async () => {
      const { data: next } = await proxyClient.delete<EventPartyRoster>(
        `/events/${eventId}/party/${memberId}`,
      )
      if (openId === memberId) setOpenId(null)
      return next
    })
  }

  async function uploadPhoto(memberId: string, file: File) {
    setError('')
    try {
      apply(await uploadPartyPhoto(eventId, memberId, file))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add that photo'))
    }
  }

  function removePhoto(memberId: string) {
    run(async () => removePartyPhoto(eventId, memberId))
  }

  const confirmed = members.filter((m) => m.status === 'CONFIRMED').length
  const grouped = SIDES.map((side) => ({
    ...side,
    members: members.filter((member) => member.side === side.id),
  })).filter((group) => group.members.length > 0)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Wedding party
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {members.length === 0
              ? 'Add who stands with you. The guest site only shows people you mark.'
              : `${confirmed} confirmed · ${members.length} on the roster`}
          </p>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex min-h-11 items-center text-xs"
            style={{ color: 'var(--color-muted)' }}
          >
            Close
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm" role="alert" style={{ color: 'var(--color-error, #c45c4a)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <TableSkeleton rows={3} />
      ) : (
        <>
          {members.length > 0 && (
            <MatchBoard
              members={members}
              canEdit={canEdit}
              onPair={(id, partnerId) => patch(id, { pairedWithId: partnerId })}
            />
          )}

          <div
            className="overflow-hidden rounded-2xl"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {members.length === 0 ? (
              <p className="px-4 py-6 text-sm" style={{ color: 'var(--color-muted)' }}>
                No one on the roster yet.
              </p>
            ) : (
              grouped.map((group, groupIndex) => (
                <div
                  key={group.id}
                  style={{
                    borderTop: groupIndex === 0 ? undefined : '1px solid var(--color-border)',
                  }}
                >
                  <p
                    className="px-4 py-2 text-[11px] font-semibold tracking-wide uppercase"
                    style={{ color: 'var(--color-muted)', background: 'var(--card-bg)' }}
                  >
                    {group.label}
                  </p>
                  <ul>
                    {group.members.map((member) => {
                      const open = openId === member.id
                      const withName = partnerName(members, member)
                      return (
                        <li key={member.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <PartyPhoto url={member.photoUrl} size={40} />
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-sm font-medium"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {member.name}
                              </p>
                              <p
                                className="truncate text-[11px]"
                                style={{ color: 'var(--color-muted)' }}
                              >
                                {[
                                  member.role || null,
                                  statusLabel(member.status),
                                  member.showOnSite ? 'On site' : null,
                                  withName ? `with ${withName}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setOpenId(open ? null : member.id)}
                                className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium"
                                style={{ color: 'var(--color-brand-primary)' }}
                                aria-expanded={open}
                              >
                                {open ? <X size={13} /> : <Pencil size={13} />}
                                {open ? 'Done' : 'Edit'}
                              </button>
                            )}
                          </div>
                          {open && (
                            <MemberEditor
                              member={member}
                              members={members}
                              pending={pending}
                              onPatch={(body) => patch(member.id, body)}
                              onUpload={(file) => void uploadPhoto(member.id, file)}
                              onRemovePhoto={() => removePhoto(member.id)}
                              onRemove={() => remove(member.id)}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {canEdit &&
            members.length < 40 &&
            (adding ? (
              <div
                className="space-y-3 rounded-2xl p-4"
                style={{ border: '1px dashed var(--color-border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    Add someone
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false)
                      setDraft(emptyDraft())
                    }}
                    className="inline-flex min-h-11 items-center text-xs"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    Cancel
                  </button>
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
                    Name
                  </span>
                  <input
                    value={draft.name}
                    maxLength={80}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className="min-h-11 w-full rounded-lg px-3 text-sm focus:outline-none"
                    style={fieldStyle}
                  />
                </label>
                <fieldset className="space-y-1">
                  <legend
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    Side
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {SIDES.map((side) => (
                      <button
                        key={side.id}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, side: side.id }))}
                        className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium"
                        style={{
                          border: '1px solid var(--color-border)',
                          background:
                            draft.side === side.id
                              ? 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)'
                              : 'transparent',
                        }}
                      >
                        {side.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
                    Role
                  </span>
                  <input
                    value={draft.role}
                    maxLength={80}
                    onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
                    className="min-h-11 w-full rounded-lg px-3 text-sm focus:outline-none"
                    style={fieldStyle}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_HINTS[draft.side].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, role }))}
                      className="inline-flex min-h-11 items-center rounded-full px-2.5 text-[11px]"
                      style={{
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-muted)',
                      }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {draft.photo ? (
                    <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
                      {draft.photo.name}
                    </span>
                  ) : null}
                  <SiteFileButton
                    label={draft.photo ? 'Replace photo' : 'Add photo'}
                    onFile={(file) => setDraft((prev) => ({ ...prev, photo: file }))}
                  />
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={addMember}
                  className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                  style={{
                    background: 'var(--color-brand-primary)',
                    color: 'var(--color-primary-foreground)',
                  }}
                >
                  {pending ? <Loader2 size={14} className="animate-spin" /> : 'Add to roster'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"
                style={{ color: 'var(--color-brand-primary)' }}
              >
                <Plus size={14} />
                Add someone
              </button>
            ))}
        </>
      )}
    </section>
  )
}

function MemberEditor({
  member,
  members,
  pending,
  onPatch,
  onUpload,
  onRemovePhoto,
  onRemove,
}: {
  member: EventPartyMember
  members: EventPartyMember[]
  pending: boolean
  onPatch: (body: Partial<EventPartyMember> & { pairedWithId?: string | null }) => void
  onUpload: (file: File) => void
  onRemovePhoto: () => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3 px-4 pb-4" style={{ background: 'var(--card-bg)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <SiteFileButton
          label={member.photoUrl ? 'Replace photo' : 'Add photo'}
          disabled={pending}
          onFile={onUpload}
        />
        {member.photoUrl && (
          <button
            type="button"
            onClick={onRemovePhoto}
            className="inline-flex min-h-11 items-center text-xs"
            style={{ color: 'var(--color-muted)' }}
          >
            Remove photo
          </button>
        )}
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Name
        </span>
        <input
          defaultValue={member.name}
          maxLength={80}
          disabled={pending}
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== member.name) onPatch({ name })
          }}
          className="min-h-11 w-full rounded-lg px-3 text-sm focus:outline-none"
          style={fieldStyle}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Role
        </span>
        <input
          defaultValue={member.role}
          maxLength={80}
          disabled={pending}
          onBlur={(e) => {
            if (e.target.value !== member.role) onPatch({ role: e.target.value })
          }}
          className="min-h-11 w-full rounded-lg px-3 text-sm focus:outline-none"
          style={fieldStyle}
        />
      </label>
      <fieldset className="space-y-1">
        <legend className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Side
        </legend>
        <div className="flex flex-wrap gap-2">
          {SIDES.map((side) => (
            <button
              key={side.id}
              type="button"
              disabled={pending}
              onClick={() => onPatch({ side: side.id })}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium"
              style={{
                border: '1px solid var(--color-border)',
                background:
                  member.side === side.id
                    ? 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)'
                    : 'transparent',
                color:
                  member.side === side.id
                    ? 'var(--color-brand-primary)'
                    : 'var(--color-text-primary)',
              }}
            >
              {side.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Reply
        </legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status.id}
              type="button"
              disabled={pending}
              onClick={() => onPatch({ status: status.id })}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium"
              style={{
                border: '1px solid var(--color-border)',
                background:
                  member.status === status.id
                    ? 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)'
                    : 'transparent',
                color:
                  member.status === status.id
                    ? 'var(--color-brand-primary)'
                    : 'var(--color-text-primary)',
              }}
            >
              {status.id === 'CONFIRMED' && <Check size={12} className="mr-1" />}
              {status.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label
        className="flex min-h-11 items-center gap-2 text-sm"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <input
          type="checkbox"
          checked={member.showOnSite}
          disabled={pending}
          onChange={(e) => onPatch({ showOnSite: e.target.checked })}
        />
        Show on the event site
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Walks with
        </span>
        <select
          value={member.pairedWithId ?? ''}
          disabled={pending}
          onChange={(e) => onPatch({ pairedWithId: e.target.value || null })}
          className="min-h-11 w-full rounded-lg px-3 text-sm focus:outline-none"
          style={fieldStyle}
        >
          <option value="">Not matched</option>
          {members
            .filter((row) => row.id !== member.id)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.role ? ` · ${row.role}` : ''}
              </option>
            ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Group
        </span>
        <input
          defaultValue={member.group ?? ''}
          maxLength={40}
          disabled={pending}
          onBlur={(e) => {
            const group = e.target.value.trim() || null
            if (group !== (member.group ?? null)) onPatch({ group })
          }}
          className="min-h-11 w-full rounded-lg px-3 text-sm focus:outline-none"
          style={fieldStyle}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
          Short bio
        </span>
        <textarea
          defaultValue={member.bio ?? ''}
          maxLength={400}
          rows={2}
          disabled={pending}
          onBlur={(e) => {
            const bio = e.target.value.trim() || null
            if (bio !== (member.bio ?? null)) onPatch({ bio })
          }}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={fieldStyle}
        />
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex min-h-11 items-center gap-1 text-xs"
        style={{ color: 'var(--color-muted)' }}
        aria-label={`Remove ${member.name}`}
      >
        <Trash2 size={12} />
        Remove
      </button>
    </div>
  )
}

function MatchBoard({
  members,
  canEdit,
  onPair,
}: {
  members: EventPartyMember[]
  canEdit: boolean
  onPair: (id: string, partnerId: string | null) => void
}) {
  const used = new Set<string>()
  const pairs: [EventPartyMember, EventPartyMember][] = []
  const byId = new Map(members.map((m) => [m.id, m]))
  for (const member of members) {
    if (used.has(member.id) || !member.pairedWithId) continue
    const partner = byId.get(member.pairedWithId)
    if (!partner || used.has(partner.id)) continue
    const left = member.side === 'GROOM' && partner.side === 'BRIDE' ? partner : member
    const right = left === member ? partner : member
    pairs.push([left, right])
    used.add(member.id)
    used.add(partner.id)
  }
  if (pairs.length === 0) return null
  return (
    <div
      className="space-y-1 rounded-2xl px-4 py-3"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
    >
      <p
        className="flex items-center gap-1.5 text-[11px] font-semibold"
        style={{ color: 'var(--color-muted)' }}
      >
        <Heart size={12} />
        Walking together
      </p>
      <ul className="space-y-1">
        {pairs.map(([left, right]) => (
          <li key={`${left.id}-${right.id}`} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{left.name}</span>
            <span style={{ color: 'var(--color-muted)' }}>with</span>
            <span className="font-medium">{right.name}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => onPair(left.id, null)}
                className="inline-flex min-h-11 items-center text-[11px]"
                style={{ color: 'var(--color-muted)' }}
              >
                Unmatch
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
