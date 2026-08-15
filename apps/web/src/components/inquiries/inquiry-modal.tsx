'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, MessageSquare, Send, X } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'

export interface InquiryModalVendor {
  id: string
  businessName: string
}

export interface InquiryModalPost {
  id: string
  title: string
}

function existingInquiryId(err: unknown): string | null {
  const res = (err as { response?: { status?: number; data?: { inquiryId?: unknown } } }).response
  if (res?.status !== 409) return null
  return typeof res.data?.inquiryId === 'string' ? res.data.inquiryId : null
}

function nestMessage(err: unknown): string {
  const raw = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
  if (Array.isArray(raw)) return raw.filter((m) => typeof m === 'string').join(', ')
  return typeof raw === 'string' ? raw : ''
}

function canInquireOnEvent(event: {
  viewer?: { isHost?: boolean; role?: string; surfaces?: string[] }
}) {
  const v = event.viewer
  if (!v) return true
  if (v.isHost || v.role === 'HOST') return true
  return v.role === 'EDITOR' && (v.surfaces?.includes('VENDORS') ?? true)
}

export function InquiryModal({
  vendor,
  post,
  onClose,
}: {
  vendor: InquiryModalVendor
  post?: InquiryModalPost | null
  onClose: () => void
}) {
  const router = useRouter()
  const [events, setEvents] = useState<{ id: string; title: string }[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [message, setMessage] = useState(
    post ? `Hi — I'm interested in your look "${post.title}". Could you tell me more?` : '',
  )
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    proxyClient.get('/events')
      .then(({ data }) => {
        const raw = Array.isArray(data) ? data : []
        const list = raw
          .filter((e: { id?: string; viewer?: { isHost?: boolean; role?: string; surfaces?: string[] } }) =>
            typeof e?.id === 'string' && canInquireOnEvent(e),
          )
          .map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }))
        setEvents(list)
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false))
  }, [])

  function submit() {
    if (message.trim().length < 10) return
    setError(null)
    startTransition(async () => {
      try {
        await proxyClient.post('/inquiries', {
          vendorProfileId: vendor.id,
          message: message.trim(),
          ...(selectedEventId ? { eventId: selectedEventId } : {}),
          ...(post ? { inspirationItemId: post.id } : {}),
        })
        setSent(true)
      } catch (err: unknown) {
        const inquiryId = existingInquiryId(err)
        if (inquiryId) {
          if (post) {
            try {
              await proxyClient.post(`/inquiries/${inquiryId}/messages`, {
                kind: 'INSPIRATION',
                inspirationItemId: post.id,
              })
            } catch { /* still open the thread */ }
          }
          router.push(`/messages?inquiry=${inquiryId}`)
          return
        }
        const msg = nestMessage(err)
        if (msg.toLowerCase().includes('already')) {
          setError(selectedEventId
            ? 'You already contacted this vendor for that event.'
            : 'You already contacted this vendor.')
        } else if (msg === 'Event not found' || msg.includes('edit access')) {
          setError('You need to be an editor on that event to contact vendors.')
        } else if (msg === 'Vendor not found') {
          setError('This vendor is no longer available.')
        } else {
          setError(msg || 'Could not send inquiry')
        }
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {post ? `Ask about “${post.title}”` : `Contact ${vendor.businessName}`}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {post
                ? `This message goes to ${vendor.businessName} about this look.`
                : "Send an inquiry — they'll reply directly to you"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-gold-600/15 flex items-center justify-center mx-auto mb-3">
              <MessageSquare size={22} className="text-gold-700 dark:text-gold-400" />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-foreground)' }}>Inquiry sent!</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {vendor.businessName} will be notified. Track replies in Messages.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 px-5 py-2 rounded-xl text-sm font-medium bg-gold-600 text-white hover:bg-gold-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
                Event <span className="font-normal">(optional)</span>
              </label>
              {loadingEvents ? (
                <div className="h-9 rounded-xl animate-pulse" style={{ background: 'var(--card-bg)' }} />
              ) : events.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  <CalendarDays size={13} />
                  No event yet — you can still send this and attach one later.
                </div>
              ) : (
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                >
                  <option value="">No event yet</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Your message</label>
              <textarea
                rows={4}
                placeholder={`Hi ${vendor.businessName}, I'm planning an event and would love to learn more…`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              />
              <p className="text-xs text-right" style={{ color: message.length < 10 ? 'var(--color-muted)' : '#a87b10' }}>
                {message.length}/2000
              </p>
            </div>

            {error && (
              <p className="text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={isPending || message.trim().length < 10}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gold-600 text-white hover:bg-gold-700 disabled:opacity-40"
            >
              {isPending ? 'Sending…' : <><Send size={14} /> Send inquiry</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
