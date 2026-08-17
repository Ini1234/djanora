'use client'

import { useState, useMemo } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Search, BadgeCheck, Star, MapPin, ArrowRight, SlidersHorizontal, X } from 'lucide-react'
import { VENDOR_CATEGORY_KEYS, getVendorCategoryLabel } from '@/lib/vendor-categories'
import { proxyClient } from '@/lib/proxy-client'
import { replaceShallowQuery } from '@/lib/shallow-query'
import { queryKeys } from '@/lib/query-keys'

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
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/8 dark:ring-white/10"
      style={{ background: 'var(--card-bg)' }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-bold" style={{ color: 'var(--color-foreground)' }}>
          {initials}
        </span>
      )}
    </div>
  )
}

function PriceTag({
  from,
  to,
  currency,
}: {
  from: number | null
  to: number | null
  currency: string | null
}) {
  if (!from && !to) return <span style={{ color: 'var(--color-muted)' }}>—</span>
  const sym = currency === 'CAD' ? 'CA$' : currency === 'USD' ? 'US$' : (currency ?? '$')
  if (from && to)
    return (
      <span>
        {sym}
        {from.toLocaleString()} – {sym}
        {to.toLocaleString()}
      </span>
    )
  if (from)
    return (
      <span>
        From {sym}
        {from.toLocaleString()}
      </span>
    )
  return (
    <span>
      Up to {sym}
      {to!.toLocaleString()}
    </span>
  )
}

export default function VendorsPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tCat = useTranslations('vendorCategories')

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(
    searchParams.get('category') ?? 'ALL',
  )
  const [showFilters, setShowFilters] = useState(false)

  const { data: vendors = [], isPending: loading } = useQuery({
    queryKey: queryKeys.vendors(activeCategory),
    queryFn: async () => {
      const params = activeCategory !== 'ALL' ? `?category=${activeCategory}` : ''
      const { data } = await proxyClient.get<VendorListing[]>(`/vendors${params}`)
      return Array.isArray(data) ? data : []
    },
  })

  function selectCategory(cat: string) {
    setActiveCategory(cat)
    replaceShallowQuery(pathname, { category: cat })
  }

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vendors
    return vendors.filter(
      (v) =>
        v.businessName.toLowerCase().includes(q) || (v.city?.toLowerCase().includes(q) ?? false),
    )
  }, [vendors, query])

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1
          className="font-display text-2xl font-semibold"
          style={{ color: 'var(--color-foreground)' }}
        >
          Find Vendors
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-muted)' }}>
          Browse vetted service providers for your event
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{ color: 'var(--color-muted)' }}
          />
          <input
            type="search"
            placeholder="Search name or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="focus:ring-gold-500/40 w-full rounded-xl border py-2 pr-8 pl-8 text-sm transition focus:ring-2 focus:outline-none"
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-all"
          style={{
            background: showFilters ? 'rgba(201,151,58,0.12)' : 'var(--card-bg)',
            borderColor: showFilters ? 'rgba(201,151,58,0.35)' : 'var(--color-border)',
            color: showFilters ? 'var(--color-gold-700, #a87b10)' : 'var(--color-foreground)',
          }}
        >
          <SlidersHorizontal size={14} />
          Filter
          {activeCategory !== 'ALL' && (
            <span className="bg-gold-500 h-1.5 w-1.5 shrink-0 rounded-full" />
          )}
        </button>
      </div>

      {/* Category filter — collapsible */}
      {showFilters && (
        <div
          className="flex flex-wrap gap-1.5 rounded-xl border px-4 py-3"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--color-border)' }}
        >
          {['ALL', ...VENDOR_CATEGORY_KEYS].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectCategory(key)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
              style={
                activeCategory === key
                  ? {
                      background: '#c9973a',
                      borderColor: '#c9973a',
                      color: '#ffffff',
                    }
                  : {
                      background: 'transparent',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-foreground)',
                    }
              }
            >
              {key === 'ALL' ? 'All categories' : getVendorCategoryLabel(key, tCat)}
            </button>
          ))}
        </div>
      )}

      {/* Active filter pill */}
      {activeCategory !== 'ALL' && !showFilters && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Filtered by:
          </span>
          <button
            onClick={() => selectCategory('ALL')}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
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
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-4 px-4 py-3"
              style={{
                background: i % 2 === 0 ? 'var(--card-bg)' : 'transparent',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div
                className="h-9 w-9 shrink-0 rounded-full"
                style={{ background: 'var(--card-bg-hover)' }}
              />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 w-40 rounded"
                  style={{ background: 'var(--card-bg-hover)' }}
                />
                <div className="h-3 w-24 rounded" style={{ background: 'var(--card-bg)' }} />
              </div>
              <div
                className="hidden h-3 w-20 rounded sm:block"
                style={{ background: 'var(--card-bg)' }}
              />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div
          className="rounded-xl border border-dashed py-20 text-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Search size={22} className="mx-auto mb-3" style={{ color: 'var(--color-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            No vendors found
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
            {query ? `No results for "${query}"` : 'No vendors in this category yet.'}
          </p>
          {(query || activeCategory !== 'ALL') && (
            <button
              onClick={() => {
                setQuery('')
                selectCategory('ALL')
              }}
              className="mt-3 text-xs hover:underline"
              style={{ color: '#a87b10' }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {/* Column header */}
          <div
            className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b px-4 py-2.5 md:grid"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--color-border)' }}
          >
            {['Vendor', 'Category', 'Location', 'Starting price', ''].map((h) => (
              <span
                key={h}
                className="text-[11px] font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-muted)' }}
              >
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
                className="group flex items-center gap-3 px-4 py-3.5 transition-colors md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:gap-4"
                style={{
                  borderBottom:
                    idx < displayed.length - 1 ? '1px solid var(--color-border)' : undefined,
                  background: 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Name + avatar */}
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={v.businessName} avatarUrl={v.avatarUrl} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="truncate text-sm font-medium transition-colors"
                        style={{ color: 'var(--color-foreground)' }}
                      >
                        {v.businessName}
                      </span>
                      {v.isVerified && (
                        <BadgeCheck
                          size={13}
                          className="text-gold-700 dark:text-gold-400 shrink-0"
                          aria-label="Verified"
                        />
                      )}
                    </div>
                    {/* Rating on mobile */}
                    {v.totalReviews > 0 && v.averageRating != null && (
                      <span
                        className="mt-0.5 flex items-center gap-1 text-xs md:hidden"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        <Star size={10} className="text-gold-600 fill-gold-600 shrink-0" />
                        {v.averageRating.toFixed(1)}
                        <span>({v.totalReviews})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <span
                  className="hidden truncate text-sm md:block"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {getVendorCategoryLabel(v.category, tCat)}
                </span>

                {/* Location */}
                <span
                  className="hidden items-center gap-1.5 truncate text-sm md:flex"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {v.city ? (
                    <>
                      <MapPin
                        size={12}
                        className="shrink-0"
                        style={{ color: 'var(--color-muted)' }}
                      />
                      {v.city}
                    </>
                  ) : (
                    '—'
                  )}
                </span>

                {/* Price */}
                <span className="hidden text-sm md:block" style={{ color: 'var(--color-muted)' }}>
                  <PriceTag
                    from={v.estimatedPriceFrom}
                    to={v.estimatedPriceTo}
                    currency={v.currency}
                  />
                </span>

                {/* Arrow */}
                <ArrowRight
                  size={15}
                  className="ml-auto shrink-0 transition-transform group-hover:translate-x-0.5 md:ml-0"
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
