import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { useAuth } from '@clerk/nextjs'
import { useCallback, useMemo } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ─── Axios instance ───────────────────────────────────────────────────────────
const apiAxios = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Module-level token cache ─────────────────────────────────────────────────
// Shared across all useApi() calls so we only hit Clerk's token endpoint
// when the cached JWT is actually expired (or within 15 s of expiry).
let cachedToken: string | null = null
let tokenExpiresAtMs = 0
let cachedTokenUserId: string | null = null
// In-flight refresh promise — deduplicates concurrent requests so only one
// getToken() call is in flight at a time regardless of how many API calls fire.
let inflightRefresh: Promise<string | null> | null = null

const inFlightGets = new Map<string, Promise<AxiosResponse<unknown>>>()

function parseExpiry(jwt: string): number {
  try {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

function isCachedTokenFresh(userId: string | null | undefined): boolean {
  // Keep a 15-second buffer so we never send a token that is about to expire
  return (
    cachedToken !== null &&
    cachedTokenUserId === (userId ?? null) &&
    Date.now() < tokenExpiresAtMs - 15_000
  )
}

async function getOrRefreshToken(
  getToken: () => Promise<string | null>,
  userId: string | null | undefined,
): Promise<string | null> {
  if (isCachedTokenFresh(userId)) return cachedToken

  // Deduplicate: if a refresh is already in-flight, wait for it
  if (inflightRefresh) return inflightRefresh

  inflightRefresh = getToken()
    .then((token) => {
      inflightRefresh = null
      if (token) {
        cachedToken = token
        tokenExpiresAtMs = parseExpiry(token)
        cachedTokenUserId = userId ?? null
      }
      return token
    })
    .catch(() => {
      inflightRefresh = null
      return null
    })

  return inflightRefresh
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// All returned method references are stable (won't change between renders) so
// components can safely include them in useEffect / useCallback dependency arrays
// without triggering infinite loops.
export function useApi() {
  const { getToken, userId } = useAuth()

  const authHeaders = useCallback(async (): Promise<AxiosRequestConfig['headers']> => {
    const token = await getOrRefreshToken(getToken, userId)
    return { Authorization: `Bearer ${token ?? ''}` }
  }, [getToken, userId])

  const get = useCallback(
    async <T>(path: string): Promise<T> => {
      const key = `${userId ?? 'anonymous'}:${path}`
      const hit = inFlightGets.get(key) as Promise<AxiosResponse<T>> | undefined
      if (hit) {
        const { data } = await hit
        return data
      }

      const request = apiAxios
        .get<T>(path, { headers: await authHeaders() })
        .finally(() => inFlightGets.delete(key))

      inFlightGets.set(key, request as Promise<AxiosResponse<unknown>>)
      const { data } = await request
      return data
    },
    [authHeaders, userId],
  )

  const post = useCallback(
    async <T>(path: string, body: unknown): Promise<T> => {
      const { data } = await apiAxios.post<T>(path, body, { headers: await authHeaders() })
      return data
    },
    [authHeaders],
  )

  const patch = useCallback(
    async <T>(path: string, body: unknown): Promise<T> => {
      const { data } = await apiAxios.patch<T>(path, body, { headers: await authHeaders() })
      return data
    },
    [authHeaders],
  )

  const del = useCallback(
    async <T>(path: string): Promise<T> => {
      const { data } = await apiAxios.delete<T>(path, { headers: await authHeaders() })
      return data
    },
    [authHeaders],
  )

  return useMemo(() => ({ get, post, patch, del }), [get, post, patch, del])
}
