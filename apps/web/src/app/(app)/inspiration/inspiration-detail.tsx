'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  Users,
  X,
} from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { backend } from '@/lib/backend'
import { InquiryModal } from '@/components/inquiries/inquiry-modal'
import type { UserMe } from '@/lib/api.types'

export interface InspirationDetailItem {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  tagItems?: { slug: string; label: string }[]
  imageUrl: string | null
  location: string | null
  priceRangeFrom: number | null
  priceRangeTo: number | null
  currency: string
  costNote?: string | null
  likeCount?: number
  saveCount?: number
  vendorProfile: {
    id: string
    slug: string
    businessName: string
    isVerified: boolean
    avatarUrl: string | null
    city: string | null
  } | null
  media?: {
    id: string
    url: string
    mediaType: 'IMAGE' | 'VIDEO' | 'EXTERNAL'
    isCover: boolean
  }[]
}

interface Comment {
  id: string
  body: string
  createdAt: string
  author: {
    id: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }
}

function authorName(c: Comment) {
  return [c.author.firstName, c.author.lastName].filter(Boolean).join(' ') || 'Guest'
}

export function InspirationDetail({
  item,
  saved,
  liked = false,
  likeCount = 0,
  onClose,
  onSaveClick,
  onLikeClick,
  onFindVendors,
  signedIn,
  authRedirect,
}: {
  item: InspirationDetailItem
  saved: boolean
  liked?: boolean
  likeCount?: number
  onClose: () => void
  onSaveClick: () => void
  onLikeClick?: () => void
  onFindVendors: () => void
  signedIn?: boolean
  authRedirect?: string
}) {
  const router = useRouter()
  const [detail, setDetail] = useState(item)
  const [idx, setIdx] = useState(0)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [me, setMe] = useState<UserMe | null>(null)
  const [meLoaded, setMeLoaded] = useState(signedIn === true || signedIn === false)
  const [askOpen, setAskOpen] = useState(false)
  const [error, setError] = useState('')
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const returnTo = authRedirect ?? `/inspiration?item=${item.id}`
  const canAct = signedIn === true || (signedIn !== false && me != null)

  function requireAuth(then: () => void) {
    if (canAct) {
      then()
      return
    }
    if (!meLoaded && signedIn !== false) return
    router.push(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`)
  }

  useEffect(() => {
    setDetail(item)
    setIdx(0)
    backend
      .get<InspirationDetailItem>(`/inspiration/${item.id}`)
      .then(({ data }) => {
        if (data) setDetail(data)
      })
      .catch(() => {})
  }, [item.id])

  useEffect(() => {
    if (signedIn === false) {
      setMe(null)
      setMeLoaded(true)
      return
    }
    if (signedIn === true) setMeLoaded(true)
    proxyClient
      .get<UserMe>('/users/me')
      .then(({ data }) => setMe(data))
      .catch(() => setMe(null))
      .finally(() => setMeLoaded(true))
  }, [signedIn])

  useEffect(() => {
    setLoadingComments(true)
    backend
      .get<Comment[]>(`/inspiration/${item.id}/comments`)
      .then(({ data }) => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false))
  }, [item.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !askOpen) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [askOpen])

  const media =
    detail.media && detail.media.length > 0
      ? detail.media
      : detail.imageUrl
        ? [{ id: 'cover', url: detail.imageUrl, mediaType: 'IMAGE' as const, isCover: true }]
        : []
  const current = media[idx]

  async function submitComment() {
    const body = draft.trim()
    if (!body) return
    setPosting(true)
    setError('')
    try {
      const { data } = await proxyClient.post<Comment>(`/inspiration/${item.id}/comments`, { body })
      setComments((prev) => [...prev, data])
      setDraft('')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 401) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`)
        return
      }
      setError('Could not post comment')
    } finally {
      setPosting(false)
    }
  }

  async function removeComment(id: string) {
    try {
      await proxyClient.delete(`/inspiration/${item.id}/comments/${id}`)
      setComments((prev) => prev.filter((c) => c.id !== id))
    } catch {
      setError('Could not delete comment')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative flex max-h-[100vh] w-full max-w-4xl flex-col overflow-hidden border shadow-2xl sm:max-h-[90vh] sm:flex-row sm:rounded-2xl"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <div
            className="relative aspect-[4/3] sm:aspect-auto sm:min-h-[420px] sm:w-[52%]"
            style={{ background: 'var(--card-bg)' }}
          >
            {current?.mediaType === 'EXTERNAL' ? (
              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full w-full flex-col items-center justify-center gap-2"
              >
                <ExternalLink size={22} style={{ color: 'var(--color-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Open linked media
                </span>
              </a>
            ) : current ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={detail.title} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-sm"
                style={{ color: 'var(--color-muted)' }}
              >
                No photo
              </div>
            )}
            {media.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIdx((i) => (i - 1 + media.length) % media.length)}
                  className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
                  aria-label="Previous"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIdx((i) => (i + 1) % media.length)}
                  className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
                  aria-label="Next"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white sm:hidden"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex max-h-[55vh] min-h-0 flex-1 flex-col sm:max-h-[90vh]">
            <div
              className="flex items-start justify-between gap-3 border-b px-5 py-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="min-w-0">
                <p
                  className="text-[10px] font-semibold tracking-wider uppercase"
                  style={{ color: 'var(--color-brand-primary)' }}
                >
                  {detail.category}
                </p>
                <h2
                  className="font-display text-lg leading-snug font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {detail.title}
                </h2>
                {detail.vendorProfile && (
                  <Link
                    href={`/vendors/${detail.vendorProfile.slug}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: 'var(--color-brand-primary)' }}
                  >
                    {detail.vendorProfile.businessName}
                    {detail.vendorProfile.isVerified && ' · Verified'}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="hidden p-1.5 sm:flex"
                aria-label="Close"
              >
                <X size={18} style={{ color: 'var(--color-muted)' }} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {detail.description && (
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {detail.description}
                </p>
              )}

              {((detail.tagItems && detail.tagItems.length > 0) || detail.tags.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {(detail.tagItems ?? detail.tags.map((label) => ({ slug: label, label }))).map(
                    (tag) => (
                      <span
                        key={tag.slug}
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ background: 'var(--card-bg)', color: 'var(--color-muted)' }}
                      >
                        {tag.label}
                      </span>
                    ),
                  )}
                </div>
              )}

              <div
                className="flex flex-wrap gap-3 text-[12px]"
                style={{ color: 'var(--color-muted)' }}
              >
                {(detail.location || detail.vendorProfile?.city) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {detail.location ?? detail.vendorProfile?.city}
                  </span>
                )}
                {(detail.saveCount ?? 0) > 0 && <span>Saved by {detail.saveCount}</span>}
                {detail.priceRangeFrom != null && (
                  <span className="inline-flex items-center gap-1">
                    <DollarSign size={11} />
                    {detail.currency}
                    {detail.priceRangeFrom.toLocaleString()}
                    {detail.priceRangeTo ? `–${detail.priceRangeTo.toLocaleString()}` : '+'}
                  </span>
                )}
              </div>
              {detail.costNote && (
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {detail.costNote}
                </p>
              )}

              <div
                className="space-y-3 border-t pt-2"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <p
                  className="text-[10px] font-semibold tracking-wider uppercase"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Comments {comments.length > 0 && `· ${comments.length}`}
                </p>
                {loadingComments ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                    style={{ color: 'var(--color-muted)' }}
                  />
                ) : comments.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    No comments yet. Ask a question or share a thought.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {comments.map((c) => (
                      <li key={c.id} className="flex gap-2">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold"
                          style={{ background: 'var(--card-bg)', color: 'var(--color-muted)' }}
                        >
                          {c.author.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.author.avatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            authorName(c).slice(0, 1)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p
                              className="text-xs font-medium"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {authorName(c)}
                            </p>
                            {me?.id === c.author.id && (
                              <button
                                type="button"
                                onClick={() => void removeComment(c.id)}
                                className="text-[10px]"
                                style={{ color: 'var(--color-muted)' }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          <p
                            className="text-xs leading-relaxed whitespace-pre-wrap"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {c.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {error && (
                  <p className="text-xs" style={{ color: 'var(--color-error, #c45c4a)' }}>
                    {error}
                  </p>
                )}
                {!meLoaded ? (
                  <div className="h-9" />
                ) : canAct ? (
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void submitComment()
                        }
                      }}
                      placeholder="Write a comment…"
                      maxLength={2000}
                      className="h-9 flex-1 rounded-xl px-3 text-sm"
                      style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-foreground)',
                      }}
                    />
                    <button
                      type="button"
                      disabled={posting || !draft.trim()}
                      onClick={() => void submitComment()}
                      className="h-9 rounded-xl px-3 text-sm font-medium disabled:opacity-40"
                      style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
                      aria-label="Post comment"
                    >
                      {posting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => requireAuth(() => {})}
                    className="h-9 w-full rounded-xl text-xs font-semibold"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-foreground)',
                    }}
                  >
                    Sign in to comment
                  </button>
                )}
              </div>
            </div>

            <div
              className="flex flex-wrap gap-2 border-t px-5 py-3"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <button
                type="button"
                onClick={() => requireAuth(() => onLikeClick?.())}
                className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold"
                style={{
                  background: liked ? 'var(--color-brand-primary)' : 'var(--card-bg)',
                  color: liked ? '#fff' : 'var(--color-foreground)',
                  border: liked ? 'none' : '1px solid var(--color-border)',
                }}
                aria-pressed={liked}
                aria-label={liked ? 'Unlike this look' : 'Like this look'}
              >
                <Heart size={13} className={liked ? 'fill-current' : ''} />
                {likeCount > 0 ? likeCount : 'Like'}
              </button>
              <button
                type="button"
                onClick={() => requireAuth(onSaveClick)}
                className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold"
                style={{
                  background: saved ? 'var(--color-brand-primary)' : 'var(--card-bg)',
                  color: saved ? '#fff' : 'var(--color-foreground)',
                  border: saved ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                {saved ? 'Saved' : 'Save'}
              </button>
              {detail.vendorProfile ? (
                <button
                  type="button"
                  onClick={() => requireAuth(() => setAskOpen(true))}
                  className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold"
                  style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
                >
                  <MessageSquare size={13} /> Ask {detail.vendorProfile.businessName}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => requireAuth(onFindVendors)}
                  className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold"
                  style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
                >
                  <Users size={13} /> Find matching vendors
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {askOpen && detail.vendorProfile && (
        <InquiryModal
          vendor={detail.vendorProfile}
          post={{ id: detail.id, title: detail.title }}
          onClose={() => setAskOpen(false)}
        />
      )}
    </>
  )
}
