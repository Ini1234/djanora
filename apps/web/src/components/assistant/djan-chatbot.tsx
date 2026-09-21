'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { DjanChatProvider, useDjanChatLauncher } from './djan-chat-context'
import { DjanChatPanel } from './djan-chat-panel'

export function DjanChatHost({
  children,
  showLauncher = true,
}: {
  children: ReactNode
  showLauncher?: boolean
}) {
  return (
    <DjanChatProvider>
      {children}
      {showLauncher && <DjanChatbot />}
    </DjanChatProvider>
  )
}

function hideDjanLauncher(pathname: string) {
  return (
    pathname === '/assistant' ||
    pathname.startsWith('/assistant/') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/e/') ||
    pathname.startsWith('/rsvp/')
  )
}

function DjanChatbot() {
  const pathname = usePathname()
  const { open, eventId, toggleChat, closeChat } = useDjanChatLauncher()
  const hideLauncher = hideDjanLauncher(pathname)

  useEffect(() => {
    if (!open || hideLauncher) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeChat()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hideLauncher, closeChat])

  if (hideLauncher) return null

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="djan-dialog-title"
          className="fixed inset-x-3 top-16 bottom-20 z-[80] flex flex-col overflow-hidden rounded-2xl md:inset-auto md:top-auto md:right-5 md:bottom-24 md:h-[min(640px,calc(100vh-7rem))] md:w-[380px]"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 18px 50px rgba(0,0,0,.28)',
          }}
        >
          <DjanChatPanel enabled={open} eventId={eventId} showClose onClose={closeChat} />
        </div>
      )}

      <button
        type="button"
        onClick={toggleChat}
        aria-label={open ? 'Close Djan' : 'Open Djan'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="tap-target fixed right-4 bottom-4 z-[80] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 md:right-5 md:bottom-5"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          outlineColor: 'var(--ring)',
        }}
      >
        {open ? (
          <X size={22} />
        ) : (
          <span className="font-display text-xl font-bold" aria-hidden="true">
            D
          </span>
        )}
      </button>
    </>
  )
}
