'use client'

import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { proxyClient } from '@/lib/proxy-client'
import { onSse, retainSse } from '@/lib/sse-connection'
import type { InAppNotification } from '@/lib/api.types'

/* ─── Types ───────────────────────────────────────────────── */

export interface SseMessage {
  id: string
  message: string
  kind?: 'TEXT' | 'QUOTE' | 'LINK'
  payload?: unknown
  createdAt: string
  readAt?: string | null
  editedAt?: string | null
  unsentAt?: string | null
  isCurrentUser: boolean
  sender: {
    id: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
    vendorProfile: { businessName: string } | null
  }
}

export interface SseNotification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  metadata: unknown
}

export interface SseEvent {
  type: 'new_message' | 'message_updated' | 'message_unsent' | 'messages_read' | 'inquiry_status' | 'notification' | 'event_comment' | 'event_activity'
  inquiryId?: string
  eventId?: string
  message?: SseMessage
  unsent?: {
    messageId: string
    unsentAt: string
  }
  read?: {
    messageIds: string[]
    readAt: string
  }
  status?: string
  notification?: SseNotification
  comment?: {
    action: 'created' | 'updated' | 'deleted'
    id: string
    eventId: string
    subjectType: string
    subjectId: string
    parentId?: string | null
    body?: string
    createdAt?: string
    updatedAt?: string
    author?: {
      id: string
      firstName: string | null
      lastName: string | null
      avatarUrl: string | null
    }
    mentions?: { userId: string }[]
  }
  activity?: {
    id: string
    eventId: string
    action: string
    surface: string
    summary: string
    subjectType: string | null
    subjectId: string | null
    createdAt: string
    actor: { id: string; firstName: string | null; lastName: string | null }
  }
}

export interface Toast {
  id: string
  title: string
  body: string
  inquiryId?: string
  type?: string
  metadata?: Record<string, unknown> | null
  createdAt: number
}

type Listener = (event: SseEvent) => void

interface SseContextValue {
  /** Subscribe to raw SSE events. Returns unsubscribe fn. */
  on: (fn: Listener) => () => void
  /** Unread message count (resets when user visits messages/inquiries) */
  unreadCount: number
  clearUnread: () => void
  /** In-app notifications, hydrated once at app-shell level */
  notifications: InAppNotification[]
  notificationUnreadCount: number
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  /** Active toasts */
  toasts: Toast[]
  dismissToast: (id: string) => void
}

/* ─── Context ─────────────────────────────────────────────── */
const SseCtx = createContext<SseContextValue>({
  on: () => () => {},
  unreadCount: 0,
  clearUnread: () => {},
  notifications: [],
  notificationUnreadCount: 0,
  markNotificationRead: async () => {},
  markAllNotificationsRead: async () => {},
  toasts: [],
  dismissToast: () => {},
})

export function useSse() {
  return useContext(SseCtx)
}

/** Pages where the user is actively reading messages — suppress toasts here */
const CHAT_PATHS = ['/messages', '/inquiries']

/* ─── Provider ────────────────────────────────────────────── */
export function SseProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const hydratedNotificationsRef = useRef(false)
  const seenNotificationIdsRef = useRef<Set<string>>(new Set())
  const notificationsRef = useRef<InAppNotification[]>([])
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  useEffect(() => { notificationsRef.current = notifications }, [notifications])

  // Keep pathname ref in sync without re-creating `connect`
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  const hydrateNotifications = useCallback(async () => {
    try {
      const { data } = await proxyClient.get<{
        notifications: InAppNotification[]
        unreadCount: number
      }>('/notifications')

      setNotifications(data.notifications)
      setNotificationUnreadCount(data.unreadCount)
      seenNotificationIdsRef.current = new Set(data.notifications.map((n) => n.id))
    } catch {
      // Notification hydration should not block app shell rendering.
    }
  }, [])

  useEffect(() => {
    if (hydratedNotificationsRef.current) return
    hydratedNotificationsRef.current = true
    hydrateNotifications()
  }, [hydrateNotifications])

  // Clear unread + toasts when the user navigates to a chat page
  useEffect(() => {
    if (CHAT_PATHS.some((p) => pathname.startsWith(p))) {
      queueMicrotask(() => {
        setUnreadCount(0)
        setToasts([])
      })
    }
  }, [pathname])

  useEffect(() => retainSse(), [])

  useEffect(() => {
    return onSse((event) => {
      if (event.type === 'new_message' && event.message) {
        if (event.message.isCurrentUser) return
        if (CHAT_PATHS.some((p) => pathnameRef.current.startsWith(p))) return

        const senderName =
          event.message.sender.vendorProfile?.businessName ||
          [event.message.sender.firstName, event.message.sender.lastName]
            .filter(Boolean).join(' ') || 'Someone'

        setUnreadCount((n) => n + 1)

        const toastId = `msg-${event.inquiryId}`
        setToasts((prev) => {
          const next: Toast = {
            id: toastId,
            title: `New message from ${senderName}`,
            body: event.message!.message.slice(0, 80),
            inquiryId: event.inquiryId,
            createdAt: Date.now(),
          }
          const filtered = prev.filter((t) => t.id !== toastId)
          const appended = [...filtered, next]
          return appended.length > 3 ? appended.slice(appended.length - 3) : appended
        })

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId))
        }, 5000)
      }

      if (event.type === 'notification' && event.notification) {
        const n = event.notification
        if (!seenNotificationIdsRef.current.has(n.id)) {
          seenNotificationIdsRef.current.add(n.id)
          const notification: InAppNotification = {
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            isRead: n.isRead,
            createdAt: n.createdAt,
            metadata: (n.metadata ?? null) as Record<string, unknown> | null,
          }
          setNotifications((prev) => [notification, ...prev].slice(0, 20))
          if (!n.isRead) setNotificationUnreadCount((count) => count + 1)
        }

        const toastId = `notif-${n.id}`
        setToasts((prev) => {
          const next: Toast = {
            id: toastId,
            title: n.title,
            body: n.body.slice(0, 100),
            type: n.type,
            metadata: (n.metadata ?? null) as Record<string, unknown> | null,
            createdAt: Date.now(),
          }
          const filtered = prev.filter((t) => t.id !== toastId)
          const appended = [...filtered, next]
          return appended.length > 3 ? appended.slice(appended.length - 3) : appended
        })

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId))
        }, 6000)
      }
    })
  }, [])

  const on = useCallback((fn: Listener) => onSse(fn), [])

  const clearUnread = useCallback(() => setUnreadCount(0), [])

  const markNotificationRead = useCallback(async (id: string) => {
    const wasUnread = notificationsRef.current.some((n) => n.id === id && !n.isRead)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    if (wasUnread) setNotificationUnreadCount((count) => Math.max(0, count - 1))

    try {
      await proxyClient.patch(`/notifications/${id}/read`, {})
    } catch {
      await hydrateNotifications()
    }
  }, [hydrateNotifications])

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setNotificationUnreadCount(0)

    try {
      await proxyClient.patch('/notifications/read-all', {})
    } catch {
      await hydrateNotifications()
    }
  }, [hydrateNotifications])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <SseCtx.Provider
      value={{
        on,
        unreadCount,
        clearUnread,
        notifications,
        notificationUnreadCount,
        markNotificationRead,
        markAllNotificationsRead,
        toasts,
        dismissToast,
      }}
    >
      {children}
    </SseCtx.Provider>
  )
}
