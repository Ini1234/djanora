'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  BadgeCheck,
  Star,
  MessageSquare,
  ImageIcon,
  Globe,
  Edit3,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Users,
  AlertCircle,
  ExternalLink,
  Link2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { contactHref } from '@/lib/contact'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import type { MyVendorProfile } from '@/lib/api.types'

interface Props {
  firstName: string
  avatarUrl: string | null
  profile: MyVendorProfile | null
}

const EASE = [0.25, 0.46, 0.45, 0.94] as const

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.38, ease: EASE } },
  }
}

const TRIBE_LABELS: Record<string, string> = {
  YORUBA: 'Yoruba',
  IGBO: 'Igbo',
  HAUSA: 'Hausa/Fulani',
  OTHER: 'Other',
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Returns 0–100 score based on how complete the profile is. */
function completeness(p: MyVendorProfile) {
  const checks = [
    !!p.bio,
    !!p.city,
    !!p.estimatedPriceFrom,
    !!p.websiteUrl || !!p.instagramUrl || !!p.facebookUrl,
    p.portfolioCount > 0,
    p.tribesServed.length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function CompletenessChecklist({ p }: { p: MyVendorProfile }) {
  const items: { done: boolean; label: string; hint: string; href?: string }[] = [
    { done: !!p.bio, label: 'Add a bio', hint: 'Tell planners what makes you special' },
    { done: !!p.city, label: 'Set your city / region', hint: 'Helps planners find local vendors' },
    {
      done: !!p.estimatedPriceFrom,
      label: 'Add a price range',
      hint: 'Planners plan better with a budget guide',
    },
    {
      done: !!(p.websiteUrl || p.instagramUrl || p.facebookUrl),
      label: 'Add a social / website link',
      hint: 'Builds trust and drives bookings',
    },
    {
      done: p.portfolioCount > 0,
      label: 'Add portfolio looks',
      hint: 'Looks with photos get more inquiries',
      href: '/portfolio',
    },
    {
      done: p.tribesServed.length > 0,
      label: 'Set communities served',
      hint: 'Matches you to the right planners',
    },
  ]
  const remaining = items.filter((i) => !i.done)
  if (remaining.length === 0) return null
  return (
    <div className="space-y-2">
      {remaining.map((item) => {
        const inner = (
          <>
            <AlertCircle size={15} className="text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-fg text-sm font-medium">{item.label}</p>
              <p className="text-muted mt-0.5 text-xs">{item.hint}</p>
            </div>
          </>
        )
        const className = 'flex items-start gap-3 py-2.5 px-3 rounded-xl bg-hover'
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={`${className} hover:bg-hover transition-colors`}
          >
            {inner}
          </Link>
        ) : (
          <div key={item.label} className={className}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

export function VendorDashboardHome({ firstName, profile }: Props) {
  const tCat = useTranslations('vendorCategories')
  const tContact = useTranslations('contact')
  const score = profile ? completeness(profile) : 0

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Greeting + profile header ─────────────────────────────────── */}
      <motion.div {...fadeUp(0)}>
        <p className="text-muted mb-1 text-sm font-medium">{getGreeting()}</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-fg text-3xl font-semibold sm:text-4xl">
              {firstName} 🎪
            </h1>
            {profile && (
              <p className="text-muted mt-1 text-sm">
                {profile.businessName}
                {profile.reviewStatus === 'APPROVED' && (
                  <span className="text-primary ml-2 inline-flex items-center gap-1">
                    <BadgeCheck size={13} /> Verified
                  </span>
                )}
              </p>
            )}
          </div>
          {profile && (
            <Link
              href="/settings"
              className="text-muted hover:text-fg border-border bg-hover hover:bg-hover flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all"
            >
              <Edit3 size={14} />
              Edit profile
            </Link>
          )}
        </div>
      </motion.div>

      {profile && profile.reviewStatus && profile.reviewStatus !== 'APPROVED' && (
        <motion.div
          {...fadeUp(0)}
          className="border-border bg-primary/10 rounded-2xl border px-4 py-3 text-sm"
        >
          <p className="text-fg font-medium">
            {profile.reviewStatus === 'PENDING' &&
              'Djanora is reviewing your profile. Hosts cannot find you yet.'}
            {profile.reviewStatus === 'REJECTED' &&
              'Your listing was not approved. Update your profile and wait for another review.'}
            {profile.reviewStatus === 'SUSPENDED' &&
              'Your listing is hidden from hosts while we review it.'}
          </p>
          {profile.reviewNote && <p className="text-muted mt-1 text-xs">{profile.reviewNote}</p>}
          <Link
            href={contactHref('vendor_review')}
            className="text-muted mt-2 inline-block text-xs font-medium underline-offset-2 hover:underline"
          >
            {tContact('reviewLink')}
          </Link>
        </motion.div>
      )}

      {/* ── Categories ────────────────────────────────────────────────── */}
      {profile && profile.categories.length > 0 && (
        <motion.div {...fadeUp(1)} className="flex flex-wrap gap-2">
          {profile.categories.map((cat) => (
            <span
              key={cat}
              className="bg-primary/15 text-primary border-primary/25 rounded-full border px-3 py-1.5 text-xs font-medium"
            >
              {getVendorCategoryLabel(cat, tCat)}
            </span>
          ))}
          {profile.city && (
            <span className="text-muted border-border bg-hover rounded-full border px-3 py-1.5 text-xs font-medium">
              📍 {profile.city}
            </span>
          )}
        </motion.div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(2)} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            icon: MessageSquare,
            label: 'Bookings',
            value: profile ? String(profile.bookingCount) : '0',
            sub:
              profile?.bookingCount === 0
                ? 'None yet'
                : profile?.bookingCount === 1
                  ? '1 event booked'
                  : `${profile?.bookingCount} events booked`,
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            icon: Star,
            label: 'Rating',
            value: profile?.averageRating ? profile.averageRating.toFixed(1) : '—',
            sub: profile?.totalReviews ? `${profile.totalReviews} reviews` : 'No reviews yet',
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            icon: ImageIcon,
            label: 'Portfolio',
            value: profile ? String(profile.portfolioCount) : '0',
            sub: profile?.portfolioCount === 0 ? 'Add looks' : 'Looks published',
            color: 'text-success',
            bg: 'bg-success/10',
          },
          {
            icon: TrendingUp,
            label: 'Profile views',
            value: profile ? String(profile.profileViews ?? 0) : '0',
            sub: 'Public listing visits',
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            icon: MessageSquare,
            label: 'Inquiries',
            value: profile ? String(profile.inquiryCount) : '0',
            sub:
              profile?.inquiryCount === 0
                ? 'None yet'
                : profile?.inquiryCount === 1
                  ? '1 message received'
                  : `${profile?.inquiryCount} messages received`,
            color: 'text-muted',
            bg: 'bg-hover',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-border bg-surface flex items-start gap-4 rounded-2xl border px-5 py-5"
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                stat.bg,
              )}
            >
              <stat.icon size={16} className={stat.color} aria-hidden="true" />
            </div>
            <div>
              <p className="text-fg font-display text-xl font-semibold">{stat.value}</p>
              <p className="text-muted text-sm font-medium">{stat.label}</p>
              <p className="text-muted mt-0.5 text-xs">{stat.sub}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Two-column lower section ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile completeness card */}
        <motion.div
          {...fadeUp(3)}
          className="border-border bg-surface rounded-2xl border p-6 lg:col-span-2"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-fg text-base font-semibold">Profile completeness</h2>
              <p className="text-muted mt-0.5 text-xs">
                A complete profile gets significantly more bookings
              </p>
            </div>
            <span
              className={cn(
                'font-display text-sm font-bold',
                score === 100 ? 'text-success' : score >= 60 ? 'text-primary' : 'text-muted',
              )}
            >
              {score}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="bg-hover mb-6 h-2 overflow-hidden rounded-full">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.4 }}
              className={cn(
                'h-full rounded-full',
                score === 100 ? 'bg-success' : score >= 60 ? 'bg-primary' : 'bg-hover',
              )}
            />
          </div>

          {profile ? (
            score === 100 ? (
              <div className="text-success flex items-center gap-2 text-sm font-medium">
                <BadgeCheck size={16} /> Profile is fully complete — great work!
              </div>
            ) : (
              <CompletenessChecklist p={profile} />
            )
          ) : (
            <p className="text-muted text-sm">Profile data unavailable.</p>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div {...fadeUp(4)} className="border-border bg-surface rounded-2xl border p-6">
          <h2 className="font-display text-fg mb-4 text-base font-semibold">Quick actions</h2>
          <div className="space-y-2">
            {[
              { icon: Edit3, label: 'Edit profile', href: '/settings', sub: 'Update your details' },
              {
                icon: ImageIcon,
                label: 'Add portfolio looks',
                href: '/portfolio',
                sub: 'Showcase your work',
              },
              {
                icon: Users,
                label: 'View inquiries',
                href: '/inquiries',
                sub: 'Messages from planners',
              },
              ...(profile
                ? [
                    {
                      icon: ExternalLink,
                      label: 'View public profile',
                      href: `/vendors/${profile.slug}`,
                      sub: 'See what planners see',
                    },
                  ]
                : []),
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group bg-hover hover:bg-hover hover:border-border flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-all"
              >
                <div className="bg-primary/15 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <action.icon size={14} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm font-medium">{action.label}</p>
                  <p className="text-muted text-xs">{action.sub}</p>
                </div>
                <ChevronRight
                  size={14}
                  className="text-muted group-hover:text-fg shrink-0 transition-colors"
                />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Bio + links preview (if set) ───────────────────────────────── */}
      {profile &&
        (profile.bio || profile.websiteUrl || profile.instagramUrl || profile.facebookUrl) && (
          <motion.div {...fadeUp(5)} className="border-border bg-surface rounded-2xl border p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-fg text-base font-semibold">Your profile preview</h2>
              <span className="text-muted text-xs">What planners see</span>
            </div>

            {profile.bio && (
              <p className="text-muted mb-4 line-clamp-3 text-sm leading-relaxed">{profile.bio}</p>
            )}

            {(profile.estimatedPriceFrom || profile.estimatedPriceTo) && (
              <p className="text-fg mb-4 text-sm font-medium">
                <span className="text-muted mr-1">Starting from</span>
                CA${(profile.estimatedPriceFrom ?? 0).toLocaleString('en-CA')}
                {profile.estimatedPriceTo
                  ? ` – $${profile.estimatedPriceTo.toLocaleString('en-CA')}`
                  : '+'}
              </p>
            )}

            {profile.tribesServed.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {profile.tribesServed.map((t) => (
                  <span
                    key={t}
                    className="bg-hover text-muted border-border rounded-full border px-2.5 py-1 text-xs"
                  >
                    {TRIBE_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-fg flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Globe size={13} /> Website
                </a>
              )}
              {profile.instagramUrl && (
                <a
                  href={profile.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-fg flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Link2 size={13} /> Instagram
                </a>
              )}
              {profile.facebookUrl && (
                <a
                  href={profile.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-fg flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Sparkles size={13} /> Facebook
                </a>
              )}
            </div>
          </motion.div>
        )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
