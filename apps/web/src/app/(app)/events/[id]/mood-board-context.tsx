'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { proxyClient } from '@/lib/proxy-client'

interface VendorProfile {
  id: string
  slug: string
  businessName: string
  isVerified: boolean
  avatarUrl: string | null
  city: string | null
}

export interface MoodBoardInspirationItem {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  imageUrl: string | null
  location: string | null
  priceRangeFrom: number | null
  priceRangeTo: number | null
  currency: string
  isAdminCurated: boolean
  vendorProfile: VendorProfile | null
}

export interface MoodBoardEntry {
  id: string
  notes: string | null
  createdAt: string
  inspirationItem: MoodBoardInspirationItem
  checklistItem: { id: string; title: string } | null
  budgetItem: { id: string; label: string | null; category: string } | null
  scheduleItems: { id: string; title: string }[]
}

interface MoodBoardContextValue {
  entries: MoodBoardEntry[]
  loading: boolean
  entriesByChecklistId: Map<string, MoodBoardEntry[]>
  entriesByBudgetId: Map<string, MoodBoardEntry[]>
  entriesByScheduleId: Map<string, MoodBoardEntry[]>
  reload: () => Promise<void>
  removeEntry: (inspirationItemId: string) => Promise<void>
}

const MoodBoardContext = createContext<MoodBoardContextValue | null>(null)

export function MoodBoardProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const [entries, setEntries] = useState<MoodBoardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const loadedRef = useRef(false)

  const reload = useCallback(async () => {
    try {
      const { data } = await proxyClient.get<MoodBoardEntry[]>(`/inspiration/mood-board/${eventId}`)
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    reload()
  }, [reload])

  const removeEntry = useCallback(
    async (inspirationItemId: string) => {
      await proxyClient.delete(`/inspiration/${inspirationItemId}/save`, {
        params: { eventId },
      })
      setEntries((prev) => prev.filter((entry) => entry.inspirationItem.id !== inspirationItemId))
    },
    [eventId],
  )

  const { entriesByChecklistId, entriesByBudgetId, entriesByScheduleId } = useMemo(() => {
    const byChecklist = new Map<string, MoodBoardEntry[]>()
    const byBudget = new Map<string, MoodBoardEntry[]>()
    const bySchedule = new Map<string, MoodBoardEntry[]>()

    for (const entry of entries) {
      if (entry.checklistItem) {
        const current = byChecklist.get(entry.checklistItem.id) ?? []
        current.push(entry)
        byChecklist.set(entry.checklistItem.id, current)
      }
      if (entry.budgetItem) {
        const current = byBudget.get(entry.budgetItem.id) ?? []
        current.push(entry)
        byBudget.set(entry.budgetItem.id, current)
      }
      for (const block of entry.scheduleItems ?? []) {
        const current = bySchedule.get(block.id) ?? []
        current.push(entry)
        bySchedule.set(block.id, current)
      }
    }

    return {
      entriesByChecklistId: byChecklist,
      entriesByBudgetId: byBudget,
      entriesByScheduleId: bySchedule,
    }
  }, [entries])

  const value = useMemo(
    () => ({
      entries,
      loading,
      entriesByChecklistId,
      entriesByBudgetId,
      entriesByScheduleId,
      reload,
      removeEntry,
    }),
    [
      entries,
      loading,
      entriesByChecklistId,
      entriesByBudgetId,
      entriesByScheduleId,
      reload,
      removeEntry,
    ],
  )

  return <MoodBoardContext.Provider value={value}>{children}</MoodBoardContext.Provider>
}

export function useMoodBoardLinks() {
  const ctx = useContext(MoodBoardContext)
  if (!ctx) throw new Error('useMoodBoardLinks must be used within MoodBoardProvider')
  return ctx
}
