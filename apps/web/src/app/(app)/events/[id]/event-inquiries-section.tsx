'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageSquare, Clock, CheckCircle, XCircle, CalendarCheck,
  ArrowRight, ExternalLink,
} from 'lucide-react'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'

interface Inquiry {
  id: string
  status: string
  message: string
  createdAt: string
  vendorProfile: {
    id: string
    businessName: string
    slug: string
    category: string
  } | null
  messages: { message: string; createdAt: string }[]
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  PENDING:  { label: 'Pending',  icon: Clock,         color: 'var(--color-warning)',  bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)'  },
  VIEWED:   { label: 'Viewed',   icon: Clock,         color: 'var(--color-muted)',    bg: 'color-mix(in srgb, var(--color-muted) 10%, transparent)'    },
  QUOTED:    { label: 'Quoted',    icon: MessageSquare, color: 'var(--color-info)',     bg: 'color-mix(in srgb, var(--color-info) 12%, transparent)'     },
  ACCEPTED:  { label: 'Accepted',  icon: CheckCircle,   color: 'var(--color-success)',  bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)'  },
  BOOKED:    { label: 'Booked',    icon: CalendarCheck, color: '#0f766e',               bg: 'rgba(15,118,110,0.12)' },
  DECLINED:  { label: 'Declined',  icon: XCircle,       color: 'var(--color-error)',    bg: 'color-mix(in srgb, var(--color-error) 12%, transparent)'    },
  CANCELLED: { label: 'Cancelled', icon: XCircle,       color: 'var(--color-error)',    bg: 'color-mix(in srgb, var(--color-error) 12%, transparent)'    },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

export function EventInquiriesSection({ eventId }: { eventId: string }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const tCat = useTranslations('vendorCategories')

  useEffect(() => {
    proxyClient.get(`/inquiries/event/${eventId}`)
      .then(({ data }) => setInquiries(Array.isArray(data) ? data : []))
      .catch(() => setInquiries([]))
      .finally(() => setLoading(false))
  }, [eventId])

  return (
    <div>
      {/* Body */}
      <div>
        {loading ? (
          <div className="flex justify-center py-8">
            <span
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : inquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)' }}
            >
              <MessageSquare size={18} style={{ color: 'var(--color-brand-primary)', opacity: 0.6 }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                No vendor inquiries yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Browse vendors and send inquiries for this event
              </p>
            </div>
            <Link
              href="/vendors"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
                color: 'var(--color-brand-primary)',
              }}
            >
              Browse vendors <ArrowRight size={11} />
            </Link>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {inquiries.map((inq) => {
              const lastMsg = inq.messages[0]
              const preview = lastMsg?.message ?? inq.message
              const time = new Date(lastMsg?.createdAt ?? inq.createdAt).toLocaleString('en-CA', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })

              return (
                <li key={inq.id}>
                  <Link
                    href={`/messages?inquiry=${inq.id}`}
                    className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-black/4 dark:hover:bg-white/4 group"
                  >
                    {/* Vendor avatar / initials */}
                    <div
                      className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-[12px] font-bold mt-0.5"
                      style={{
                        background: 'color-mix(in srgb, var(--color-brand-primary) 15%, transparent)',
                        color: 'var(--color-brand-primary)',
                      }}
                    >
                      {inq.vendorProfile?.businessName?.charAt(0).toUpperCase() ?? '?'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {inq.vendorProfile?.businessName ?? 'Unknown vendor'}
                        </span>
                        <span className="text-[11px] shrink-0" style={{ color: 'var(--color-muted)' }}>
                          {time}
                        </span>
                      </div>

                      {inq.vendorProfile && (
                        <p className="text-[11px] mb-1" style={{ color: 'var(--color-muted)' }}>
                          {getVendorCategoryLabel(inq.vendorProfile.category, tCat)}
                        </p>
                      )}

                      <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {preview}
                      </p>
                    </div>

                    {/* Status + arrow */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={inq.status} />
                      <ArrowRight
                        size={12}
                        className="opacity-0 group-hover:opacity-50 transition-opacity"
                        style={{ color: 'var(--color-muted)' }}
                      />
                    </div>
                  </Link>

                  {/* Vendor profile link */}
                  {inq.vendorProfile && (
                    <div className="px-5 pb-2.5 -mt-1">
                      <Link
                        href={`/vendors/${inq.vendorProfile.slug}`}
                        className="inline-flex items-center gap-1 text-[11px] transition-colors"
                        style={{ color: 'var(--color-muted)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={10} />
                        View profile
                      </Link>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
