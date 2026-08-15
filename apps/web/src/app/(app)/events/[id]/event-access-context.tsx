'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { EventSurface, EventViewer } from '@/lib/api.types'

const NO_ACCESS_VIEWER: EventViewer = {
  isHost: false,
  role: 'VIEWER',
  surfaces: [],
}

function canSeeSurface(viewer: EventViewer, surface: EventSurface): boolean {
  return viewer.isHost || viewer.surfaces.includes(surface)
}

function canEditSurface(viewer: EventViewer, surface: EventSurface): boolean {
  if (!canSeeSurface(viewer, surface)) return false
  return viewer.isHost || viewer.role === 'EDITOR'
}

function canCommentSurface(viewer: EventViewer, surface: EventSurface): boolean {
  if (!canSeeSurface(viewer, surface)) return false
  return viewer.isHost || viewer.role === 'EDITOR' || viewer.role === 'COMMENTER'
}

type EventAccessValue = {
  eventId: string
  viewer: EventViewer
  isHost: boolean
  canSee: (surface: EventSurface) => boolean
  canEdit: (surface: EventSurface) => boolean
  canComment: (surface: EventSurface) => boolean
}

const EventAccessContext = createContext<EventAccessValue | null>(null)

export function EventAccessProvider({
  eventId,
  viewer,
  children,
}: {
  eventId: string
  viewer?: EventViewer
  children: ReactNode
}) {
  const v = viewer ?? NO_ACCESS_VIEWER
  const value: EventAccessValue = {
    eventId,
    viewer: v,
    isHost: v.isHost,
    canSee: (surface) => canSeeSurface(v, surface),
    canEdit: (surface) => canEditSurface(v, surface),
    canComment: (surface) => canCommentSurface(v, surface),
  }

  return (
    <EventAccessContext.Provider value={value}>
      {children}
    </EventAccessContext.Provider>
  )
}

export function useEventAccess() {
  const ctx = useContext(EventAccessContext)
  if (!ctx) {
    return {
      eventId: '',
      viewer: NO_ACCESS_VIEWER,
      isHost: false,
      canSee: () => false,
      canEdit: () => false,
      canComment: () => false,
    }
  }
  return ctx
}

export { NO_ACCESS_VIEWER }
