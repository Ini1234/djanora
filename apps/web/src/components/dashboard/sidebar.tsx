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
  Shield,
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
import { DjanNavIcon } from '@/components/assistant/djan-mark'

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
    { href: '/assistant', label: t.has('assistant') ? t('assistant') : 'Djan', icon: DjanNavIcon },
    { href: '/messages', label: t('messages'), icon: MessageSquare, badge: unreadCount },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const VENDOR_NAV = [
    { href: '/vendor/dashboard', label: t('overview'), icon: LayoutDashboard, exact: true },
    { href: '/assistant', label: t.has('assistant') ? t('assistant') : 'Djan', icon: DjanNavIcon },
    { href: '/inquiries', label: t('inquiries'), icon: MessageSquare, badge: unreadCount },
    { href: '/portfolio', label: t('portfolio'), icon: Search },
    { href: '/settings', label: t('settings'), icon: Settings },
  ]

  const nav = [
    ...(isVendorMode ? VENDOR_NAV : HOST_NAV),
    ...(role === 'ADMIN'
      ? [{ href: '/admin', label: t.has('admin') ? t('admin') : 'Admin', icon: Shield }]
      : []),
  ]

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="bg-nav border-nav-border hidden h-full w-64 shrink-0 border-r md:flex md:flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-nav-border shrink-0 border-b px-5 py-5">
        <Link href={isVendorMode ? '/vendor/dashboard' : '/'} className="flex items-center gap-2.5">
          <div className="bg-primary text-primary-fg flex h-8 w-8 items-center justify-center rounded-lg shadow-lg">
            <span className="font-display text-sm font-bold">D</span>
          </div>
          <span className="font-display text-nav-fg text-lg font-semibold tracking-tight">
            Djanora
          </span>
        </Link>

        {(role === 'VENDOR' || hasVendorProfile) && (
          <div className="mt-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                isVendorMode
                  ? 'bg-primary/15 text-primary border-primary/25'
                  : 'bg-hover text-nav-muted border-nav-border',
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', isVendorMode ? 'bg-primary' : 'bg-muted')}
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
                active ? 'text-nav-fg' : 'text-nav-muted hover:bg-nav-hover hover:text-nav-fg',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span className="bg-nav-active border-primary absolute inset-0 rounded-xl border-[1.5px]" />
              )}
              <item.icon
                size={18}
                className={cn(
                  'relative z-10 shrink-0 transition-colors',
                  active ? 'text-nav-fg' : 'text-nav-muted group-hover:text-nav-fg',
                )}
                aria-hidden="true"
              />
              <span className="relative z-10 flex-1">{item.label}</span>
              {badge != null && badge > 0 && (
                <span
                  className="bg-primary text-primary-fg relative z-10 ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
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
      <div className="border-nav-border flex shrink-0 flex-col gap-1 border-t px-3 pt-3 pb-4">
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
            className="text-nav-muted hover:bg-nav-hover hover:text-nav-fg flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
          >
            <ArrowLeftRight size={18} className="text-nav-muted" aria-hidden="true" />
            {switching
              ? 'Switching…'
              : t('switchTo', { mode: isVendorMode ? t('planning') : t('vendor') })}
          </button>
        )}

        {/* User row */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="bg-hover ring-border flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-nav-fg text-xs font-semibold">{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-nav-fg truncate text-sm font-medium">{displayName}</p>
          </div>
          <NotificationBell vendorMode={isVendorMode} />
          <button
            type="button"
            onClick={() => void signOutToHome()}
            className="text-nav-muted hover:text-nav-fg rounded p-1 transition-colors"
            aria-label={t('signOut')}
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
