import 'server-only'

import { cache } from 'react'
import { getBackendClerkToken } from '@/lib/clerk-token'
import { backend } from '@/lib/backend'
import { BackendUnavailableError, classifyAxiosFailure } from '@/lib/backend-errors'
import type { Event, Guest, MyVendorProfile, UserMe, VendorPost } from '@/lib/api.types'

const RSC_TIMEOUT_MS = 15_000

export async function serverFetch<T>(path: string): Promise<T | null> {
  const token = await getBackendClerkToken()
  if (!token) return null

  try {
    const { data } = await backend.get<T>(path, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: RSC_TIMEOUT_MS,
    })
    return data ?? null
  } catch (err) {
    const kind = classifyAxiosFailure(err)
    if (kind === 'unauthenticated' || kind === 'not_found') return null
    throw new BackendUnavailableError()
  }
}

export const loadMe = cache(async (): Promise<{ user: UserMe | null; unavailable: boolean }> => {
  try {
    return { user: await serverFetch<UserMe>('/users/me'), unavailable: false }
  } catch (err) {
    if (err instanceof BackendUnavailableError) return { user: null, unavailable: true }
    throw err
  }
})

export async function getMe(): Promise<UserMe | null> {
  const { user, unavailable } = await loadMe()
  if (unavailable) throw new BackendUnavailableError()
  return user
}

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
