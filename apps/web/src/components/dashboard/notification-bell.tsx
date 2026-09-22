'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, CheckCheck, CalendarDays, MessageSquare, Share2, Star } from 'lucide-react'
import { useSse } from '@/contexts/sse-context'
import { cn } from '@/lib/utils'
import { notificationHref } from '@/lib/notification-href'
import type { InAppNotification } from '@/lib/api.types'

const TYPE_ICON: Record<string, React.ReactNode> = {
  EVENT_REMINDER: <CalendarDays size={13} className="text-fg" />,
  INQUIRY_RECEIVED: <MessageSquare size={13} className="text-muted" />,
  INQUIRY_QUOTED: <MessageSquare size={13} className="text-muted" />,
  INQUIRY_ACCEPTED: <MessageSquare size={13} className="text-success" />,
  INQUIRY_DECLINED: <MessageSquare size={13} className="text-danger" />,
  BOOKING_CONFIRMED: <CheckCheck size={13} className="text-success" />,
  EVENT_INVITE: <Share2 size={13} className="text-fg" />,
  EVENT_COMMENT: <MessageSquare size={13} className="text-fg" />,
  INSPIRATION_COMMENT: <MessageSquare size={13} className="text-fg" />,
  REVIEW_REQUEST: <Star size={13} className="text-fg" />,
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
  const { notifications, notificationUnreadCount, markNotificationRead, markAllNotificationsRead } =
    useSse()

  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ─── Outside-click to close ───────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
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
        className="text-nav-muted hover:bg-nav-hover hover:text-nav-fg relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
      >
        <Bell size={17} />
        {notificationUnreadCount > 0 && (
          <span className="bg-primary text-primary-fg absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] leading-none font-bold">
            {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
          </span>
        )}
      </button>

      {/* Floating panel — rendered outside the sidebar via fixed positioning */}
      {open && (
        <div ref={panelRef} style={panelStyle} className="popover overflow-hidden rounded-2xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-fg text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {notificationUnreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-muted hover:text-fg text-xs transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted hover:text-fg">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div
            className="max-h-[min(360px,calc(var(--app-vh)-8rem))] divide-y overflow-y-auto"
            style={{ borderColor: 'var(--border)' }}
          >
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="text-muted mx-auto mb-2" />
                <p className="text-muted text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    'hover:bg-hover flex w-full gap-3 px-4 py-3 text-left transition-colors',
                    !n.isRead && 'bg-hover',
                  )}
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    {TYPE_ICON[n.type] ?? <Bell size={13} className="text-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm leading-snug',
                        n.isRead ? 'text-muted' : 'text-fg font-medium',
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="text-muted mt-0.5 line-clamp-2 text-xs leading-snug">{n.body}</p>
                    <p className="text-muted mt-1 text-[10px]">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <div className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
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
