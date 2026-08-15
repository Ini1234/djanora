'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, House, CalendarDays, Search, MessageSquare,
  Settings, ArrowLeftRight, LogOut, Sparkles, Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from './notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useTranslations } from 'next-intl'
import { useSse } from '@/contexts/sse-context'
import { useEffect } from 'react'
import { signOutToHome } from '@/lib/client-sign-out'
import { useModeSwitch } from './use-mode-switch'

interface SidebarProps {
  displayName: string
  initials: string
  avatarUrl: string | null
  role: 'USER' | 'VENDOR' | 'ADMIN'
  hasVendorProfile: boolean
  activeMode: string
}

export function Sidebar({ displayName, initials, avatarUrl, role, hasVendorProfile, activeMode }: SidebarProps) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const { unreadCount, clearUnread } = useSse()
  const { isVendorMode, pending: switching, switchMode } = useModeSwitch(activeMode)

  // Clear unread badge when user navigates to messages or inquiries
  useEffect(() => {
    if (pathname === '/messages' || pathname === '/inquiries') {
      clearUnread()
    }
  }, [pathname, clearUnread])

  const HOST_NAV = [
    { href: '/',             label: t.has('home') ? t('home') : 'Home', icon: House, exact: true },
    { href: '/events',       label: t('myEvents'),    icon: CalendarDays },
    { href: '/inspiration',  label: t('inspiration'),  icon: Sparkles },
    { href: '/likes',        label: t.has('liked') ? t('liked') : 'Liked', icon: Heart },
    { href: '/vendors',      label: t('findVendors'), icon: Search },
    { href: '/messages',     label: t('messages'),    icon: MessageSquare, badge: unreadCount },
    { href: '/settings',     label: t('settings'),    icon: Settings },
  ]

  const VENDOR_NAV = [
    { href: '/vendor/dashboard', label: t('overview'),  icon: LayoutDashboard, exact: true },
    { href: '/inquiries',        label: t('inquiries'), icon: MessageSquare, badge: unreadCount },
    { href: '/portfolio',        label: t('portfolio'), icon: Search },
    { href: '/settings',         label: t('settings'),  icon: Settings },
  ]

  const nav = isVendorMode ? VENDOR_NAV : HOST_NAV

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside
      className="hidden md:flex md:flex-col w-64 shrink-0 h-full border-r"
      style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-5 py-5 border-b"
        style={{ borderColor: 'var(--nav-border)' }}
      >
        <Link href={isVendorMode ? '/vendor/dashboard' : '/'} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gold-600 flex items-center justify-center shadow-lg shadow-gold-900/30">
            <span className="text-brand-900 font-display font-bold text-sm">D</span>
          </div>
          <span className="font-display font-semibold text-lg tracking-tight text-brand-900 dark:text-white">
            Djanora
          </span>
        </Link>

        {(role === 'VENDOR' || hasVendorProfile) && (
          <div className="mt-3">
            <span className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
              isVendorMode
                ? 'bg-gold-600/15 text-gold-600 dark:text-gold-400 border-gold-600/25'
                : 'bg-brand-100 dark:bg-brand-700/50 text-brand-500 dark:text-brand-300 border-brand-200 dark:border-white/10',
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', isVendorMode ? 'bg-gold-500' : 'bg-brand-400')} />
              {isVendorMode ? t('vendorMode') : t('planningMode')}
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {nav.map((item) => {
          const active = isActive(item.href, item.exact)
          const badge = (item as { badge?: number }).badge
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                active
                  ? 'text-brand-900 dark:text-white'
                  : 'text-brand-500 dark:text-brand-300 hover:text-brand-800 dark:hover:text-white hover:bg-black/4 dark:hover:bg-white/6',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'color-mix(in srgb, var(--color-brand-primary) 18%, transparent)',
                    border: '1.5px solid var(--color-brand-primary)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <item.icon
                size={18}
                className={cn(
                  'shrink-0 relative z-10 transition-colors',
                  active
                    ? 'text-gold-800 dark:text-gold-400'
                    : 'text-brand-400 group-hover:text-brand-600 dark:group-hover:text-brand-200',
                )}
                aria-hidden="true"
              />
              <span className="relative z-10 flex-1">{item.label}</span>
              {badge != null && badge > 0 && (
                <span
                  className="relative z-10 ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                  style={{ background: '#c9973a', color: '#fff' }}
                  aria-label={`${badge} unread`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 pb-4 pt-3 border-t flex flex-col gap-1"
        style={{ borderColor: 'var(--nav-border)' }}
      >
        {/* Language + Theme */}
        <div className="flex flex-col gap-1 items-start px-2 py-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* Switch mode — vendors only */}
        {(role === 'VENDOR' || hasVendorProfile) && (
          <button
            type="button"
            disabled={switching}
            onClick={() => void switchMode()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-brand-500 dark:text-brand-300 hover:text-brand-800 dark:hover:text-white hover:bg-black/4 dark:hover:bg-white/6 transition-all disabled:opacity-50"
          >
            <ArrowLeftRight size={18} className="text-brand-400" aria-hidden="true" />
            {switching
              ? 'Switching…'
              : t('switchTo', { mode: isVendorMode ? t('planning') : t('vendor') })}
          </button>
        )}

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-brand-200 dark:bg-brand-600 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-black/8 dark:ring-white/10">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-brand-700 dark:text-white">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-800 dark:text-white truncate">{displayName}</p>
          </div>
          <NotificationBell vendorMode={isVendorMode} />
          <button
            type="button"
            onClick={() => void signOutToHome()}
            className="text-brand-400 hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-200 transition-colors p-1 rounded"
            aria-label={t('signOut')}
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
