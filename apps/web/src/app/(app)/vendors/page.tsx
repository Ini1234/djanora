'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, BadgeCheck, Star, MapPin, ArrowRight, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VENDOR_CATEGORY_KEYS, getVendorCategoryLabel } from '@/lib/vendor-categories'
import { proxyClient } from '@/lib/proxy-client'

interface VendorListing {
  id: string
  slug: string
  businessName: string
  category: string
  isVerified: boolean
  averageRating: number | null
  totalReviews: number
  estimatedPriceFrom: number | null
  estimatedPriceTo: number | null
  currency: string | null
  city: string | null
  avatarUrl: string | null
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div
      className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center ring-1 ring-black/8 dark:ring-white/10"
      style={{ background: 'var(--card-bg)' }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-bold" style={{ color: 'var(--color-foreground)' }}>{initials}</span>
      )}
    </div>
  )
}

function PriceTag({ from, to, currency }: { from: number | null; to: number | null; currency: string | null }) {
  if (!from && !to) return <span style={{ color: 'var(--color-muted)' }}>—</span>
  const sym = currency === 'CAD' ? 'CA$' : currency === 'USD' ? 'US$' : (currency ?? '$')
  if (from && to) return <span>{sym}{from.toLocaleString()} – {sym}{to.toLocaleString()}</span>
  if (from) return <span>From {sym}{from.toLocaleString()}</span>
  return <span>Up to {sym}{to!.toLocaleString()}</span>
}

export default function VendorsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tCat = useTranslations('vendorCategories')

  const [vendors, setVendors] = useState<VendorListing[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(searchParams.get('category') ?? 'ALL')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = activeCategory !== 'ALL' ? `?category=${activeCategory}` : ''
    proxyClient.get(`/vendors${params}`)
      .then(({ data }) => setVendors(Array.isArray(data) ? data : []))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false))
  }, [activeCategory])

  function selectCategory(cat: string) {
    setActiveCategory(cat)
    const params = new URLSearchParams(searchParams.toString())
    if (cat === 'ALL') params.delete('category')
    else params.set('category', cat)
    router.replace(`/vendors?${params.toString()}`, { scroll: false })
  }

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vendors
    return vendors.filter((v) =>
      v.businessName.toLowerCase().includes(q) ||
      (v.city?.toLowerCase().includes(q) ?? false),
    )
  }, [vendors, query])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
          Find Vendors
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-muted)' }}>
          Browse vetted service providers for your event
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-muted)' }} />
          <input
            type="search"
            placeholder="Search name or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition"
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all"
          style={{
            background: showFilters ? 'rgba(201,151,58,0.12)' : 'var(--card-bg)',
            borderColor: showFilters ? 'rgba(201,151,58,0.35)' : 'var(--color-border)',
            color: showFilters ? 'var(--color-gold-700, #a87b10)' : 'var(--color-foreground)',
          }}
        >
          <SlidersHorizontal size={14} />
          Filter
          {activeCategory !== 'ALL' && (
            <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
          )}
        </button>
      </div>

      {/* Category filter — collapsible */}
      {showFilters && (
        <div
          className="flex flex-wrap gap-1.5 py-3 px-4 rounded-xl border"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--color-border)' }}
        >
          {['ALL', ...VENDOR_CATEGORY_KEYS].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectCategory(key)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={activeCategory === key ? {
                background: '#c9973a',
                borderColor: '#c9973a',
                color: '#ffffff',
              } : {
                background: 'transparent',
                borderColor: 'var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              {key === 'ALL' ? 'All categories' : getVendorCategoryLabel(key, tCat)}
            </button>
          ))}
        </div>
      )}

      {/* Active filter pill */}
      {activeCategory !== 'ALL' && !showFilters && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Filtered by:</span>
          <button
            onClick={() => selectCategory('ALL')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              background: 'rgba(201,151,58,0.12)',
              border: '1px solid rgba(201,151,58,0.3)',
              color: 'var(--color-gold-800, #8b6200)',
            }}
          >
            {getVendorCategoryLabel(activeCategory, tCat)}
            <X size={10} />
          </button>
        </div>
      )}

      {/* Results count */}
      {!loading && displayed.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {displayed.length} vendor{displayed.length !== 1 ? 's' : ''}
          {activeCategory !== 'ALL' ? ` · ${getVendorCategoryLabel(activeCategory, tCat)}` : ''}
          {query ? ` · "${query}"` : ''}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 animate-pulse"
              style={{
                background: i % 2 === 0 ? 'var(--card-bg)' : 'transparent',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div className="w-9 h-9 rounded-full shrink-0" style={{ background: 'var(--card-bg-hover)' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 rounded w-40" style={{ background: 'var(--card-bg-hover)' }} />
                <div className="h-3 rounded w-24" style={{ background: 'var(--card-bg)' }} />
              </div>
              <div className="h-3 rounded w-20 hidden sm:block" style={{ background: 'var(--card-bg)' }} />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Search size={22} className="mx-auto mb-3" style={{ color: 'var(--color-muted)' }} />
          <p className="font-medium text-sm" style={{ color: 'var(--color-foreground)' }}>No vendors found</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
            {query ? `No results for "${query}"` : 'No vendors in this category yet.'}
          </p>
          {(query || activeCategory !== 'ALL') && (
            <button
              onClick={() => { setQuery(''); selectCategory('ALL') }}
              className="mt-3 text-xs hover:underline"
              style={{ color: '#a87b10' }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {/* Column header */}
          <div
            className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--color-border)' }}
          >
            {['Vendor', 'Category', 'Location', 'Starting price', ''].map((h) => (
              <span key={h} className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div>
            {displayed.map((v, idx) => (
              <a
                key={v.id}
                href={`/vendors/${v.slug}`}
                className="group flex items-center gap-3 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:gap-4 px-4 py-3.5 transition-colors"
                style={{
                  borderBottom: idx < displayed.length - 1 ? '1px solid var(--color-border)' : undefined,
                  background: 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={v.businessName} avatarUrl={v.avatarUrl} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-sm font-medium truncate transition-colors"
                        style={{ color: 'var(--color-foreground)' }}
                      >
                        {v.businessName}
                      </span>
                      {v.isVerified && (
                        <BadgeCheck size={13} className="text-gold-700 dark:text-gold-400 shrink-0" aria-label="Verified" />
                      )}
                    </div>
                    {/* Rating on mobile */}
                    {v.totalReviews > 0 && v.averageRating != null && (
                      <span className="flex items-center gap-1 text-xs md:hidden mt-0.5" style={{ color: 'var(--color-muted)' }}>
                        <Star size={10} className="text-gold-600 fill-gold-600 shrink-0" />
                        {v.averageRating.toFixed(1)}
                        <span>({v.totalReviews})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <span className="hidden md:block text-sm truncate" style={{ color: 'var(--color-muted)' }}>
                  {getVendorCategoryLabel(v.category, tCat)}
                </span>

                {/* Location */}
                <span className="hidden md:flex items-center gap-1.5 text-sm truncate" style={{ color: 'var(--color-muted)' }}>
                  {v.city ? (
                    <>
                      <MapPin size={12} className="shrink-0" style={{ color: 'var(--color-muted)' }} />
                      {v.city}
                    </>
                  ) : '—'}
                </span>

                {/* Price */}
                <span className="hidden md:block text-sm" style={{ color: 'var(--color-muted)' }}>
                  <PriceTag from={v.estimatedPriceFrom} to={v.estimatedPriceTo} currency={v.currency} />
                </span>

                {/* Arrow */}
                <ArrowRight
                  size={15}
                  className="ml-auto md:ml-0 shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: 'var(--color-muted)' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
