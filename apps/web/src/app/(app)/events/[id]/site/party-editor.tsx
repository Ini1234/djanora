'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { EventPartyMember, EventPartyRoster } from '@/lib/api.types'
import { proxyClient } from '@/lib/proxy-client'
import { getErrorMessage } from '@/lib/errors'
import { SiteFileButton } from './site-file-button'
import { PartyPhoto } from '../party-photo'

export async function uploadPartyPhoto(eventId: string, memberId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await proxyClient.post<EventPartyRoster>(
    `/events/${eventId}/party/${memberId}/photo`,
    body,
  )
  return data
}

export async function removePartyPhoto(eventId: string, memberId: string) {
  const { data } = await proxyClient.delete<EventPartyRoster>(
    `/events/${eventId}/party/${memberId}/photo`,
  )
  return data
}

export function PartySitePanel({
  eventId,
  party,
  onChange,
}: {
  eventId: string
  party?: EventPartyRoster
  onChange: (next: EventPartyRoster) => void
}) {
  const members = party?.members ?? []
  const enabled = party?.enabled === true
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggle(member: EventPartyMember, showOnSite: boolean) {
    setError('')
    const { data } = await proxyClient.patch<EventPartyRoster>(
      `/events/${eventId}/party/${member.id}`,
      {
        showOnSite,
      },
    )
    onChange(data)
  }

  async function onUpload(memberId: string, file: File) {
    setError('')
    setBusyId(memberId)
    try {
      onChange(await uploadPartyPhoto(eventId, memberId, file))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add that photo'))
    } finally {
      setBusyId(null)
    }
  }

  async function onRemove(memberId: string) {
    setError('')
    setBusyId(memberId)
    try {
      onChange(await removePartyPhoto(eventId, memberId))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove that photo'))
    } finally {
      setBusyId(null)
    }
  }

  if (members.length === 0) {
    return (
      <div className="space-y-2 text-sm" style={{ color: 'var(--color-muted)' }}>
        <p>
          {enabled
            ? 'No one on the roster yet.'
            : 'Wedding party lives on the event. Add it there, then pick who guests see.'}
        </p>
        <Link
          href={`/events/${eventId}?tab=party`}
          className="inline-flex min-h-11 items-center text-sm font-medium"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          {enabled ? 'Edit wedding party' : 'Add wedding party'}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Add a photo for each person. Only people you check appear on the guest page.
      </p>
      {error && (
        <p className="text-sm" role="alert" style={{ color: 'var(--color-error, #c45c4a)' }}>
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {members.map((member) => (
          <li
            key={member.id}
            className="space-y-2 rounded-xl p-3"
            style={{ border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <PartyPhoto url={member.photoUrl} size={56} />
              <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={member.showOnSite}
                  onChange={(e) => {
                    void toggle(member, e.target.checked).catch((err) => {
                      setError(getErrorMessage(err, 'Could not update who shows on the site'))
                    })
                  }}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{member.name}</span>
                  {member.role && (
                    <span
                      className="block truncate text-[11px]"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      {member.role}
                    </span>
                  )}
                </span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SiteFileButton
                label={member.photoUrl ? 'Replace photo' : 'Add photo'}
                disabled={busyId === member.id}
                onFile={(file) => void onUpload(member.id, file)}
              />
              {member.photoUrl && (
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={() => void onRemove(member.id)}
                  className="inline-flex min-h-11 items-center text-xs"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Link
        href={`/events/${eventId}?tab=party`}
        className="inline-flex min-h-11 items-center text-xs font-medium"
        style={{ color: 'var(--color-brand-primary)' }}
      >
        Edit names and matches
      </Link>
    </div>
  )
}

export function getErrorFromParty(err: unknown) {
  return getErrorMessage(err, 'Could not update who shows on the site')
}
