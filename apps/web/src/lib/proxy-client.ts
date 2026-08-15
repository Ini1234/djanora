/**
 * Axios instance for calling Next.js /api/proxy/* routes.
 * Auth is handled server-side by Clerk — no token needed on the client.
 *
 * Never use fetch() — see .cursor/rules/http-client.mdc.
 * New Nest endpoints: call the canonical path here. Do not add a proxy route file.
 *
 * GET requests are deduplicated:
 * - while the same URL is in flight, callers receive the same Promise
 * - for a tiny post-response window, callers reuse the same response
 *
 * The short response window absorbs React Strict Mode remounts in development
 * without turning this into a long-lived client cache.
 *
 * POST / PATCH / DELETE are always sent as-is (mutations must not be deduped).
 */
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

const _base = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
})

const GET_REUSE_WINDOW_MS = 1_000

// Map of URL → in-flight promise
const _inFlight = new Map<string, Promise<AxiosResponse<unknown>>>()
const _recentGets = new Map<string, { expiresAt: number; response: AxiosResponse<unknown> }>()

function clearGetCache() {
  _inFlight.clear()
  _recentGets.clear()
}

export const proxyClient = {
  clearGetCache,

  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    // Include params in the cache key if provided
    const key =
      config?.params != null ? `${url}:${JSON.stringify(config.params)}` : url

    const now = Date.now()
    const recent = _recentGets.get(key) as { expiresAt: number; response: AxiosResponse<T> } | undefined
    if (recent && now < recent.expiresAt) return Promise.resolve(recent.response)

    const hit = _inFlight.get(key) as Promise<AxiosResponse<T>> | undefined
    if (hit) return hit

    const p = _base
      .get<T>(url, config)
      .then((response) => {
        _recentGets.set(key, {
          expiresAt: Date.now() + GET_REUSE_WINDOW_MS,
          response: response as AxiosResponse<unknown>,
        })
        return response
      })
      .finally(() => _inFlight.delete(key)) as Promise<AxiosResponse<T>>

    _inFlight.set(key, p as Promise<AxiosResponse<unknown>>)
    return p
  },

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    clearGetCache()
    return _base.post<T>(url, data, config)
  },

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    clearGetCache()
    return _base.patch<T>(url, data, config)
  },

  delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    clearGetCache()
    return _base.delete<T>(url, config)
  },
}
