import 'server-only'

import { cache } from 'react'
import { getBackendClerkToken } from '@/lib/clerk-token'
import { backend } from '@/lib/backend'
import type { Event, Guest, MyVendorProfile, UserMe, VendorPost } from '@/lib/api.types'

export async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const token = await getBackendClerkToken()
    if (!token) return null

    const { data } = await backend.get<T>(path, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5_000,
    })
    return data ?? null
  } catch {
    return null
  }
}

// cache() deduplicates calls within a single request — safe to call in
// both layout and page without making two network hops
export const getMe = cache(async (): Promise<UserMe | null> => {
  return serverFetch<UserMe>('/users/me')
})

export const getEvents = cache(async (): Promise<Event[]> => {
  return (await serverFetch<Event[]>('/events')) ?? []
})

export const getEvent = cache(async (id: string): Promise<Event | null> => {
  return serverFetch<Event>(`/events/${id}`)
})

export const getGuests = cache(async (eventId: string): Promise<Guest[]> => {
  return (await serverFetch<Guest[]>(`/events/${eventId}/guests`)) ?? []
})

export const getMyVendorProfile = cache(async (): Promise<MyVendorProfile | null> => {
  return serverFetch<MyVendorProfile>('/vendors/me')
})

export const getMyPosts = cache(async (): Promise<VendorPost[]> => {
  return (await serverFetch<VendorPost[]>('/vendors/me/posts')) ?? []
})
