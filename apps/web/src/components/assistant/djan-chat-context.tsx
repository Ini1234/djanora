'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type DjanChatContextValue = {
  open: boolean
  eventId?: string
  openChat: (opts?: { eventId?: string }) => void
  closeChat: () => void
  toggleChat: () => void
}

const DjanChatContext = createContext<DjanChatContextValue | null>(null)

export function DjanChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [eventId, setEventId] = useState<string | undefined>()

  const openChat = useCallback((opts?: { eventId?: string }) => {
    setEventId(opts?.eventId)
    setOpen(true)
  }, [])

  const closeChat = useCallback(() => setOpen(false), [])

  const toggleChat = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const value = useMemo(
    () => ({ open, eventId, openChat, closeChat, toggleChat }),
    [open, eventId, openChat, closeChat, toggleChat],
  )

  return <DjanChatContext.Provider value={value}>{children}</DjanChatContext.Provider>
}

export function useDjanChatLauncher() {
  const ctx = useContext(DjanChatContext)
  if (!ctx) {
    throw new Error('useDjanChatLauncher must be used within DjanChatProvider')
  }
  return ctx
}
