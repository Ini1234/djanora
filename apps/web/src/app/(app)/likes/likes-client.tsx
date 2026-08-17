'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Heart, Loader2, MapPin, Star, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { proxyClient } from '@/lib/proxy-client'
import { queryKeys } from '@/lib/query-keys'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import { InspirationDetail, type InspirationDetailItem } from '@/app/(app)/inspiration/inspiration-detail'

interface LikedLook {
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
      queryClient.setQueryData<LikedVendor[]>(queryKeys.likedVendors, (prev) => [vendor, ...(prev ?? [])])
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
          Liked
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          Looks you liked and vendors you shortlisted. Separate from your event mood boards.
        </p>
      </div>

      <div className="flex gap-2">
        {([
          { id: 'looks' as const, label: `Looks${looks.length ? ` · ${looks.length}` : ''}` },
          { id: 'vendors' as const, label: `Vendors${vendors.length ? ` · ${vendors.length}` : ''}` },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className="h-9 px-3 rounded-xl text-sm font-medium"
            style={{
              background: tab === item.id ? 'var(--color-brand-primary)' : 'var(--card-bg)',
              color: tab === item.id ? '#fff' : 'var(--color-foreground)',
              border: tab === item.id ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-brand-primary)' }} />
        </div>
      ) : tab === 'looks' ? (
        looks.length === 0 ? (
          <p className="text-sm py-12" style={{ color: 'var(--color-muted)' }}>
            No liked looks yet. Heart a look on Inspiration or a vendor profile.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {looks.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenLook(item)}
                  className="w-full text-left rounded-xl overflow-hidden"
                  style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                >
                  <div className="aspect-square" style={{ background: 'var(--card-bg)' }}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--color-muted)' }}>
                        Look
                      </div>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                      {item.title}
                    </p>
                    {(item.likeCount ?? 0) > 0 && (
                      <p className="text-[10px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--color-muted)' }}>
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
        <p className="text-sm py-12" style={{ color: 'var(--color-muted)' }}>
          No liked vendors yet. Heart a vendor on their profile to shortlist them.
        </p>
      ) : (
        <ul className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {vendors.map((v) => {
            const initials = v.businessName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
            return (
              <li
                key={v.id}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
              >
                <Link href={`/vendors/${v.slug}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: 'var(--card-bg)' }}
                  >
                    {v.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold" style={{ color: 'var(--color-foreground)' }}>{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                      {v.businessName}
                      {v.isVerified && <BadgeCheck size={13} className="inline ml-1 text-gold-700 dark:text-gold-400" />}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                      {getVendorCategoryLabel(v.category, tCat)}
                      {v.city && (
                        <span className="inline-flex items-center gap-0.5 ml-2">
                          <MapPin size={10} /> {v.city}
                        </span>
                      )}
                      {v.totalReviews > 0 && v.averageRating != null && (
                        <span className="inline-flex items-center gap-0.5 ml-2">
                          <Star size={10} /> {v.averageRating.toFixed(1)}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void unfavoriteVendor(v)}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
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
            proxyClient.get<{ id: string; title: string }[]>('/events')
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
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSaveLook(null)} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>Save to mood board</h3>
              <button type="button" onClick={() => setSaveLook(null)} aria-label="Close">
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
                <button
                  type="button"
                  disabled={saving || !eventId}
                  onClick={() => {
                    setSaving(true)
                    proxyClient.post(`/inspiration/${saveLook.id}/save`, { eventId })
                      .then(() => setSaveLook(null))
                      .catch(() => {})
                      .finally(() => setSaving(false))
                  }}
                  className="w-full h-9 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
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
