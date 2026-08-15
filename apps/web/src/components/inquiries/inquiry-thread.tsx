'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import {
  CalendarDays, Check, CheckCircle, DollarSign, ExternalLink, Link2,
  Pencil, Send, Undo2, X, XCircle,
} from 'lucide-react'
import { useSse } from '@/contexts/sse-context'
import { proxyClient } from '@/lib/proxy-client'
import {
  InspirationDetail,
  type InspirationDetailItem,
} from '@/app/(app)/inspiration/inspiration-detail'

export type MessageKind = 'TEXT' | 'QUOTE' | 'LINK' | 'INSPIRATION'
export type InquiryThreadStatus =
  | 'PENDING' | 'VIEWED' | 'QUOTED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'BOOKED'

export interface QuotePayload {
  amount: number
  currency: string
  note?: string | null
  accepted?: boolean
  rejected?: boolean
  booked?: boolean
}

export interface LinkPayload {
  url: string
  label?: string | null
  linkKind: 'calendar' | 'booking'
}

export interface InspirationPayload {
  inspirationItemId: string
  title: string
  coverUrl: string | null
}

export interface ThreadMessage {
  id: string
  message: string
  kind?: MessageKind
  payload?: QuotePayload | LinkPayload | InspirationPayload | null
  createdAt: string
  readAt: string | null
  editedAt: string | null
  unsentAt: string | null
  isCurrentUser: boolean
  sender: {
    id: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
    vendorProfile: { businessName: string } | null
  }
}

interface Props {
  inquiryId: string
  originalMessage: string
  originalSenderName: string
  originalCreatedAt: string
  /** true  = the original inquiry was sent BY the current user (host)
   *  false = the current user received it (vendor) */
  originalIsCurrentUser: boolean
  inquiryStatus?: InquiryThreadStatus
  onStatusChange?: (status: InquiryThreadStatus) => void
  originLook?: { id: string; title: string; coverUrl: string | null } | null
}

const DISCLAIMER = 'Not a contract. You and the other party agree on details outside Djanora.'

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  return (
    <div
      className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center ring-1 ring-black/8 dark:ring-white/10"
      style={{ background: 'var(--card-bg)', minWidth: 24, minHeight: 24 }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[9px] font-bold" style={{ color: 'var(--color-foreground)' }}>{initials}</span>
      )}
    </div>
  )
}

function formatLocalTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Disclaimer({ compact }: { compact?: boolean }) {
  return (
    <p
      className={compact ? 'text-[10px] leading-snug mt-1.5' : 'text-[10px] leading-snug'}
      style={{ color: 'var(--color-muted)' }}
    >
      {DISCLAIMER}
    </p>
  )
}

function MessageMeta({
  isMine, senderName, createdAt, isOriginal, editedAt, unsentAt,
}: {
  isMine: boolean
  senderName: string
  createdAt: string
  isOriginal?: boolean
  editedAt?: string | null
  unsentAt?: string | null
}) {
  return (
    <span className="text-[10px] px-1" style={{ color: 'var(--color-muted)' }}>
      {isMine ? 'You' : senderName} · {formatLocalTime(createdAt)}
      {isOriginal && <span className="ml-1 opacity-60">(original message)</span>}
      {!unsentAt && editedAt && <span className="ml-1 opacity-60">(edited)</span>}
    </span>
  )
}

function MessageBubble({
  text,
  senderName,
  avatarUrl,
  isMine,
  createdAt,
  readAt,
  editedAt,
  unsentAt,
  isOriginal,
  canEdit,
  onEdit,
  canUnsend,
  onUnsend,
  unsending,
}: {
  text: string
  senderName: string
  avatarUrl: string | null
  isMine: boolean
  createdAt: string
  readAt?: string | null
  editedAt?: string | null
  unsentAt?: string | null
  isOriginal?: boolean
  canEdit?: boolean
  onEdit?: () => void
  canUnsend?: boolean
  onUnsend?: () => void
  unsending?: boolean
}) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={isMine ? 'You' : senderName} avatarUrl={isMine ? null : avatarUrl} />
      <div className={`max-w-[80%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
        <MessageMeta
          isMine={isMine}
          senderName={senderName}
          createdAt={createdAt}
          isOriginal={isOriginal}
          editedAt={editedAt}
          unsentAt={unsentAt}
        />
        <div
          className="px-3 py-2 rounded-2xl text-sm leading-relaxed"
          style={unsentAt ? {
            background: 'transparent',
            color: 'var(--color-muted)',
            border: '1px dashed var(--color-border)',
            fontStyle: 'italic',
          } : isMine ? {
            background: '#c9973a',
            color: '#fff',
            borderBottomRightRadius: 4,
          } : {
            background: 'var(--card-bg-hover)',
            color: 'var(--color-foreground)',
            borderBottomLeftRadius: 4,
          }}
        >
          {unsentAt
            ? (isMine ? 'You unsent this message' : 'This message was unsent')
            : text}
        </div>
        {isMine && !unsentAt && (
          <div className="flex items-center gap-2 px-1">
            {readAt && (
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                Read {formatLocalTime(readAt)}
              </span>
            )}
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-muted)' }}
              >
                <Pencil size={10} />
                Edit
              </button>
            )}
            {canUnsend && onUnsend && (
              <button
                type="button"
                onClick={onUnsend}
                disabled={unsending}
                className="inline-flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity disabled:opacity-40"
                style={{ color: 'var(--color-muted)' }}
              >
                {unsending
                  ? <span className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
                  : <Undo2 size={10} />}
                Unsend
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function QuoteCard({
  payload,
  senderName,
  avatarUrl,
  isMine,
  createdAt,
  readAt,
  canUnsend,
  onUnsend,
  unsending,
  canRespond,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: {
  payload: QuotePayload
  senderName: string
  avatarUrl: string | null
  isMine: boolean
  createdAt: string
  readAt?: string | null
  canUnsend?: boolean
  onUnsend?: () => void
  unsending?: boolean
  canRespond?: boolean
  onAccept?: () => void
  onReject?: () => void
  accepting?: boolean
  rejecting?: boolean
}) {
  const amount = payload.amount.toLocaleString('en-CA')
  const locked = payload.rejected || payload.booked
  const busy = accepting || rejecting
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={isMine ? 'You' : senderName} avatarUrl={isMine ? null : avatarUrl} />
      <div className={`max-w-[80%] w-full flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
        <MessageMeta isMine={isMine} senderName={senderName} createdAt={createdAt} />
        <div
          className="w-full px-3 py-2.5 rounded-2xl border text-sm"
          style={{
            background: 'var(--card-bg)',
            borderColor: payload.booked
              ? 'rgba(22,163,74,0.35)'
              : payload.rejected
                ? 'rgba(185,28,28,0.28)'
                : payload.accepted
                  ? 'rgba(201,151,58,0.45)'
                  : 'rgba(201,151,58,0.35)',
            color: 'var(--color-foreground)',
            borderBottomRightRadius: isMine ? 4 : undefined,
            borderBottomLeftRadius: isMine ? undefined : 4,
            opacity: payload.rejected ? 0.85 : 1,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#8b6200' }}>
              <DollarSign size={12} />
              Quote
            </span>
            {payload.booked ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(22,163,74,0.12)', color: '#15803d' }}
              >
                <CheckCircle size={10} />
                Booked
              </span>
            ) : payload.rejected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}
              >
                <XCircle size={10} />
                Rejected
              </span>
            ) : payload.accepted ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(201,151,58,0.16)', color: '#8b6200' }}
              >
                <CheckCircle size={10} />
                Accepted
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-display text-lg font-semibold">
            ${amount} <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{payload.currency}</span>
          </p>
          {payload.note && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>{payload.note}</p>
          )}
          <Disclaimer compact />
          {canRespond && !locked && (
            <div className="mt-2 flex items-center gap-2">
              {!payload.accepted && (
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gold-600 text-white hover:bg-gold-700 disabled:opacity-40 transition-colors"
                >
                  {accepting
                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <CheckCircle size={12} />}
                  Accept quote
                </button>
              )}
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border hover:opacity-80 disabled:opacity-40 transition-opacity"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                {rejecting
                  ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <XCircle size={12} />}
                Reject quote
              </button>
            </div>
          )}
        </div>
        {isMine && (
          <div className="flex items-center gap-2 px-1">
            {readAt && (
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                Read {formatLocalTime(readAt)}
              </span>
            )}
            {canUnsend && onUnsend && !locked && (
              <button
                type="button"
                onClick={onUnsend}
                disabled={unsending}
                className="inline-flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity disabled:opacity-40"
                style={{ color: 'var(--color-muted)' }}
              >
                {unsending
                  ? <span className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
                  : <Undo2 size={10} />}
                Unsend
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LinkCard({
  payload,
  senderName,
  avatarUrl,
  isMine,
  createdAt,
  readAt,
  canUnsend,
  onUnsend,
  unsending,
}: {
  payload: LinkPayload
  senderName: string
  avatarUrl: string | null
  isMine: boolean
  createdAt: string
  readAt?: string | null
  canUnsend?: boolean
  onUnsend?: () => void
  unsending?: boolean
}) {
  const isCalendar = payload.linkKind === 'calendar'
  const title = payload.label || (isCalendar ? 'Calendar' : 'Booking link')
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={isMine ? 'You' : senderName} avatarUrl={isMine ? null : avatarUrl} />
      <div className={`max-w-[80%] w-full flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
        <MessageMeta isMine={isMine} senderName={senderName} createdAt={createdAt} />
        <div
          className="w-full px-3 py-2.5 rounded-2xl border text-sm"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-foreground)',
            borderBottomRightRadius: isMine ? 4 : undefined,
            borderBottomLeftRadius: isMine ? undefined : 4,
          }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#8b6200' }}>
            {isCalendar ? <CalendarDays size={12} /> : <Link2 size={12} />}
            {isCalendar ? 'Calendar' : 'Booking link'}
          </span>
          <a
            href={payload.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-gold-700 dark:text-gold-400 hover:underline break-all"
          >
            {title}
            <ExternalLink size={12} className="shrink-0" />
          </a>
          <Disclaimer compact />
        </div>
        {isMine && (
          <div className="flex items-center gap-2 px-1">
            {readAt && (
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                Read {formatLocalTime(readAt)}
              </span>
            )}
            {canUnsend && onUnsend && (
              <button
                type="button"
                onClick={onUnsend}
                disabled={unsending}
                className="inline-flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity disabled:opacity-40"
                style={{ color: 'var(--color-muted)' }}
              >
                {unsending
                  ? <span className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
                  : <Undo2 size={10} />}
                Unsend
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function lookStub(id: string, title: string, coverUrl: string | null): InspirationDetailItem {
  return {
    id,
    title,
    description: '',
    category: '',
    tags: [],
    imageUrl: coverUrl,
    location: null,
    priceRangeFrom: null,
    priceRangeTo: null,
    currency: 'CAD',
    vendorProfile: null,
  }
}

function InspirationLookCard({
  payload,
  senderName,
  avatarUrl,
  isMine,
  createdAt,
  onOpen,
}: {
  payload: InspirationPayload
  senderName: string
  avatarUrl: string | null
  isMine: boolean
  createdAt: string
  onOpen: () => void
}) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={isMine ? 'You' : senderName} avatarUrl={isMine ? null : avatarUrl} />
      <div className={`max-w-[80%] w-full flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
        <MessageMeta isMine={isMine} senderName={senderName} createdAt={createdAt} />
        <button
          type="button"
          onClick={onOpen}
          className="w-full rounded-2xl border overflow-hidden text-sm text-left transition-opacity hover:opacity-90"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-foreground)',
            borderBottomRightRadius: isMine ? 4 : undefined,
            borderBottomLeftRadius: isMine ? undefined : 4,
          }}
        >
          {payload.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.coverUrl} alt={payload.title} className="w-full h-28 object-cover" />
          )}
          <div className="px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-medium" style={{ color: '#8b6200' }}>Asked about this look</span>
              <p className="mt-0.5 font-medium truncate">{payload.title}</p>
            </div>
            <span className="shrink-0 text-[11px] font-medium" style={{ color: 'var(--color-brand-primary)' }}>
              View
            </span>
          </div>
        </button>
      </div>
    </div>
  )
}

const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000
type ShareMode = 'text' | 'quote' | 'calendar' | 'booking'

export function InquiryThread({
  inquiryId,
  originalMessage,
  originalSenderName,
  originalCreatedAt,
  originalIsCurrentUser,
  inquiryStatus,
  onStatusChange,
  originLook,
}: Props) {
  const isHost = originalIsCurrentUser
  const isVendor = !originalIsCurrentUser
  const closed = inquiryStatus === 'DECLINED' || inquiryStatus === 'CANCELLED'

  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [shareMode, setShareMode] = useState<ShareMode>('text')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteCurrency, setQuoteCurrency] = useState('CAD')
  const [quoteNote, setQuoteNote] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [unsendingId, setUnsendingId] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [openLook, setOpenLook] = useState<InspirationDetailItem | null>(null)
  const [lookSaved, setLookSaved] = useState(false)
  const [saveLook, setSaveLook] = useState<InspirationDetailItem | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { on } = useSse()

  const markMessagesRead = useCallback(async () => {
    try {
      const { data } = await proxyClient.patch<{
        messageIds: string[]
        readAt: string | null
      }>(`/inquiries/${inquiryId}/messages/read`, {})

      if (!data.readAt || data.messageIds.length === 0) return

      setMessages((prev) => prev.map((msg) => (
        data.messageIds.includes(msg.id) ? { ...msg, readAt: data.readAt } : msg
      )))
    } catch {
      // Read receipts should never block reading/replying.
    }
  }, [inquiryId])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      proxyClient.get(`/inquiries/${inquiryId}/messages`)
        .then(({ data }) => {
          if (!cancelled) {
            setMessages(Array.isArray(data) ? data : [])
            markMessagesRead()
          }
        })
        .catch(() => {
          if (!cancelled) setMessages([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })
    return () => { cancelled = true }
  }, [inquiryId, markMessagesRead])

  useEffect(() => {
    const off = on((event) => {
      if (event.type === 'new_message' && event.inquiryId === inquiryId && event.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.message!.id)) return prev
          return [...prev, event.message as ThreadMessage]
        })
        markMessagesRead()
      }

      if (event.type === 'message_updated' && event.inquiryId === inquiryId && event.message) {
        setMessages((prev) => prev.map((msg) => (
          msg.id === event.message!.id
            ? { ...(event.message as ThreadMessage), isCurrentUser: msg.isCurrentUser }
            : msg
        )))
      }

      if (event.type === 'message_unsent' && event.inquiryId === inquiryId && event.unsent) {
        setMessages((prev) => prev.map((msg) => (
          msg.id === event.unsent!.messageId
            ? { ...msg, message: '', unsentAt: event.unsent!.unsentAt }
            : msg
        )))
        if (editingId === event.unsent.messageId) {
          setEditingId(null)
          setEditingDraft('')
        }
      }

      if (event.type === 'messages_read' && event.inquiryId === inquiryId && event.read) {
        const ids = new Set(event.read.messageIds)
        setMessages((prev) => prev.map((msg) => (
          ids.has(msg.id) ? { ...msg, readAt: event.read!.readAt } : msg
        )))
      }

      if (event.type === 'inquiry_status' && event.inquiryId === inquiryId && event.status) {
        onStatusChange?.(event.status as InquiryThreadStatus)
      }
    })
    return off
  }, [on, inquiryId, markMessagesRead, editingId, onStatusChange])

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  function resetShare() {
    setShareMode('text')
    setQuoteAmount('')
    setQuoteNote('')
    setLinkUrl('')
    setLinkLabel('')
    setDraft('')
  }

  function send() {
    setError(null)

    if (shareMode === 'quote') {
      const amount = Number(quoteAmount)
      if (!Number.isInteger(amount) || amount < 1) {
        setError('Enter a whole-dollar quote amount.')
        return
      }
      startTransition(async () => {
        try {
          const { data: msg } = await proxyClient.post<ThreadMessage>(`/inquiries/${inquiryId}/messages`, {
            kind: 'QUOTE',
            amount,
            currency: quoteCurrency,
            note: quoteNote.trim() || undefined,
          })
          setMessages((prev) => [...prev, msg])
          resetShare()
          if (inquiryStatus !== 'BOOKED') onStatusChange?.('QUOTED')
        } catch {
          setError('Failed to send quote — try again.')
        }
      })
      return
    }

    if (shareMode === 'calendar' || shareMode === 'booking') {
      const url = linkUrl.trim()
      if (!/^https?:\/\//i.test(url)) {
        setError('Paste a full http(s) link.')
        return
      }
      startTransition(async () => {
        try {
          const { data: msg } = await proxyClient.post<ThreadMessage>(`/inquiries/${inquiryId}/messages`, {
            kind: 'LINK',
            url,
            label: linkLabel.trim() || undefined,
            linkKind: shareMode,
          })
          setMessages((prev) => [...prev, msg])
          resetShare()
        } catch {
          setError('Failed to share link — try again.')
        }
      })
      return
    }

    const text = draft.trim()
    if (!text) return
    startTransition(async () => {
      try {
        const { data: msg } = await proxyClient.post<ThreadMessage>(`/inquiries/${inquiryId}/messages`, { message: text })
        setMessages((prev) => [...prev, msg])
        setDraft('')
      } catch {
        setError('Failed to send — try again.')
      }
    })
  }

  function startEdit(msg: ThreadMessage) {
    setError(null)
    setEditingId(msg.id)
    setEditingDraft(msg.message)
  }

  async function saveEdit(messageId: string) {
    const text = editingDraft.trim()
    if (!text) {
      setError('Message cannot be empty.')
      return
    }

    setSavingEditId(messageId)
    setError(null)
    try {
      const { data: msg } = await proxyClient.patch<ThreadMessage>(
        `/inquiries/${inquiryId}/messages/${messageId}`,
        { message: text },
      )
      setMessages((prev) => prev.map((item) => (item.id === messageId ? msg : item)))
      setEditingId(null)
      setEditingDraft('')
    } catch {
      setError('Failed to edit message — you can only edit your own messages within 5 minutes.')
    } finally {
      setSavingEditId(null)
    }
  }

  async function unsendMessage(messageId: string) {
    setUnsendingId(messageId)
    setError(null)
    try {
      const { data } = await proxyClient.delete<{ id: string; unsentAt: string }>(
        `/inquiries/${inquiryId}/messages/${messageId}`,
      )
      setMessages((prev) => prev.map((item) => (
        item.id === messageId
          ? { ...item, message: '', unsentAt: data.unsentAt }
          : item
      )))
      if (editingId === messageId) {
        setEditingId(null)
        setEditingDraft('')
      }
    } catch {
      setError('Failed to unsend — you can only unsend your own messages within 5 minutes.')
    } finally {
      setUnsendingId(null)
    }
  }

  async function acceptQuote(messageId: string) {
    setAcceptingId(messageId)
    setError(null)
    try {
      await proxyClient.post(`/inquiries/${inquiryId}/accept-quote`, { messageId })
      setMessages((prev) => prev.map((item) => {
        if (item.kind !== 'QUOTE') return item
        const payload = item.payload as QuotePayload
        if (item.id === messageId) {
          return { ...item, payload: { ...payload, accepted: true, rejected: false } }
        }
        if (payload.accepted) {
          return { ...item, payload: { ...payload, accepted: false } }
        }
        return item
      }))
    } catch {
      setError('Could not accept this quote. Quotes are not a contract — confirm details with the vendor directly.')
    } finally {
      setAcceptingId(null)
    }
  }

  async function rejectQuote(messageId: string) {
    setRejectingId(messageId)
    setError(null)
    try {
      await proxyClient.post(`/inquiries/${inquiryId}/reject-quote`, { messageId })
      setMessages((prev) => prev.map((item) => {
        if (item.id !== messageId || item.kind !== 'QUOTE') return item
        return {
          ...item,
          payload: { ...(item.payload as QuotePayload), rejected: true, accepted: false },
        }
      }))
    } catch {
      setError('Could not reject this quote.')
    } finally {
      setRejectingId(null)
    }
  }

  async function confirmBooked() {
    const accepted = messages.find((item) => {
      if (item.kind !== 'QUOTE' || item.unsentAt) return false
      return (item.payload as QuotePayload | null)?.accepted
    })
    if (!accepted) {
      setError('Accept a quote first, then you can mark this person as booked.')
      return
    }

    setBookingId(accepted.id)
    setError(null)
    try {
      await proxyClient.post(`/inquiries/${inquiryId}/book`, { messageId: accepted.id })
      setMessages((prev) => prev.map((item) => {
        if (item.id !== accepted.id || item.kind !== 'QUOTE') return item
        return {
          ...item,
          payload: { ...(item.payload as QuotePayload), booked: true },
        }
      }))
      onStatusChange?.('BOOKED')
    } catch {
      setError('Could not update booking. This is not a contract — confirm details with the vendor directly.')
    } finally {
      setBookingId(null)
    }
  }

  const canSend = shareMode === 'text'
    ? !!draft.trim()
    : shareMode === 'quote'
      ? Number(quoteAmount) >= 1
      : !!linkUrl.trim()

  const acceptedQuote = messages.find((item) => {
    if (item.kind !== 'QUOTE' || item.unsentAt) return false
    const payload = item.payload as QuotePayload | null
    return !!payload?.accepted && !payload.booked && !payload.rejected
  })

  return (
    <>
    <div className="border-t flex flex-col flex-1 overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
      {inquiryStatus === 'BOOKED' && (
        <div
          className="px-4 py-2 text-[11px] leading-snug border-b shrink-0"
          style={{ borderColor: 'var(--color-border)', background: 'rgba(22,163,74,0.06)', color: 'var(--color-muted)' }}
        >
          {isHost
            ? 'You marked this person as booked in Djanora.'
            : 'The host marked you as booked in Djanora.'}{' '}
          {DISCLAIMER}
        </div>
      )}

      {isHost && !closed && inquiryStatus !== 'BOOKED' && acceptedQuote && (
        <div
          className="px-4 py-2.5 border-b shrink-0 flex items-center gap-3"
          style={{ borderColor: 'var(--color-border)', background: 'rgba(201,151,58,0.06)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--color-foreground)' }}>
              Did you book this person?
            </p>
            <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {DISCLAIMER}
            </p>
          </div>
          <button
            type="button"
            onClick={confirmBooked}
            disabled={!!bookingId}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gold-600 text-white hover:bg-gold-700 disabled:opacity-40 transition-colors"
          >
            {bookingId
              ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <CheckCircle size={12} />}
            Yes, we booked
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {originLook && (
          <button
            type="button"
            onClick={() => {
              setLookSaved(false)
              setOpenLook(lookStub(originLook.id, originLook.title, originLook.coverUrl))
            }}
            className="w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-opacity hover:opacity-90"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--color-border)' }}
          >
            {originLook.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originLook.coverUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-lg shrink-0" style={{ background: 'var(--input-bg)' }} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                About this look
              </p>
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {originLook.title}
              </p>
            </div>
            <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--color-brand-primary)' }}>
              View
            </span>
          </button>
        )}
        <MessageBubble
          text={originalMessage}
          senderName={originalSenderName}
          avatarUrl={null}
          isMine={originalIsCurrentUser}
          createdAt={originalCreatedAt}
          isOriginal
        />

        {loading ? (
          <div className="flex justify-center py-1">
            <span className="w-4 h-4 border-2 border-gold-400/30 border-t-gold-600 rounded-full animate-spin" />
          </div>
        ) : (
          messages.map((msg) => {
            const name = msg.sender.vendorProfile?.businessName
              || [msg.sender.firstName, msg.sender.lastName].filter(Boolean).join(' ')
              || 'User'
            const kind = msg.kind ?? 'TEXT'
            const canMutate =
              msg.isCurrentUser &&
              !msg.unsentAt &&
              now - new Date(msg.createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS
            const quote = kind === 'QUOTE' ? (msg.payload as QuotePayload | null) : null
            const link = kind === 'LINK' ? (msg.payload as LinkPayload | null) : null
            const inspiration = kind === 'INSPIRATION' ? (msg.payload as InspirationPayload | null) : null

            if (editingId === msg.id && canMutate && kind === 'TEXT') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="w-full max-w-[80%] space-y-2">
                    <textarea
                      rows={3}
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-2xl border resize-none focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition"
                      style={{
                        background: 'var(--input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-foreground)',
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditingDraft('')
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border hover:opacity-80 transition-opacity"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                      >
                        <X size={12} />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(msg.id)}
                        disabled={savingEditId === msg.id || !editingDraft.trim()}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gold-600 text-white hover:bg-gold-700 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                      >
                        {savingEditId === msg.id
                          ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Check size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            if (msg.unsentAt || (kind === 'TEXT' && !quote && !link)) {
              return (
                <MessageBubble
                  key={msg.id}
                  text={msg.message}
                  senderName={name}
                  avatarUrl={msg.sender.avatarUrl}
                  isMine={msg.isCurrentUser}
                  createdAt={msg.createdAt}
                  readAt={msg.readAt}
                  editedAt={msg.editedAt}
                  unsentAt={msg.unsentAt}
                  canEdit={canMutate && kind === 'TEXT'}
                  onEdit={canMutate && kind === 'TEXT' ? () => startEdit(msg) : undefined}
                  canUnsend={canMutate}
                  onUnsend={canMutate ? () => unsendMessage(msg.id) : undefined}
                  unsending={unsendingId === msg.id}
                />
              )
            }

            if (kind === 'QUOTE' && quote) {
              return (
                <QuoteCard
                  key={msg.id}
                  payload={quote}
                  senderName={name}
                  avatarUrl={msg.sender.avatarUrl}
                  isMine={msg.isCurrentUser}
                  createdAt={msg.createdAt}
                  readAt={msg.readAt}
                  canUnsend={canMutate && !quote.booked && !quote.accepted && !quote.rejected}
                  onUnsend={canMutate && !quote.booked && !quote.accepted && !quote.rejected ? () => unsendMessage(msg.id) : undefined}
                  unsending={unsendingId === msg.id}
                  canRespond={isHost && !closed && inquiryStatus !== 'BOOKED' && !quote.booked && !quote.rejected}
                  onAccept={() => acceptQuote(msg.id)}
                  onReject={() => rejectQuote(msg.id)}
                  accepting={acceptingId === msg.id}
                  rejecting={rejectingId === msg.id}
                />
              )
            }

            if (kind === 'LINK' && link) {
              return (
                <LinkCard
                  key={msg.id}
                  payload={link}
                  senderName={name}
                  avatarUrl={msg.sender.avatarUrl}
                  isMine={msg.isCurrentUser}
                  createdAt={msg.createdAt}
                  readAt={msg.readAt}
                  canUnsend={canMutate}
                  onUnsend={canMutate ? () => unsendMessage(msg.id) : undefined}
                  unsending={unsendingId === msg.id}
                />
              )
            }

            if (kind === 'INSPIRATION' && inspiration) {
              return (
                <InspirationLookCard
                  key={msg.id}
                  payload={inspiration}
                  senderName={name}
                  avatarUrl={msg.sender.avatarUrl}
                  isMine={msg.isCurrentUser}
                  createdAt={msg.createdAt}
                  onOpen={() => {
                    setLookSaved(false)
                    setOpenLook(lookStub(inspiration.inspirationItemId, inspiration.title, inspiration.coverUrl))
                  }}
                />
              )
            }

            return (
              <MessageBubble
                key={msg.id}
                text={msg.message}
                senderName={name}
                avatarUrl={msg.sender.avatarUrl}
                isMine={msg.isCurrentUser}
                createdAt={msg.createdAt}
                readAt={msg.readAt}
                editedAt={msg.editedAt}
                unsentAt={msg.unsentAt}
              />
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <p className="px-4 py-3 text-xs shrink-0 border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          This inquiry is closed. Quotes and replies are no longer available.
        </p>
      ) : (
        <div
          className="px-4 py-3 border-t flex flex-col gap-2 shrink-0"
          style={{ borderColor: 'var(--color-border)', background: 'var(--card-bg)' }}
        >
          {isVendor && (
            <div className="flex items-center gap-1">
              {([
                { key: 'text', label: 'Message' },
                { key: 'quote', label: 'Quote' },
                { key: 'calendar', label: 'Calendar' },
                { key: 'booking', label: 'Booking link' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setShareMode(tab.key)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
                  style={shareMode === tab.key ? {
                    background: 'rgba(201,151,58,0.14)',
                    color: '#8b6200',
                  } : { color: 'var(--color-muted)' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {shareMode === 'quote' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Amount"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                  className="flex-1 text-sm px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                />
                <select
                  value={quoteCurrency}
                  onChange={(e) => setQuoteCurrency(e.target.value)}
                  className="text-sm px-2 py-2 rounded-xl border focus:outline-none"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Optional note (what's included)"
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              />
            </div>
          )}

          {(shareMode === 'calendar' || shareMode === 'booking') && (
            <div className="flex flex-col gap-2">
              <input
                type="url"
                placeholder={shareMode === 'calendar' ? 'https://calendar.google.com/…' : 'https://calendly.com/…'}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              />
              <input
                type="text"
                placeholder="Optional label"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              />
            </div>
          )}

          {shareMode === 'text' && (
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                placeholder="Reply… (Ctrl/Cmd + Enter to send)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
                className="flex-1 text-sm px-3 py-2 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition"
                style={{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
              <button
                onClick={send}
                disabled={isPending || !canSend}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-gold-600 text-white hover:bg-gold-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              >
                {isPending
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send size={13} />}
              </button>
            </div>
          )}

          {shareMode !== 'text' && (
            <div className="flex items-center justify-between gap-2">
              <Disclaimer />
              <button
                onClick={send}
                disabled={isPending || !canSend}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gold-600 text-white hover:bg-gold-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              >
                {isPending
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send size={13} />}
                Share
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs px-4 pb-2 shrink-0 text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
    {openLook && (
      <InspirationDetail
        item={openLook}
        saved={lookSaved}
        onClose={() => setOpenLook(null)}
        onSaveClick={() => setSaveLook(openLook)}
        onFindVendors={() => setOpenLook(null)}
      />
    )}
    {saveLook && (
      <ThreadSaveLookModal
        item={saveLook}
        onClose={() => setSaveLook(null)}
        onSaved={() => {
          setLookSaved(true)
          setSaveLook(null)
        }}
      />
    )}
    </>
  )
}

function ThreadSaveLookModal({
  item,
  onClose,
  onSaved,
}: {
  item: InspirationDetailItem
  onClose: () => void
  onSaved: () => void
}) {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([])
  const [eventId, setEventId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    proxyClient.get('/events')
      .then(({ data }) => {
        const list = Array.isArray(data)
          ? data.map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }))
          : []
        setEvents(list)
        if (list.length === 1) setEventId(list[0].id)
      })
      .catch(() => setEvents([]))
  }, [])

  async function save() {
    if (!eventId) return
    setSaving(true)
    setError('')
    try {
      await proxyClient.post(`/inspiration/${item.id}/save`, { eventId })
      onSaved()
    } catch {
      setError('Could not save this look')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>Save to mood board</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} style={{ color: 'var(--color-muted)' }} />
          </button>
        </div>
        {events.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Create an event first, then save looks to it.</p>
        ) : (
          <>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
            >
              <option value="">Choose an event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              disabled={saving || !eventId}
              onClick={() => void save()}
              className="w-full h-9 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
