'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Heart, Loader2, MapPin, Star, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { proxyClient } from '@/lib/proxy-client'
import { queryKeys } from '@/lib/query-keys'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import {
  InspirationDetail,
  type InspirationDetailItem,
} from '@/app/(app)/inspiration/inspiration-detail'

interface LikedLook {
  id: string
  title: string
  description: string
  category: string
  categories?: string[]
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
  media?: InspirationDetailItem['media']
}

interface LikedVendor {
  id: string
  slug: string
  businessName: string
  category: string
  isVerified: boolean
  averageRating: number | null
  totalReviews: number
  city: string | null
  avatarUrl: string | null
}

export function LikesClient() {
  const tCat = useTranslations('vendorCategories')
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'looks' | 'vendors'>('looks')
  const [openLook, setOpenLook] = useState<LikedLook | null>(null)
  const [saveLook, setSaveLook] = useState<LikedLook | null>(null)
  const [events, setEvents] = useState<{ id: string; title: string }[]>([])
  const [eventId, setEventId] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: looks = [], isPending: looksLoading } = useQuery({
    queryKey: queryKeys.likedLooks,
    queryFn: async () => {
      const { data } = await proxyClient.get<LikedLook[]>('/inspiration/liked')
      return Array.isArray(data) ? data : []
    },
  })
  const { data: vendors = [], isPending: vendorsLoading } = useQuery({
    queryKey: queryKeys.likedVendors,
    queryFn: async () => {
      const { data } = await proxyClient.get<LikedVendor[]>('/vendors/favorites')
      return Array.isArray(data) ? data : []
    },
  })
  const loading = looksLoading || vendorsLoading

  async function unlikeLook(item: LikedLook) {
    queryClient.setQueryData<LikedLook[]>(queryKeys.likedLooks, (prev) =>
      (prev ?? []).filter((look) => look.id !== item.id),
    )
    queryClient.setQueryData<string[]>(queryKeys.inspirationLikedIds, (prev) =>
      (prev ?? []).filter((id) => id !== item.id),
    )
    if (openLook?.id === item.id) setOpenLook(null)
    try {
      await proxyClient.delete(`/inspiration/${item.id}/like`)
    } catch {
      queryClient.setQueryData<LikedLook[]>(queryKeys.likedLooks, (prev) => [item, ...(prev ?? [])])
      queryClient.setQueryData<string[]>(queryKeys.inspirationLikedIds, (prev) =>
        prev?.includes(item.id) ? prev : [...(prev ?? []), item.id],
      )
    }
  }

  async function unfavoriteVendor(vendor: LikedVendor) {
    queryClient.setQueryData<LikedVendor[]>(queryKeys.likedVendors, (prev) =>
      (prev ?? []).filter((v) => v.id !== vendor.id),
    )
    try {
      await proxyClient.delete(`/vendors/${vendor.slug}/favorite`)
    } catch {
      queryClient.setQueryData<LikedVendor[]>(queryKeys.likedVendors, (prev) => [
        vendor,
        ...(prev ?? []),
      ])
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1
          className="font-display text-2xl font-semibold"
          style={{ color: 'var(--color-foreground)' }}
        >
          Liked
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
          Looks you liked and vendors you shortlisted. Separate from your event mood boards.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'looks' as const, label: `Looks${looks.length ? ` · ${looks.length}` : ''}` },
          {
            id: 'vendors' as const,
            label: `Vendors${vendors.length ? ` · ${vendors.length}` : ''}`,
          },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className="h-9 rounded-xl px-3 text-sm font-medium"
            style={{
              background: tab === item.id ? 'var(--color-brand-primary)' : 'var(--card-bg)',
              color:
                tab === item.id ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
              border: tab === item.id ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2
            size={28}
            className="animate-spin"
            style={{ color: 'var(--color-brand-primary)' }}
          />
        </div>
      ) : tab === 'looks' ? (
        looks.length === 0 ? (
          <p className="py-12 text-sm" style={{ color: 'var(--color-muted)' }}>
            No liked looks yet. Heart a look on Inspiration or a vendor profile.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {looks.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenLook(item)}
                  className="w-full overflow-hidden rounded-xl text-left"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="aspect-square" style={{ background: 'var(--card-bg)' }}>
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
                  <div className="px-2.5 py-2">
                    <p
                      className="truncate text-xs font-medium"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      {item.title}
                    </p>
                    {(item.likeCount ?? 0) > 0 && (
                      <p
                        className="mt-0.5 inline-flex items-center gap-1 text-[10px]"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        <Heart size={10} /> {item.likeCount}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : vendors.length === 0 ? (
        <p className="py-12 text-sm" style={{ color: 'var(--color-muted)' }}>
          No liked vendors yet. Heart a vendor on their profile to shortlist them.
        </p>
      ) : (
        <ul
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {vendors.map((v) => {
            const initials = v.businessName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
            return (
              <li
                key={v.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
              >
                <Link
                  href={`/vendors/${v.slug}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
                    style={{ background: 'var(--card-bg)' }}
                  >
                    {v.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className="text-xs font-bold"
                        style={{ color: 'var(--color-foreground)' }}
                      >
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      {v.businessName}
                      {v.isVerified && (
                        <BadgeCheck
                          size={13}
                          className="text-gold-700 dark:text-gold-400 ml-1 inline"
                        />
                      )}
                    </p>
                    <p className="truncate text-xs" style={{ color: 'var(--color-muted)' }}>
                      {getVendorCategoryLabel(v.category, tCat)}
                      {v.city && (
                        <span className="ml-2 inline-flex items-center gap-0.5">
                          <MapPin size={10} /> {v.city}
                        </span>
                      )}
                      {v.totalReviews > 0 && v.averageRating != null && (
                        <span className="ml-2 inline-flex items-center gap-0.5">
                          <Star size={10} /> {v.averageRating.toFixed(1)}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void unfavoriteVendor(v)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: 'var(--color-brand-primary)',
                    color: 'var(--color-primary-foreground)',
                  }}
                  aria-label={`Unlike ${v.businessName}`}
                >
                  <Heart size={14} className="fill-current" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {openLook && (
        <InspirationDetail
          item={openLook}
          saved={false}
          liked
          likeCount={openLook.likeCount ?? 0}
          onClose={() => setOpenLook(null)}
          onSaveClick={() => {
            setSaveLook(openLook)
            proxyClient
              .get<{ id: string; title: string }[]>('/events')
              .then(({ data }) => {
                const list = Array.isArray(data) ? data : []
                setEvents(list)
                setEventId(list.length === 1 ? list[0].id : '')
              })
              .catch(() => setEvents([]))
          }}
          onLikeClick={() => void unlikeLook(openLook)}
          onFindVendors={() => setOpenLook(null)}
        />
      )}

      {saveLook && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSaveLook(null)} />
          <div
            className="relative w-full max-w-sm space-y-3 rounded-2xl p-5"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                Save to mood board
              </h3>
              <button type="button" onClick={() => setSaveLook(null)} aria-label="Close">
                <X size={16} style={{ color: 'var(--color-muted)' }} />
              </button>
            </div>
            {events.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Create an event first, then save looks to it.
              </p>
            ) : (
              <>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
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
                <button
                  type="button"
                  disabled={saving || !eventId}
                  onClick={() => {
                    setSaving(true)
                    proxyClient
                      .post(`/inspiration/${saveLook.id}/save`, { eventId })
                      .then(() => setSaveLook(null))
                      .catch(() => {})
                      .finally(() => setSaving(false))
                  }}
                  className="h-9 w-full rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{
                    background: 'var(--color-brand-primary)',
                    color: 'var(--color-primary-foreground)',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
