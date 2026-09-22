'use client'

import { useEffect, useState } from 'react'
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
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from './notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { signOutToHome } from '@/lib/client-sign-out'
import { useModeSwitch } from './use-mode-switch'
import { useTranslations } from 'next-intl'
import { DjanNavIcon } from '@/components/assistant/djan-mark'

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
    { href: '/assistant', label: t.has('assistant') ? t('assistant') : 'Djan', icon: DjanNavIcon },
    { href: '/messages', label: t('messages'), icon: MessageSquare },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const VENDOR_NAV = [
    { href: '/vendor/dashboard', label: t('overview'), icon: LayoutDashboard, exact: true },
    { href: '/assistant', label: t.has('assistant') ? t('assistant') : 'Djan', icon: DjanNavIcon },
    { href: '/inquiries', label: t('inquiries'), icon: MessageSquare },
    { href: '/portfolio', label: t('portfolio'), icon: Search },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const nav = [
    ...(isVendorMode ? VENDOR_NAV : HOST_NAV),
    ...(role === 'ADMIN'
      ? [{ href: '/admin', label: t.has('admin') ? t('admin') : 'Admin', icon: Shield }]
      : []),
  ]

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Top bar */}
      <div
        className="bg-nav border-nav-border flex shrink-0 items-center justify-between border-b px-4 py-3.5 md:hidden"
        style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top, 0px))' }}
      >
        <Link href={isVendorMode ? '/vendor/dashboard' : '/'} className="flex items-center gap-2">
          <div className="bg-primary text-primary-fg flex h-7 w-7 items-center justify-center rounded-lg">
            <span className="font-display text-xs font-bold">D</span>
          </div>
          <span className="font-display text-nav-fg font-semibold">Djanora</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle compact />
          <NotificationBell vendorMode={isVendorMode} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="mobile-app-nav"
            className="tap-target text-nav-muted hover:bg-nav-hover hover:text-nav-fg inline-flex items-center justify-center rounded-lg p-1.5 transition-colors"
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
              className="bg-overlay fixed inset-0 z-40 md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              id="mobile-app-nav"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="bg-nav border-nav-border fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col border-r shadow-2xl md:hidden"
            >
              <div
                className="border-nav-border flex items-center justify-between border-b px-5 py-5"
                style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))' }}
              >
                <span className="font-display text-nav-fg text-lg font-semibold">Djanora</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="tap-target text-nav-muted hover:bg-nav-hover hover:text-nav-fg inline-flex items-center justify-center rounded-lg p-1.5 transition-colors"
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
                          ? 'bg-nav-active text-nav-fg border-primary border-[1.5px]'
                          : 'text-nav-muted hover:bg-nav-hover hover:text-nav-fg',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon
                        size={18}
                        className={cn('shrink-0', active ? 'text-nav-fg' : 'text-nav-muted')}
                      />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              <div
                className="border-nav-border space-y-3 border-t px-3 pt-3 pb-6"
                style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
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
                    className="text-nav-muted hover:bg-nav-hover hover:text-nav-fg flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
                  >
                    <ArrowLeftRight size={18} className="text-nav-muted" aria-hidden="true" />
                    {switching
                      ? 'Switching…'
                      : t('switchTo', { mode: isVendorMode ? t('planning') : t('vendor') })}
                  </button>
                )}
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="bg-hover ring-border flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-nav-fg text-sm font-semibold">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-nav-fg truncate text-sm font-medium">{displayName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void signOutToHome()}
                  className="text-nav-muted hover:bg-nav-hover hover:text-nav-fg w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all"
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
