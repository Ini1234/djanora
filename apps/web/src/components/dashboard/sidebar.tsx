'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  House,
  CalendarDays,
  Search,
  MessageSquare,
  Settings,
  ArrowLeftRight,
  LogOut,
  Sparkles,
  Heart,
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

export function Sidebar({
  displayName,
  initials,
  avatarUrl,
  role,
  hasVendorProfile,
  activeMode,
}: SidebarProps) {
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
    { href: '/', label: t.has('home') ? t('home') : 'Home', icon: House, exact: true },
    { href: '/events', label: t('myEvents'), icon: CalendarDays },
    { href: '/inspiration', label: t('inspiration'), icon: Sparkles },
    { href: '/likes', label: t.has('liked') ? t('liked') : 'Liked', icon: Heart },
    { href: '/vendors', label: t('findVendors'), icon: Search },
    { href: '/messages', label: t('messages'), icon: MessageSquare, badge: unreadCount },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const VENDOR_NAV = [
    { href: '/vendor/dashboard', label: t('overview'), icon: LayoutDashboard, exact: true },
    { href: '/inquiries', label: t('inquiries'), icon: MessageSquare, badge: unreadCount },
    { href: '/portfolio', label: t('portfolio'), icon: Search },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const nav = isVendorMode ? VENDOR_NAV : HOST_NAV

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside
      className="hidden h-full w-64 shrink-0 border-r md:flex md:flex-col"
      style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-b px-5 py-5" style={{ borderColor: 'var(--nav-border)' }}>
        <Link href={isVendorMode ? '/vendor/dashboard' : '/'} className="flex items-center gap-2.5">
          <div className="bg-gold-600 shadow-gold-900/30 flex h-8 w-8 items-center justify-center rounded-lg shadow-lg">
            <span className="text-brand-900 font-display text-sm font-bold">D</span>
          </div>
          <span className="font-display text-brand-900 text-lg font-semibold tracking-tight dark:text-white">
            Djanora
          </span>
        </Link>

        {(role === 'VENDOR' || hasVendorProfile) && (
          <div className="mt-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                isVendorMode
                  ? 'bg-gold-600/15 text-gold-600 dark:text-gold-400 border-gold-600/25'
                  : 'bg-brand-100 dark:bg-brand-700/50 text-brand-500 dark:text-brand-300 border-brand-200 dark:border-white/10',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isVendorMode ? 'bg-gold-500' : 'bg-brand-400',
                )}
              />
              {isVendorMode ? t('vendorMode') : t('planningMode')}
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {nav.map((item) => {
          const active = isActive(item.href, item.exact)
          const badge = (item as { badge?: number }).badge
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'text-brand-900 dark:text-white'
                  : 'text-brand-500 dark:text-brand-300 hover:text-brand-800 hover:bg-black/4 dark:hover:bg-white/6 dark:hover:text-white',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'color-mix(in srgb, var(--color-brand-primary) 18%, transparent)',
                    border: '1.5px solid var(--color-brand-primary)',
                  }}
                />
              )}
              <item.icon
                size={18}
                className={cn(
                  'relative z-10 shrink-0 transition-colors',
                  active
                    ? 'text-gold-800 dark:text-gold-400'
                    : 'text-brand-400 group-hover:text-brand-600 dark:group-hover:text-brand-200',
                )}
                aria-hidden="true"
              />
              <span className="relative z-10 flex-1">{item.label}</span>
              {badge != null && badge > 0 && (
                <span
                  className="relative z-10 ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
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
        className="flex shrink-0 flex-col gap-1 border-t px-3 pt-3 pb-4"
        style={{ borderColor: 'var(--nav-border)' }}
      >
        {/* Language + Theme */}
        <div className="flex flex-col items-start gap-1 px-2 py-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* Switch mode — vendors only */}
        {(role === 'VENDOR' || hasVendorProfile) && (
          <button
            type="button"
            disabled={switching}
            onClick={() => void switchMode()}
            className="text-brand-500 dark:text-brand-300 hover:text-brand-800 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:bg-black/4 disabled:opacity-50 dark:hover:bg-white/6 dark:hover:text-white"
          >
            <ArrowLeftRight size={18} className="text-brand-400" aria-hidden="true" />
            {switching
              ? 'Switching…'
              : t('switchTo', { mode: isVendorMode ? t('planning') : t('vendor') })}
          </button>
        )}

        {/* User row */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="bg-brand-200 dark:bg-brand-600 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-black/8 dark:ring-white/10">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-brand-700 text-xs font-semibold dark:text-white">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-brand-800 truncate text-sm font-medium dark:text-white">
              {displayName}
            </p>
          </div>
          <NotificationBell vendorMode={isVendorMode} />
          <button
            type="button"
            onClick={() => void signOutToHome()}
            className="text-brand-400 hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-200 rounded p-1 transition-colors"
            aria-label={t('signOut')}
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
