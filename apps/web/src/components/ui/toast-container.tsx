'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, X } from 'lucide-react'
import { useSse, type Toast } from '@/contexts/sse-context'
import { inquiryThreadHref, notificationHref } from '@/lib/notification-href'

function toastHref(toast: Toast, vendorMode: boolean): string | null {
  if (toast.type) {
    const href = notificationHref(
      { type: toast.type, metadata: toast.metadata ?? null },
      { vendorMode },
    )
    if (href) return href
  }
  if (toast.inquiryId) return inquiryThreadHref(toast.inquiryId, vendorMode)
  return null
}

function ToastCard({
  toast,
  vendorMode,
  onDismiss,
}: {
  toast: Toast
  vendorMode: boolean
  onDismiss: () => void
}) {
  const router = useRouter()
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = progressRef.current
    if (!el) return
    el.animate([{ width: '100%' }, { width: '0%' }], {
      duration: 5000,
      easing: 'linear',
      fill: 'forwards',
    })
  }, [])

  const href = toastHref(toast, vendorMode)

  return (
    <div
      role="alert"
      className="relative flex w-72 cursor-pointer items-start gap-3 overflow-hidden rounded-xl px-4 py-3 shadow-lg select-none"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,.18)',
      }}
      onClick={() => {
        if (href) router.push(href)
        onDismiss()
      }}
    >
      {/* Icon */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'color-mix(in srgb, var(--color-brand-primary) 15%, transparent)' }}
      >
        <MessageSquare size={15} style={{ color: 'var(--color-brand-primary)' }} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] leading-tight font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {toast.title}
        </p>
        <p
          className="mt-0.5 line-clamp-2 text-[12px] leading-snug"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {toast.body}
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
        className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="absolute bottom-0 left-0 h-0.5 rounded-full"
        style={{ background: 'var(--color-brand-primary)', width: '100%' }}
      />
    </div>
  )
}

/** Renders all active toast notifications stacked in the bottom-right corner. */
export function ToastContainer({ vendorMode = false }: { vendorMode?: boolean }) {
  const { toasts, dismissToast } = useSse()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed right-5 bottom-5 z-[9999] flex max-h-[calc(100vh-5rem)] flex-col-reverse gap-2 overflow-hidden"
      aria-live="polite"
      aria-label="Notifications"
    >
      {[...toasts].reverse().map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          vendorMode={vendorMode}
          onDismiss={() => dismissToast(t.id)}
        />
      ))}
    </div>
  )
}
