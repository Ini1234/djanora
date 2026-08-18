'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Loader2, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { useEventAccess } from './event-access-context'
import { useSse } from '@/contexts/sse-context'
import { useSearchParams } from 'next/navigation'
import type { EventSurface } from '@/lib/api.types'

type SubjectType = 'SCHEDULE_ITEM' | 'CHECKLIST_ITEM' | 'BUDGET_ITEM' | 'MOOD_BOARD_ITEM' | 'EVENT'

interface Author {
  id: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

interface Comment {
  id: string
  body: string
  createdAt: string
  updatedAt?: string
  author: Author
  mentions: { userId: string }[]
  replies?: Comment[]
}

interface Mentionable {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

function displayName(person: {
  firstName: string | null
  lastName: string | null
  email?: string
}) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ')
  return name || person.email || 'Someone'
}

function surfaceFor(subjectType: SubjectType): EventSurface | null {
  if (subjectType === 'SCHEDULE_ITEM') return 'SCHEDULE'
  if (subjectType === 'CHECKLIST_ITEM') return 'CHECKLIST'
  if (subjectType === 'BUDGET_ITEM') return 'BUDGET'
  if (subjectType === 'MOOD_BOARD_ITEM') return 'MOODBOARD'
  return null
}

function CommentBody({ text }: { text: string }) {
  const parts = text.split(/(@[^\s@]+)/g)
  return (
    <p
      className="text-xs leading-relaxed whitespace-pre-wrap"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="font-semibold" style={{ color: 'var(--color-brand-primary)' }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function EventItemComments({
  subjectType,
  subjectId,
  bare,
}: {
  subjectType: SubjectType
  subjectId: string
  bare?: boolean
}) {
  const { eventId, canComment, viewer } = useEventAccess()
  const { on } = useSse()
  const searchParams = useSearchParams()
  const focusCommentId = searchParams.get('comment')
  const surface = surfaceFor(subjectType)
  const allowPost = surface
    ? canComment(surface)
    : viewer.isHost || viewer.role === 'EDITOR' || viewer.role === 'COMMENTER'
  const currentUserId = viewer.userId ?? null
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [mentionable, setMentionable] = useState<Mentionable[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await proxyClient.get<Comment[]>(`/events/${eventId}/comments`, {
          params: { subjectType, subjectId },
        })
        if (!cancelled) setComments(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setComments([])
      }

      if (allowPost) {
        try {
          const { data } = await proxyClient.get<Mentionable[]>(
            `/events/${eventId}/members/mentionable`,
            { params: surface ? { surface } : {} },
          )
          if (!cancelled) setMentionable(Array.isArray(data) ? data : [])
        } catch {
          if (!cancelled) setMentionable([])
        }
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [eventId, subjectType, subjectId, allowPost, surface])

  useEffect(() => {
    return on((event) => {
      if (event.type !== 'event_comment' || !event.comment) return
      const incoming = event.comment
      if (incoming.eventId !== eventId) return
      if (incoming.subjectType !== subjectType || incoming.subjectId !== subjectId) return

      setComments((prev) => applyCommentEvent(prev, incoming))
      setOpen(true)
    })
  }, [on, eventId, subjectType, subjectId])

  useEffect(() => {
    if (!focusCommentId) return
    const el = document.getElementById(`comment-${focusCommentId}`)
    if (!el) return
    setOpen(true)
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusCommentId, comments, loading])

  async function addComment(body: string, mentionUserIds: string[], parentId?: string) {
    const { data } = await proxyClient.post<Comment>(`/events/${eventId}/comments`, {
      subjectType,
      subjectId,
      body,
      parentId,
      mentionUserIds,
    })
    setComments((prev) => upsertComment(prev, { ...data, replies: data.replies ?? [] }, parentId))
  }

  async function editComment(id: string, body: string) {
    const { data } = await proxyClient.patch<Comment>(`/events/${eventId}/comments/${id}`, { body })
    setComments((prev) => replaceComment(prev, data))
  }

  async function removeComment(id: string, parentId?: string) {
    await proxyClient.delete(`/events/${eventId}/comments/${id}`)
    setComments((prev) => removeCommentFromTree(prev, id, parentId))
  }

  const count = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)

  return (
    <div
      className={bare ? undefined : 'border-t pt-2'}
      style={bare ? undefined : { borderColor: 'var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center gap-1.5 rounded-md text-left hover:opacity-80"
        style={{ color: 'var(--color-muted)' }}
      >
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <MessageSquare size={10} />
        <span className="text-[10px] font-semibold tracking-wider uppercase">
          Notes {count > 0 && `· ${count}`}
        </span>
      </button>
      {open &&
        (loading ? (
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-muted)' }} />
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                mentionable={mentionable}
                canPost={allowPost}
                currentUserId={currentUserId}
                currentUserIsHost={viewer.isHost}
                focusCommentId={focusCommentId}
                onReply={(body, ids) => addComment(body, ids, comment.id)}
                onEdit={editComment}
                onDelete={(id, parentId) => removeComment(id, parentId)}
              />
            ))}
            {allowPost && (
              <Composer
                mentionable={mentionable}
                placeholder="Add a note… use @ to mention"
                onSubmit={(body, ids) => addComment(body, ids)}
              />
            )}
          </div>
        ))}
    </div>
  )
}

function upsertComment(prev: Comment[], comment: Comment, parentId?: string): Comment[] {
  if (parentId) {
    return prev.map((c) => {
      if (c.id !== parentId) return c
      const replies = c.replies ?? []
      if (replies.some((r) => r.id === comment.id)) return c
      return { ...c, replies: [...replies, comment] }
    })
  }
  if (prev.some((c) => c.id === comment.id)) return prev
  return [...prev, { ...comment, replies: comment.replies ?? [] }]
}

function replaceComment(prev: Comment[], comment: Comment): Comment[] {
  return prev.map((c) => {
    if (c.id === comment.id) return { ...c, ...comment, replies: c.replies }
    return {
      ...c,
      replies: (c.replies ?? []).map((r) => (r.id === comment.id ? { ...r, ...comment } : r)),
    }
  })
}

function removeCommentFromTree(prev: Comment[], id: string, parentId?: string): Comment[] {
  if (parentId) {
    return prev.map((c) =>
      c.id === parentId ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== id) } : c,
    )
  }
  return prev.filter((c) => c.id !== id)
}

function applyCommentEvent(
  prev: Comment[],
  incoming: {
    action: 'created' | 'updated' | 'deleted'
    id: string
    parentId?: string | null
    body?: string
    createdAt?: string
    updatedAt?: string
    author?: Author
    mentions?: { userId: string }[]
  },
): Comment[] {
  if (incoming.action === 'deleted') {
    return removeCommentFromTree(prev, incoming.id, incoming.parentId ?? undefined)
  }
  const next: Comment = {
    id: incoming.id,
    body: incoming.body ?? '',
    createdAt: incoming.createdAt ?? new Date().toISOString(),
    updatedAt: incoming.updatedAt,
    author: incoming.author ?? { id: '', firstName: null, lastName: null, avatarUrl: null },
    mentions: incoming.mentions ?? [],
  }
  if (incoming.action === 'updated') return replaceComment(prev, next)
  return upsertComment(prev, next, incoming.parentId ?? undefined)
}

function CommentThread({
  comment,
  mentionable,
  canPost,
  currentUserId,
  currentUserIsHost,
  focusCommentId,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: Comment
  mentionable: Mentionable[]
  canPost: boolean
  currentUserId: string | null
  currentUserIsHost: boolean
  focusCommentId: string | null
  onReply: (body: string, mentionUserIds: string[]) => Promise<void>
  onEdit: (id: string, body: string) => Promise<void>
  onDelete: (id: string, parentId?: string) => Promise<void>
}) {
  const [replying, setReplying] = useState(false)

  return (
    <div className="space-y-2">
      <CommentRow
        comment={comment}
        highlighted={focusCommentId === comment.id}
        canEdit={currentUserId === comment.author.id}
        canDelete={currentUserIsHost || currentUserId === comment.author.id}
        onEdit={(body) => onEdit(comment.id, body)}
        onDelete={() => onDelete(comment.id)}
      />
      {(comment.replies ?? []).map((reply) => (
        <div key={reply.id} className="pl-6">
          <CommentRow
            comment={reply}
            highlighted={focusCommentId === reply.id}
            canEdit={currentUserId === reply.author.id}
            canDelete={currentUserIsHost || currentUserId === reply.author.id}
            onEdit={(body) => onEdit(reply.id, body)}
            onDelete={() => onDelete(reply.id, comment.id)}
          />
        </div>
      ))}
      {canPost && !replying && (
        <button
          type="button"
          onClick={() => setReplying(true)}
          className="pl-6 text-[11px] hover:opacity-70"
          style={{ color: 'var(--color-muted)' }}
        >
          Reply
        </button>
      )}
      {replying && (
        <div className="pl-6">
          <Composer
            mentionable={mentionable}
            placeholder="Reply…"
            autoFocus
            onCancel={() => setReplying(false)}
            onSubmit={async (body, ids) => {
              await onReply(body, ids)
              setReplying(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function CommentRow({
  comment,
  highlighted,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  comment: Comment
  highlighted?: boolean
  canEdit: boolean
  canDelete: boolean
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const edited =
    comment.updatedAt &&
    new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000

  if (editing) {
    return (
      <div id={`comment-${comment.id}`} className="space-y-1.5">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full resize-none rounded-lg px-2.5 py-2 text-xs focus:outline-none"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setDraft(comment.body)
            }}
            className="text-[11px]"
            style={{ color: 'var(--color-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={() =>
              start(async () => {
                await onEdit(draft.trim())
                setEditing(false)
              })
            }
            className="text-[11px] font-semibold"
            style={{ color: 'var(--color-brand-primary)' }}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className="group -mx-1 flex items-start gap-2 rounded-lg px-1"
      style={
        highlighted
          ? { background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)' }
          : undefined
      }
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{
          background: 'color-mix(in srgb, var(--color-brand-primary) 15%, transparent)',
          color: 'var(--color-brand-primary)',
        }}
      >
        {(comment.author.firstName?.[0] ?? '?').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px]" style={{ color: 'var(--color-text-primary)' }}>
          <span className="font-medium">{displayName(comment.author)}</span>
          <span className="ml-1.5" style={{ color: 'var(--color-muted)' }}>
            {timeAgo(comment.createdAt)}
          </span>
          {edited && (
            <span className="ml-1" style={{ color: 'var(--color-muted)' }}>
              (edited)
            </span>
          )}
        </p>
        <CommentBody text={comment.body} />
      </div>
      <div className="flex shrink-0 opacity-0 group-hover:opacity-100">
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setDraft(comment.body)
              setEditing(true)
            }}
            className="rounded-md p-1 hover:opacity-70"
            style={{ color: 'var(--color-muted)' }}
            aria-label="Edit comment"
          >
            <Pencil size={11} />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(onDelete)}
            className="rounded-md p-1 hover:opacity-70"
            style={{ color: 'var(--color-muted)' }}
            aria-label="Delete comment"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

function Composer({
  mentionable,
  placeholder,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  mentionable: Mentionable[]
  placeholder: string
  autoFocus?: boolean
  onSubmit: (body: string, mentionUserIds: string[]) => Promise<void>
  onCancel?: () => void
}) {
  const [value, setValue] = useState('')
  const [pending, start] = useTransition()
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [picked, setPicked] = useState<Mentionable[]>([])
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const suggestions = useMemo(() => {
    if (mentionQuery == null) return []
    const q = mentionQuery.toLowerCase()
    return mentionable
      .filter((p) => {
        const name = displayName(p).toLowerCase()
        const email = p.email.toLowerCase()
        return name.includes(q) || email.includes(q)
      })
      .slice(0, 8)
  }, [mentionable, mentionQuery])

  useLayoutEffect(() => {
    if (mentionQuery == null || !ref.current) {
      setMenuPos(null)
      return
    }
    const rect = ref.current.getBoundingClientRect()
    setMenuPos({ top: rect.top, left: rect.left, width: rect.width })
  }, [mentionQuery, suggestions.length, value])

  function onChange(next: string) {
    setValue(next)
    const at = next.lastIndexOf('@')
    if (at >= 0 && (at === 0 || /\s/.test(next[at - 1]))) {
      const q = next.slice(at + 1)
      if (!q.includes(' ') && q.length < 40) setMentionQuery(q)
      else setMentionQuery(null)
    } else {
      setMentionQuery(null)
    }
  }

  function pick(person: Mentionable) {
    const at = value.lastIndexOf('@')
    const insert = `@${displayName(person)} `
    setValue(value.slice(0, at) + insert)
    setPicked((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]))
    setMentionQuery(null)
    ref.current?.focus()
  }

  function submit() {
    const body = value.trim()
    if (!body) return
    const mentionUserIds = picked
      .filter((p) => body.includes(`@${displayName(p)}`))
      .map((p) => p.id)
    start(async () => {
      await onSubmit(body, mentionUserIds)
      setValue('')
      setPicked([])
    })
  }

  const showMenu = mentionQuery != null && menuPos

  return (
    <div className="relative">
      {showMenu &&
        createPortal(
          <div
            className="overflow-hidden rounded-xl shadow-2xl"
            style={{
              position: 'fixed',
              left: menuPos.left,
              width: Math.max(menuPos.width, 220),
              bottom: window.innerHeight - menuPos.top + 6,
              zIndex: 80,
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            {suggestions.length > 0 ? (
              suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(p)
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:opacity-80"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span className="font-medium">{displayName(p)}</span>
                  <span className="ml-1.5" style={{ color: 'var(--color-muted)' }}>
                    {p.email}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-muted)' }}>
                {mentionable.length === 0
                  ? 'Nobody else can see this tab yet. Invite them with access first.'
                  : 'No matching names'}
              </p>
            )}
          </div>,
          document.body,
        )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          autoFocus={autoFocus}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (suggestions[0]) pick(suggestions[0])
              else submit()
            }
            if (e.key === 'Escape') {
              if (mentionQuery != null) setMentionQuery(null)
              else onCancel?.()
            }
          }}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-lg px-2.5 py-2 text-xs focus:outline-none"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          type="button"
          disabled={pending || !value.trim()}
          onClick={submit}
          className="rounded-lg p-2 disabled:opacity-40"
          style={{ color: 'var(--color-brand-primary)' }}
          aria-label="Send"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}
