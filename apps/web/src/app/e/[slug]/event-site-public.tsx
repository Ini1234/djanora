'use client'

import { useEffect, useState, useTransition } from 'react'
import { backend } from '@/lib/backend'
import { getErrorMessage } from '@/lib/errors'
import type { PublicEventSite } from '@/lib/api.types'
import { buttonClass } from './site-look'
import { EventSiteView } from './event-site-view'

const SESSION_HEADER = 'X-Event-Site-Session'

function storageKey(slug: string) {
  return `djanora.eventSite.${slug}`
}

export function EventSitePublic({
  slug,
  initial,
  inviteeId,
}: {
  slug: string
  initial: PublicEventSite
  inviteeId?: string
}) {
  const [site, setSite] = useState(initial)
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [booting, setBooting] = useState(Boolean(inviteeId))
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    async function applySession(session: string) {
      window.localStorage.setItem(storageKey(slug), session)
      const next = await backend.get<PublicEventSite>(`/event-sites/${slug}`, {
        headers: { [SESSION_HEADER]: session },
      })
      if (cancelled) return
      setToken(session)
      setSite(next.data)
    }

    async function boot() {
      if (inviteeId) {
        try {
          const { data } = await backend.post<{ token: string }>(`/event-sites/${slug}/session`, {
            inviteeId,
          })
          if (!cancelled) await applySession(data.token)
        } catch (err) {
          if (!cancelled) setError(getErrorMessage(err, "We couldn't find that invite."))
        } finally {
          if (!cancelled) setBooting(false)
        }
        return
      }

      const stored = window.localStorage.getItem(storageKey(slug))
      if (!stored) return
      try {
        await applySession(stored)
      } catch {
        window.localStorage.removeItem(storageKey(slug))
        if (!cancelled) setToken(null)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [slug, inviteeId])

  function unlock() {
    startTransition(async () => {
      setError('')
      try {
        const { data } = await backend.post<{ token: string }>(`/event-sites/${slug}/session`, {
          email: email.trim() || undefined,
          code: code.trim() || undefined,
        })
        window.localStorage.setItem(storageKey(slug), data.token)
        setToken(data.token)
        const next = await backend.get<PublicEventSite>(`/event-sites/${slug}`, {
          headers: { [SESSION_HEADER]: data.token },
        })
        setSite(next.data)
      } catch (err) {
        setError(getErrorMessage(err, "We couldn't find that invite."))
      }
    })
  }

  const events = [site.owner, ...site.children]
  const showGate = !token && !booting

  return (
    <EventSiteView
      look={site.look}
      sections={site.sections}
      photos={site.photos}
      owner={site.owner}
      events={events}
      rsvp={{
        slug,
        token,
        onDone: (eventId, next) => {
          setSite((prev) => ({
            ...prev,
            owner: prev.owner.eventId === eventId ? { ...prev.owner, rsvp: next } : prev.owner,
            children: prev.children.map((child) =>
              child.eventId === eventId ? { ...child, rsvp: next } : child,
            ),
          }))
        },
      }}
      footer={
        showGate ? (
          <section className="mt-10 rounded-2xl p-5" style={{ background: 'var(--site-card)' }}>
            <h2 className="font-display text-xl" style={{ fontFamily: 'var(--site-heading)' }}>
              Have an invite?
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>
              Enter the email on the guest list, or your unique code.
            </p>
            <div className="mt-4 space-y-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-11 w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--site-muted)', background: 'transparent' }}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium" style={{ color: 'var(--site-muted)' }}>
                  Unique code
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  className="min-h-11 w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--site-muted)', background: 'transparent' }}
                />
              </label>
              {error && (
                <p className="text-xs" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={pending || (!email.trim() && !code.trim())}
                onClick={unlock}
                className={buttonClass(site.look.buttonStyle)}
                style={{
                  background:
                    site.look.buttonStyle === 'underline' ? 'transparent' : 'var(--site-accent)',
                  color:
                    site.look.buttonStyle === 'underline'
                      ? 'var(--site-accent)'
                      : 'var(--site-card)',
                  borderColor: 'var(--site-accent)',
                }}
              >
                {pending ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </section>
        ) : null
      }
    />
  )
}
