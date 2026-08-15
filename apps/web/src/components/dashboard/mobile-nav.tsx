'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, X, LayoutDashboard, House, CalendarDays, Search, MessageSquare,
  Settings, Sparkles, ArrowLeftRight, Heart,
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
    { href: '/',             label: t.has('home') ? t('home') : 'Home', icon: House, exact: true },
    { href: '/events',       label: t('myEvents'),    icon: CalendarDays },
    { href: '/inspiration',  label: t('inspiration'),  icon: Sparkles },
    { href: '/likes',        label: t.has('liked') ? t('liked') : 'Liked', icon: Heart },
    { href: '/vendors',      label: t('findVendors'), icon: Search },
    { href: '/messages',     label: t('messages'),    icon: MessageSquare },
    { href: '/settings',     label: t('settings'),    icon: Settings },
  ]

  const VENDOR_NAV = [
    { href: '/vendor/dashboard', label: t('overview'),  icon: LayoutDashboard, exact: true },
    { href: '/inquiries',        label: t('inquiries'), icon: MessageSquare },
    { href: '/portfolio',        label: t('portfolio'), icon: Search },
    { href: '/settings',         label: t('settings'),  icon: Settings },
  ]

  const nav = isVendorMode ? VENDOR_NAV : HOST_NAV

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Top bar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3.5 shrink-0 border-b"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
      >
        <Link href={isVendorMode ? '/vendor/dashboard' : '/'} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gold-600 flex items-center justify-center">
            <span className="text-brand-900 font-display font-bold text-xs">D</span>
          </div>
          <span className="font-display font-semibold text-brand-900 dark:text-white">Djanora</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle compact />
          <NotificationBell vendorMode={isVendorMode} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className="text-brand-500 dark:text-brand-300 hover:text-brand-800 dark:hover:text-white p-1.5 rounded-lg hover:bg-black/4 dark:hover:bg-white/8 transition-colors"
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 dark:bg-black/60 z-40 md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden shadow-2xl border-r"
              style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
            >
              <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: 'var(--nav-border)' }}>
                <span className="font-display font-semibold text-lg text-brand-900 dark:text-white">Djanora</span>
                <button
                  type="button" onClick={() => setOpen(false)} aria-label="Close navigation"
                  className="text-brand-400 hover:text-brand-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-black/4 dark:hover:bg-white/8 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-0.5">
                {nav.map((item) => {
                  const active = isActive(item.href, item.exact)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                        active
                          ? 'text-brand-900 dark:text-white'
                          : 'text-brand-500 dark:text-brand-300 hover:text-brand-800 dark:hover:text-white hover:bg-black/4 dark:hover:bg-white/6',
                      )}
                      style={active ? {
                        background: 'color-mix(in srgb, var(--color-brand-primary) 18%, transparent)',
                        border: '1.5px solid var(--color-brand-primary)',
                      } : undefined}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon size={18} className={cn('shrink-0', active ? 'text-gold-800 dark:text-gold-400' : 'text-brand-400')} />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              <div className="px-3 pb-6 pt-3 border-t space-y-3" style={{ borderColor: 'var(--nav-border)' }}>
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
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-brand-500 dark:text-brand-300 hover:text-brand-800 dark:hover:text-white hover:bg-black/4 dark:hover:bg-white/6 transition-all disabled:opacity-50"
                  >
                    <ArrowLeftRight size={18} className="text-brand-400" aria-hidden="true" />
                    {switching
                      ? 'Switching…'
                      : t('switchTo', { mode: isVendorMode ? t('planning') : t('vendor') })}
                  </button>
                )}
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-brand-200 dark:bg-brand-600 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-black/8 dark:ring-white/10">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-brand-700 dark:text-white">{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-800 dark:text-white truncate">{displayName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void signOutToHome()}
                  className="w-full text-left px-3 py-2.5 text-sm text-brand-500 dark:text-brand-300 hover:text-brand-800 dark:hover:text-white rounded-xl hover:bg-black/4 dark:hover:bg-white/6 transition-all"
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
