'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BadgeCheck,
  MapPin,
  Globe,
  ExternalLink,
  Link2,
  X,
  ChevronLeft,
  Heart,
  Star,
  MessageSquare,
} from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import { useTranslations } from 'next-intl'
import { InquiryModal } from '@/components/inquiries/inquiry-modal'
import { InspirationDetail } from '@/app/(app)/inspiration/inspiration-detail'

export interface VendorProfile {
  id: string
  slug: string
  businessName: string
  category: string
  categories: string[]
  bio: string | null
  tribesServed: string[]
  isVerified: boolean
  averageRating: number | null
  totalReviews: number
  estimatedPriceFrom: number | null
  estimatedPriceTo: number | null
  currency: string | null
  websiteUrl: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  externalPortfolioUrl: string | null
  externalPortfolioLabel: string | null
  city: string | null
  avatarUrl: string | null
  ownerName: string | null
  favoriteCount?: number
  reviews?: {
    id: string
    rating: number
    comment: string | null
    createdAt: string
    authorName: string
  }[]
  posts?: VendorLook[]
}

export interface VendorLook {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  imageUrl: string | null
  location: string | null
  priceRangeFrom: number | null
  priceRangeTo: number | null
  currency: string
  costNote: string | null
  visibility: 'PROFILE' | 'INSPIRATION'
  likeCount?: number
  saveCount?: number
  media: {
    id: string
    url: string
    mediaType: 'IMAGE' | 'VIDEO' | 'EXTERNAL'
    isCover: boolean
  }[]
}

interface UserEvent {
  id: string
  title: string
  date: string | null
}

function SaveLookModal({ post, onClose }: { post: VendorLook; onClose: () => void }) {
  const [events, setEvents] = useState<UserEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    proxyClient
      .get('/events')
      .then(({ data }) => {
        const list: UserEvent[] = Array.isArray(data)
          ? data.map((e: { id: string; title: string; date?: string | null }) => ({
              id: e.id,
              title: e.title,
              date: e.date ?? null,
            }))
          : []
        setEvents(list)
        if (list.length === 1) setSelectedEventId(list[0].id)
      })
      .catch(() => setEvents([]))
  }, [])

  async function save() {
    if (!selectedEventId) return
    setSaving(true)
    setError('')
    try {
      await proxyClient.post(`/inspiration/${post.id}/save`, { eventId: selectedEventId })
      setDone(true)
    } catch (err: unknown) {
      setError(apiError(err, 'Could not save this look'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-sm space-y-3 rounded-2xl p-5"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
            Save to mood board
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} style={{ color: 'var(--color-muted)' }} />
          </button>
        </div>
        {done ? (
          <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
            Saved to your event mood board.
          </p>
        ) : events.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Create an event first, then save looks to it.
          </p>
        ) : (
          <>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="h-9 w-full rounded-xl px-3 text-sm"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              <option value="">Choose an event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            {error && (
              <p className="text-xs" style={{ color: 'var(--color-error, #c45c4a)' }}>
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={saving || !selectedEventId}
              onClick={() => void save()}
              className="h-9 w-full rounded-xl text-sm font-semibold disabled:opacity-40"
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

function apiError(err: unknown, fallback: string) {
  const msg = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
  return typeof msg === 'string' ? msg : fallback
}

export function VendorProfileClient({
  vendor,
  signedIn,
}: {
  vendor: VendorProfile
  signedIn: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tCat = useTranslations('vendorCategories')
  const [showModal, setShowModal] = useState(false)
  const [savePost, setSavePost] = useState<VendorLook | null>(null)
  const [openPost, setOpenPost] = useState<VendorLook | null>(null)
  const [favorited, setFavorited] = useState(false)
  const [ownProfile, setOwnProfile] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(vendor.favoriteCount ?? 0)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const post of vendor.posts ?? []) initial[post.id] = post.likeCount ?? 0
    return initial
  })
  const [reviews, setReviews] = useState(vendor.reviews ?? [])
  const [rating, setRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewPending, startReview] = useTransition()
  const wantReview = searchParams.get('review') === '1'
  const profilePath = `/vendors/${vendor.slug}`
  const [reviewStatus, setReviewStatus] = useState<{
    canReview: boolean
    alreadyReviewed: boolean
    unauthenticated?: boolean
  } | null>(signedIn ? null : { canReview: false, alreadyReviewed: false, unauthenticated: true })

  function signInTo(path: string) {
    router.push(`/sign-in?redirect_url=${encodeURIComponent(path)}`)
  }

  function contactVendor() {
    if (!signedIn) {
      signInTo(`${profilePath}?inquire=1`)
      return
    }
    setShowModal(true)
  }

  useEffect(() => {
    if (!signedIn) return
    void proxyClient.post(`/vendors/${vendor.slug}/view`).catch(() => {})
  }, [signedIn, vendor.slug])

  useEffect(() => {
    if (!signedIn) return
    proxyClient
      .get<{ favorited: boolean; favoriteCount: number; ownProfile?: boolean }>(
        `/vendors/${vendor.slug}/favorite-status`,
      )
      .then(({ data }) => {
        setFavorited(Boolean(data?.favorited))
        setOwnProfile(Boolean(data?.ownProfile))
        if (typeof data?.favoriteCount === 'number') setFavoriteCount(data.favoriteCount)
      })
      .catch(() => {})
    proxyClient
      .get<string[]>('/inspiration/liked/ids')
      .then(({ data }) => setLikedIds(new Set(Array.isArray(data) ? data : [])))
      .catch(() => setLikedIds(new Set()))
  }, [signedIn, vendor.slug])

  async function toggleFavorite() {
    if (!signedIn) {
      signInTo(profilePath)
      return
    }
    const next = !favorited
    setFavorited(next)
    setFavoriteCount((n) => Math.max(0, n + (next ? 1 : -1)))
    try {
      const { data } = next
        ? await proxyClient.post<{ favorited: boolean; favoriteCount: number }>(
            `/vendors/${vendor.slug}/favorite`,
          )
        : await proxyClient.delete<{ favorited: boolean; favoriteCount: number }>(
            `/vendors/${vendor.slug}/favorite`,
          )
      if (typeof data?.favoriteCount === 'number') setFavoriteCount(data.favoriteCount)
      setFavorited(Boolean(data?.favorited))
    } catch {
      setFavorited(!next)
      setFavoriteCount((n) => Math.max(0, n + (next ? -1 : 1)))
    }
  }

  async function toggleLookLike(post: VendorLook) {
    if (!signedIn) {
      signInTo(`${profilePath}?look=${post.id}`)
      return
    }
    const next = !likedIds.has(post.id)
    setLikedIds((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(post.id)
      else copy.delete(post.id)
      return copy
    })
    setLikeCounts((prev) => ({
      ...prev,
      [post.id]: Math.max(0, (prev[post.id] ?? 0) + (next ? 1 : -1)),
    }))
    try {
      if (next) await proxyClient.post(`/inspiration/${post.id}/like`)
      else await proxyClient.delete(`/inspiration/${post.id}/like`)
    } catch {
      setLikedIds((prev) => {
        const copy = new Set(prev)
        if (next) copy.delete(post.id)
        else copy.add(post.id)
        return copy
      })
      setLikeCounts((prev) => ({
        ...prev,
        [post.id]: Math.max(0, (prev[post.id] ?? 0) + (next ? -1 : 1)),
      }))
    }
  }

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    proxyClient
      .get<{ canReview: boolean; alreadyReviewed: boolean }>(
        `/vendors/${vendor.slug}/review-status`,
      )
      .then(({ data }) => {
        if (!cancelled) setReviewStatus(data)
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } }).response?.status
        if (!cancelled) {
          setReviewStatus({
            canReview: false,
            alreadyReviewed: false,
            unauthenticated: status === 401,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [signedIn, vendor.slug])

  useEffect(() => {
    if (signedIn && searchParams.get('inquire') === '1') setShowModal(true)
  }, [signedIn, searchParams])

  useEffect(() => {
    const lookId = searchParams.get('look')
    if (!lookId || !vendor.posts) return
    const post = vendor.posts.find((p) => p.id === lookId)
    if (post) setOpenPost(post)
  }, [searchParams, vendor.posts])

  const priceLabel = (() => {
    const { estimatedPriceFrom: from, estimatedPriceTo: to, currency } = vendor
    if (!from && !to) return null
    const sym = currency === 'CAD' ? 'CA$' : currency === 'USD' ? 'US$' : (currency ?? '$')
    if (from && to) return `${sym}${from.toLocaleString()} – ${sym}${to.toLocaleString()}`
    if (from) return `From ${sym}${from.toLocaleString()}`
    return `Up to ${sym}${to!.toLocaleString()}`
  })()

  const initials = vendor.businessName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={signedIn ? '/vendors' : '/'}
          className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-muted)' }}
        >
          <ChevronLeft size={15} />
          {signedIn ? 'Back to vendors' : 'Home'}
        </Link>

        <div
          className="rounded-2xl border p-6"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-2 ring-black/8 dark:ring-white/10"
              style={{ background: 'var(--card-bg)' }}
            >
              {vendor.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vendor.avatarUrl}
                  alt={vendor.businessName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold" style={{ color: 'var(--color-foreground)' }}>
                  {initials}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="font-display text-xl font-semibold"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  {vendor.businessName}
                </h1>
                {vendor.isVerified && (
                  <BadgeCheck
                    size={18}
                    className="text-gold-700 dark:text-gold-400 shrink-0"
                    aria-label="Verified"
                  />
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  {getVendorCategoryLabel(vendor.category, tCat)}
                </span>
                {vendor.city && (
                  <span
                    className="flex items-center gap-1 text-sm"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <MapPin size={12} />
                    {vendor.city}
                  </span>
                )}
                {vendor.totalReviews > 0 && vendor.averageRating != null && (
                  <span
                    className="flex items-center gap-1 text-sm"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <Star size={12} className="text-gold-600 fill-gold-600" />
                    {vendor.averageRating.toFixed(1)}
                    <span>({vendor.totalReviews})</span>
                  </span>
                )}
              </div>

              {vendor.categories.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {vendor.categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-full border px-2.5 py-0.5 text-xs"
                      style={{
                        background: 'rgba(201,151,58,0.10)',
                        borderColor: 'rgba(201,151,58,0.25)',
                        color: 'var(--color-gold-800, #8b6200)',
                      }}
                    >
                      {getVendorCategoryLabel(cat, tCat)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!ownProfile && (
                <button
                  type="button"
                  onClick={() => void toggleFavorite()}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    background: favorited ? 'var(--color-brand-primary)' : 'var(--card-bg)',
                    color: favorited ? '#fff' : 'var(--color-foreground)',
                    border: favorited ? 'none' : '1px solid var(--color-border)',
                  }}
                  aria-pressed={favorited}
                  aria-label={favorited ? 'Remove from liked vendors' : 'Like this vendor'}
                >
                  <Heart size={15} className={favorited ? 'fill-current' : ''} />
                  {favoriteCount > 0 ? favoriteCount : null}
                </button>
              )}
              <button
                type="button"
                onClick={contactVendor}
                className="bg-gold-600 hover:bg-gold-700 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors"
              >
                <MessageSquare size={15} />
                Contact
              </button>
            </div>
          </div>

          {vendor.bio && (
            <p className="mt-5 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {vendor.bio}
            </p>
          )}

          <div
            className="mt-5 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {priceLabel && (
              <div>
                <p className="mb-0.5 text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
                  Starting price
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {priceLabel}
                </p>
              </div>
            )}
            {vendor.tribesServed.length > 0 && (
              <div>
                <p className="mb-0.5 text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
                  Communities served
                </p>
                <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                  {vendor.tribesServed.join(', ')}
                </p>
              </div>
            )}
          </div>

          {(vendor.websiteUrl ||
            vendor.instagramUrl ||
            vendor.facebookUrl ||
            vendor.externalPortfolioUrl) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {vendor.websiteUrl && (
                <a
                  href={vendor.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:underline"
                  style={{ color: 'var(--color-gold-800, #8b6200)' }}
                >
                  <Globe size={14} />
                  Website
                </a>
              )}
              {vendor.instagramUrl && (
                <a
                  href={vendor.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:underline"
                  style={{ color: 'var(--color-gold-800, #8b6200)' }}
                >
                  <ExternalLink size={14} />
                  Instagram
                </a>
              )}
              {vendor.facebookUrl && (
                <a
                  href={vendor.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:underline"
                  style={{ color: 'var(--color-gold-800, #8b6200)' }}
                >
                  <Link2 size={14} />
                  Facebook
                </a>
              )}
              {vendor.externalPortfolioUrl && (
                <a
                  href={vendor.externalPortfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:underline"
                  style={{ color: 'var(--color-gold-800, #8b6200)' }}
                >
                  <ExternalLink size={14} />
                  {vendor.externalPortfolioLabel || 'Portfolio'}
                </a>
              )}
            </div>
          )}
        </div>

        {(vendor.posts?.length ?? 0) > 0 && (
          <section
            className="space-y-4 rounded-2xl border p-6"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
              Looks
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {vendor.posts!.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenPost(item)}
                    className="w-full overflow-hidden rounded-xl text-left"
                    style={{ background: 'var(--card-bg)' }}
                  >
                    <div className="aspect-square">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-xs"
                          style={{ color: 'var(--color-muted)' }}
                        >
                          Look
                        </div>
                      )}
                    </div>
                    <p
                      className="truncate px-2 py-1.5 text-xs font-medium"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      {item.title}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          id="reviews"
          className="space-y-4 rounded-2xl border p-6"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
            Reviews {reviews.length > 0 && `· ${reviews.length}`}
          </h2>
          {reviews.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              No reviews yet.
            </p>
          )}
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                  {r.authorName}{' '}
                  <span className="font-normal" style={{ color: 'var(--color-muted)' }}>
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </span>
                </p>
                {r.comment && (
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {r.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {reviewStatus?.unauthenticated && (
            <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Sign in to leave a review.
              </p>
              <button
                type="button"
                onClick={() => signInTo(`${profilePath}?review=1`)}
                className="h-9 rounded-xl px-4 text-sm font-semibold"
                style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
              >
                Sign in
              </button>
            </div>
          )}
          {reviewStatus?.alreadyReviewed && wantReview && (
            <p
              className="border-t pt-3 text-xs"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              You’ve already reviewed this vendor.
            </p>
          )}
          {reviewStatus &&
            !reviewStatus.canReview &&
            !reviewStatus.alreadyReviewed &&
            !reviewStatus.unauthenticated &&
            wantReview && (
              <p
                className="border-t pt-3 text-xs"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                You can review after marking this vendor as booked.
              </p>
            )}
          {reviewStatus?.canReview && (
            <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--color-foreground)' }}>
                {wantReview ? 'Leave a review' : 'Booked this vendor? Leave a review'}
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="text-lg leading-none"
                    aria-label={`${n} stars`}
                  >
                    {n <= rating ? '★' : '☆'}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                placeholder="How was working with them?"
                className="w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
              {reviewError && (
                <p className="text-xs" style={{ color: 'var(--color-error, #c45c4a)' }}>
                  {reviewError}
                </p>
              )}
              <button
                type="button"
                disabled={reviewPending}
                onClick={() => {
                  setReviewError('')
                  startReview(async () => {
                    try {
                      const { data } = await proxyClient.post<{
                        id: string
                        rating: number
                        comment: string | null
                        createdAt: string
                      }>(`/vendors/${vendor.slug}/reviews`, {
                        rating,
                        comment: reviewBody.trim() || undefined,
                      })
                      setReviews((prev) => [
                        {
                          id: data.id,
                          rating: data.rating,
                          comment: data.comment,
                          createdAt: data.createdAt,
                          authorName: 'You',
                        },
                        ...prev,
                      ])
                      setReviewBody('')
                      setReviewStatus({ canReview: false, alreadyReviewed: true })
                    } catch (err: unknown) {
                      const status = (
                        err as { response?: { status?: number; data?: { message?: string } } }
                      ).response
                      if (status?.status === 401) {
                        signInTo(`${profilePath}?review=1`)
                        return
                      }
                      setReviewError(
                        typeof status?.data?.message === 'string'
                          ? status.data.message
                          : 'Could not submit review',
                      )
                    }
                  })
                }}
                className="h-9 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
              >
                {reviewPending ? 'Sending…' : 'Submit review'}
              </button>
            </div>
          )}
        </section>
      </div>
      {showModal && <InquiryModal vendor={vendor} onClose={() => setShowModal(false)} />}
      {savePost && <SaveLookModal post={savePost} onClose={() => setSavePost(null)} />}
      {openPost && (
        <InspirationDetail
          item={{
            ...openPost,
            likeCount: likeCounts[openPost.id] ?? openPost.likeCount ?? 0,
            vendorProfile: {
              id: vendor.id,
              slug: vendor.slug,
              businessName: vendor.businessName,
              isVerified: vendor.isVerified,
              avatarUrl: vendor.avatarUrl,
              city: vendor.city,
            },
          }}
          saved={false}
          liked={likedIds.has(openPost.id)}
          likeCount={likeCounts[openPost.id] ?? openPost.likeCount ?? 0}
          signedIn={signedIn}
          authRedirect={`${profilePath}?look=${openPost.id}`}
          onClose={() => setOpenPost(null)}
          onSaveClick={() => setSavePost(openPost)}
          onLikeClick={() => void toggleLookLike(openPost)}
          onFindVendors={() => setOpenPost(null)}
        />
      )}
    </>
  )
}
