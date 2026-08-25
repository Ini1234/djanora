'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
  LayoutDashboard,
  House,
  CalendarDays,
  Search,
  MessageSquare,
  Settings,
  Sparkles,
  ArrowLeftRight,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from './notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { signOutToHome } from '@/lib/client-sign-out'
import { useModeSwitch } from './use-mode-switch'
import { useTranslations } from 'next-intl'

interface MobileNavProps {
  displayName: string
  initials: string
  avatarUrl: string | null
  activeMode?: string
  hasVendorProfile?: boolean
  role?: 'USER' | 'VENDOR' | 'ADMIN'
}

export function MobileNav({
  displayName,
  initials,
  avatarUrl,
  activeMode,
  hasVendorProfile,
  role,
}: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('nav')
  const { isVendorMode, pending: switching, switchMode } = useModeSwitch(activeMode ?? 'user')
  const canSwitch = role === 'VENDOR' || hasVendorProfile

  const HOST_NAV = [
    { href: '/', label: t.has('home') ? t('home') : 'Home', icon: House, exact: true },
    { href: '/events', label: t('myEvents'), icon: CalendarDays },
    { href: '/inspiration', label: t('inspiration'), icon: Sparkles },
    { href: '/likes', label: t.has('liked') ? t('liked') : 'Liked', icon: Heart },
    { href: '/vendors', label: t('findVendors'), icon: Search },
    { href: '/messages', label: t('messages'), icon: MessageSquare },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const VENDOR_NAV = [
    { href: '/vendor/dashboard', label: t('overview'), icon: LayoutDashboard, exact: true },
    { href: '/inquiries', label: t('inquiries'), icon: MessageSquare },
    { href: '/portfolio', label: t('portfolio'), icon: Search },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const nav = isVendorMode ? VENDOR_NAV : HOST_NAV

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Top bar */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-3.5 md:hidden"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
      >
        <Link href={isVendorMode ? '/vendor/dashboard' : '/'} className="flex items-center gap-2">
          <div className="bg-gold-600 flex h-7 w-7 items-center justify-center rounded-lg">
            <span className="text-brand-900 font-display text-xs font-bold">D</span>
          </div>
          <span className="font-display text-brand-900 font-semibold dark:text-white">Djanora</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle compact />
          <NotificationBell vendorMode={isVendorMode} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className="text-brand-500 dark:text-brand-300 hover:text-brand-800 rounded-lg p-1.5 transition-colors hover:bg-black/4 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden dark:bg-black/60"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r shadow-2xl md:hidden"
              style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-5"
                style={{ borderColor: 'var(--nav-border)' }}
              >
                <span className="font-display text-brand-900 text-lg font-semibold dark:text-white">
                  Djanora
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="text-brand-400 hover:text-brand-700 rounded-lg p-1.5 transition-colors hover:bg-black/4 dark:hover:bg-white/8 dark:hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 space-y-0.5 px-3 py-4">
                {nav.map((item) => {
                  const active = isActive(item.href, item.exact)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                        active
                          ? 'text-brand-900 dark:text-white'
                          : 'text-brand-500 dark:text-brand-300 hover:text-brand-800 hover:bg-black/4 dark:hover:bg-white/6 dark:hover:text-white',
                      )}
                      style={
                        active
                          ? {
                              background:
                                'color-mix(in srgb, var(--color-brand-primary) 18%, transparent)',
                              border: '1.5px solid var(--color-brand-primary)',
                            }
                          : undefined
                      }
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon
                        size={18}
                        className={cn(
                          'shrink-0',
                          active ? 'text-gold-800 dark:text-gold-400' : 'text-brand-400',
                        )}
                      />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              <div
                className="space-y-3 border-t px-3 pt-3 pb-6"
                style={{ borderColor: 'var(--nav-border)' }}
              >
                <div className="px-3">
                  <ThemeToggle />
                </div>
                {canSwitch && (
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => {
                      setOpen(false)
                      void switchMode()
                    }}
                    className="text-brand-500 dark:text-brand-300 hover:text-brand-800 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:bg-black/4 disabled:opacity-50 dark:hover:bg-white/6 dark:hover:text-white"
                  >
                    <ArrowLeftRight size={18} className="text-brand-400" aria-hidden="true" />
                    {switching
                      ? 'Switching…'
                      : t('switchTo', { mode: isVendorMode ? t('planning') : t('vendor') })}
                  </button>
                )}
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="bg-brand-200 dark:bg-brand-600 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-black/8 dark:ring-white/10">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-brand-700 text-sm font-semibold dark:text-white">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-brand-800 truncate text-sm font-medium dark:text-white">
                      {displayName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void signOutToHome()}
                  className="text-brand-500 dark:text-brand-300 hover:text-brand-800 w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all hover:bg-black/4 dark:hover:bg-white/6 dark:hover:text-white"
                >
                  {t('signOut')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
