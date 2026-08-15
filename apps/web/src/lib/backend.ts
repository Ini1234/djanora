/**
 * Axios client for the Nest API (`NEXT_PUBLIC_API_URL/api`).
 *
 * Safe to import from Server Components, Route Handlers, and public client
 * pages (RSVP). Do not put Clerk or `next/server` imports here.
 *
 * Authenticated browser calls go through `proxyClient` → `/api/proxy/*`.
 * Authenticated RSC calls use `serverGet` in `api.server.ts`.
 */
import axios from 'axios'

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export const backend = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15_000,
})

export async function publicGet<T = unknown>(path: string): Promise<T | null> {
  try {
    const { data } = await backend.get<T>(path, { timeout: 5_000 })
    return data
  } catch {
    return null
  }
}
