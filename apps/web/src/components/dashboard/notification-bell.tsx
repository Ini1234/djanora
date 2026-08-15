'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, CheckCheck, CalendarDays, MessageSquare, Share2, Star } from 'lucide-react'
import { useSse } from '@/contexts/sse-context'
import { cn } from '@/lib/utils'
import { notificationHref } from '@/lib/notification-href'
import type { InAppNotification } from '@/lib/api.types'

const TYPE_ICON: Record<string, React.ReactNode> = {
  EVENT_REMINDER: <CalendarDays size={13} className="text-gold-400" />,
  INQUIRY_RECEIVED: <MessageSquare size={13} className="text-brand-400" />,
  INQUIRY_QUOTED: <MessageSquare size={13} className="text-brand-400" />,
  INQUIRY_ACCEPTED: <MessageSquare size={13} className="text-emerald-400" />,
  INQUIRY_DECLINED: <MessageSquare size={13} className="text-red-400" />,
  BOOKING_CONFIRMED: <CheckCheck size={13} className="text-emerald-400" />,
  EVENT_INVITE: <Share2 size={13} className="text-gold-400" />,
  EVENT_COMMENT: <MessageSquare size={13} className="text-gold-400" />,
  INSPIRATION_COMMENT: <MessageSquare size={13} className="text-gold-400" />,
  REVIEW_REQUEST: <Star size={13} className="text-gold-400" />,
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function NotificationBell({ vendorMode = false }: { vendorMode?: boolean }) {
  const router = useRouter()
  const {
    notifications,
    notificationUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSse()

  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ─── Outside-click to close ───────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const panelWidth = 320
      const gap = 10

      let left = rect.right + gap
      if (left + panelWidth > window.innerWidth - 8) {
        left = window.innerWidth - panelWidth - 8
      }

      const maxHeight = Math.min(420, window.innerHeight - 16)
      let bottom = window.innerHeight - rect.bottom
      if (rect.top - maxHeight < 8) {
        bottom = window.innerHeight - rect.top - rect.height - maxHeight
      }

      setPanelStyle({ position: 'fixed', left, bottom, width: panelWidth, zIndex: 9999 })
    }
    setOpen((v) => !v)
  }

  function openNotification(n: InAppNotification) {
    if (!n.isRead) void markNotificationRead(n.id)
    setOpen(false)
    const href = notificationHref(n, { vendorMode })
    if (href) router.push(href)
  }

  return (
    <>
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications${notificationUnreadCount > 0 ? ` (${notificationUnreadCount} unread)` : ''}`}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-brand-400 hover:text-white hover:bg-white/8 transition-colors"
      >
        <Bell size={17} />
        {notificationUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-gold-500 text-brand-900 text-[9px] font-bold rounded-full px-1 leading-none">
            {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
          </span>
        )}
      </button>

      {/* Floating panel — rendered outside the sidebar via fixed positioning */}
      {open && (
        <div
          ref={panelRef}
          style={panelStyle}
          className="rounded-2xl bg-brand-800 border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {notificationUnreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-xs text-brand-400 hover:text-white transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-brand-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[min(360px,calc(100vh-8rem))] overflow-y-auto divide-y divide-white/6">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="text-brand-600 mx-auto mb-2" />
                <p className="text-sm text-brand-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex gap-3 hover:bg-white/4 transition-colors',
                    !n.isRead && 'bg-brand-700/30',
                  )}
                >
                  <div className="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center">
                    {TYPE_ICON[n.type] ?? <Bell size={13} className="text-brand-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', n.isRead ? 'text-brand-300' : 'text-white font-medium')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-brand-400 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-brand-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-gold-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
