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
            <AlertCircle size={15} className="text-gold-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-brand-800 text-sm font-medium dark:text-white">{item.label}</p>
              <p className="text-brand-500 mt-0.5 text-xs">{item.hint}</p>
            </div>
          </>
        )
        const className = 'flex items-start gap-3 py-2.5 px-3 rounded-xl bg-black/3 dark:bg-white/3'
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={`${className} transition-colors hover:bg-black/6 dark:hover:bg-white/6`}
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
  const score = profile ? completeness(profile) : 0

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Greeting + profile header ─────────────────────────────────── */}
      <motion.div {...fadeUp(0)}>
        <p className="text-brand-400 dark:text-brand-400 mb-1 text-sm font-medium">
          {getGreeting()}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-brand-900 text-3xl font-semibold sm:text-4xl dark:text-white">
              {firstName} 🎪
            </h1>
            {profile && (
              <p className="text-brand-500 dark:text-brand-400 mt-1 text-sm">
                {profile.businessName}
                {profile.isVerified && (
                  <span className="text-gold-600 dark:text-gold-400 ml-2 inline-flex items-center gap-1">
                    <BadgeCheck size={13} /> Verified
                  </span>
                )}
              </p>
            )}
          </div>
          {profile && (
            <Link
              href="/settings"
              className="text-brand-500 dark:text-brand-300 hover:text-brand-800 flex items-center gap-2 rounded-xl border border-black/8 bg-black/4 px-4 py-2 text-sm font-medium transition-all hover:border-black/14 dark:border-white/10 dark:bg-white/6 dark:hover:border-white/20 dark:hover:text-white"
            >
              <Edit3 size={14} />
              Edit profile
            </Link>
          )}
        </div>
      </motion.div>

      {/* ── Categories ────────────────────────────────────────────────── */}
      {profile && profile.categories.length > 0 && (
        <motion.div {...fadeUp(1)} className="flex flex-wrap gap-2">
          {profile.categories.map((cat) => (
            <span
              key={cat}
              className="bg-gold-500/12 dark:bg-gold-500/15 border-gold-500/25 text-gold-700 dark:text-gold-400 rounded-full border px-3 py-1.5 text-xs font-medium"
            >
              {getVendorCategoryLabel(cat, tCat)}
            </span>
          ))}
          {profile.city && (
            <span className="text-brand-600 dark:text-brand-300 rounded-full border border-black/8 bg-black/5 px-3 py-1.5 text-xs font-medium dark:border-white/12 dark:bg-white/8">
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
            color: 'text-blue-500 dark:text-blue-400',
            bg: 'bg-blue-500/10',
          },
          {
            icon: Star,
            label: 'Rating',
            value: profile?.averageRating ? profile.averageRating.toFixed(1) : '—',
            sub: profile?.totalReviews ? `${profile.totalReviews} reviews` : 'No reviews yet',
            color: 'text-gold-600 dark:text-gold-400',
            bg: 'bg-gold-500/10',
          },
          {
            icon: ImageIcon,
            label: 'Portfolio',
            value: profile ? String(profile.portfolioCount) : '0',
            sub: profile?.portfolioCount === 0 ? 'Add looks' : 'Looks published',
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-500/10',
          },
          {
            icon: TrendingUp,
            label: 'Profile views',
            value: profile ? String(profile.profileViews ?? 0) : '0',
            sub: 'Public listing visits',
            color: 'text-violet-500 dark:text-violet-400',
            bg: 'bg-violet-500/10',
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
            color: 'text-brand-400',
            bg: 'bg-brand-500/10 dark:bg-white/6',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-start gap-4 rounded-2xl border border-black/8 bg-white/60 px-5 py-5 dark:border-white/8 dark:bg-white/5"
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
              <p className="text-brand-900 font-display text-xl font-semibold dark:text-white">
                {stat.value}
              </p>
              <p className="text-brand-600 dark:text-brand-200 text-sm font-medium">{stat.label}</p>
              <p className="text-brand-400 dark:text-brand-500 mt-0.5 text-xs">{stat.sub}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Two-column lower section ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile completeness card */}
        <motion.div
          {...fadeUp(3)}
          className="rounded-2xl border border-black/8 bg-white/60 p-6 lg:col-span-2 dark:border-white/8 dark:bg-white/4"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-brand-900 text-base font-semibold dark:text-white">
                Profile completeness
              </h2>
              <p className="text-brand-500 dark:text-brand-400 mt-0.5 text-xs">
                A complete profile gets significantly more bookings
              </p>
            </div>
            <span
              className={cn(
                'font-display text-sm font-bold',
                score === 100
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : score >= 60
                    ? 'text-gold-600 dark:text-gold-400'
                    : 'text-brand-500',
              )}
            >
              {score}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-6 h-2 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.4 }}
              className={cn(
                'h-full rounded-full',
                score === 100 ? 'bg-emerald-500' : score >= 60 ? 'bg-gold-500' : 'bg-brand-400',
              )}
            />
          </div>

          {profile ? (
            score === 100 ? (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <BadgeCheck size={16} /> Profile is fully complete — great work!
              </div>
            ) : (
              <CompletenessChecklist p={profile} />
            )
          ) : (
            <p className="text-brand-400 text-sm">Profile data unavailable.</p>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          {...fadeUp(4)}
          className="rounded-2xl border border-black/8 bg-white/60 p-6 dark:border-white/8 dark:bg-white/4"
        >
          <h2 className="font-display text-brand-900 mb-4 text-base font-semibold dark:text-white">
            Quick actions
          </h2>
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
                className="group flex items-center gap-3 rounded-xl border border-transparent bg-black/3 px-3 py-3 transition-all hover:border-black/8 hover:bg-black/6 dark:bg-white/3 dark:hover:border-white/10 dark:hover:bg-white/6"
              >
                <div className="bg-gold-500/12 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <action.icon size={14} className="text-gold-600 dark:text-gold-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-brand-800 truncate text-sm font-medium dark:text-white">
                    {action.label}
                  </p>
                  <p className="text-brand-400 dark:text-brand-500 text-xs">{action.sub}</p>
                </div>
                <ChevronRight
                  size={14}
                  className="text-brand-400 group-hover:text-brand-600 dark:group-hover:text-brand-200 shrink-0 transition-colors"
                />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Bio + links preview (if set) ───────────────────────────────── */}
      {profile &&
        (profile.bio || profile.websiteUrl || profile.instagramUrl || profile.facebookUrl) && (
          <motion.div
            {...fadeUp(5)}
            className="rounded-2xl border border-black/8 bg-white/60 p-6 dark:border-white/8 dark:bg-white/4"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-brand-900 text-base font-semibold dark:text-white">
                Your profile preview
              </h2>
              <span className="text-brand-400 text-xs">What planners see</span>
            </div>

            {profile.bio && (
              <p className="text-brand-700 dark:text-brand-300 mb-4 line-clamp-3 text-sm leading-relaxed">
                {profile.bio}
              </p>
            )}

            {(profile.estimatedPriceFrom || profile.estimatedPriceTo) && (
              <p className="text-brand-800 dark:text-brand-200 mb-4 text-sm font-medium">
                <span className="text-brand-400 dark:text-brand-500 mr-1">Starting from</span>
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
                    className="bg-brand-100 text-brand-600 dark:text-brand-300 border-brand-200 rounded-full border px-2.5 py-1 text-xs dark:border-white/10 dark:bg-white/8"
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
                  className="text-brand-500 dark:text-brand-400 hover:text-brand-800 flex items-center gap-1.5 text-xs transition-colors dark:hover:text-white"
                >
                  <Globe size={13} /> Website
                </a>
              )}
              {profile.instagramUrl && (
                <a
                  href={profile.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-500 dark:text-brand-400 hover:text-brand-800 flex items-center gap-1.5 text-xs transition-colors dark:hover:text-white"
                >
                  <Link2 size={13} /> Instagram
                </a>
              )}
              {profile.facebookUrl && (
                <a
                  href={profile.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-500 dark:text-brand-400 hover:text-brand-800 flex items-center gap-1.5 text-xs transition-colors dark:hover:text-white"
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
