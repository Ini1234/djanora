'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type DjanSheetKind = 'guests' | 'budget' | 'checklist' | 'schedule' | 'party'

export type DjanSheetAttachment = {
  kind: DjanSheetKind
  filename: string
  grid: string[][]
  truncated?: boolean
}

type DjanChatContextValue = {
  open: boolean
  eventId?: string
  pendingSheet?: DjanSheetAttachment
  openChat: (opts?: { eventId?: string; sheet?: DjanSheetAttachment }) => void
  consumePendingSheet: () => DjanSheetAttachment | undefined
  closeChat: () => void
  toggleChat: () => void
}

const DjanChatContext = createContext<DjanChatContextValue | null>(null)

export function DjanChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [eventId, setEventId] = useState<string | undefined>()
  const [pendingSheet, setPendingSheet] = useState<DjanSheetAttachment | undefined>()
  const pendingRef = useRef<DjanSheetAttachment | undefined>(undefined)

  const openChat = useCallback((opts?: { eventId?: string; sheet?: DjanSheetAttachment }) => {
    setEventId(opts?.eventId)
    pendingRef.current = opts?.sheet
    setPendingSheet(opts?.sheet)
    setOpen(true)
  }, [])

  const consumePendingSheet = useCallback(() => {
    const taken = pendingRef.current
    pendingRef.current = undefined
    setPendingSheet(undefined)
    return taken
  }, [])

  const closeChat = useCallback(() => setOpen(false), [])

  const toggleChat = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const value = useMemo(
    () => ({
      open,
      eventId,
      pendingSheet,
      openChat,
      consumePendingSheet,
      closeChat,
      toggleChat,
    }),
    [open, eventId, pendingSheet, openChat, consumePendingSheet, closeChat, toggleChat],
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
