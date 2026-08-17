/**
 * Axios instance for calling Next.js /api/proxy/* routes.
 * Auth is handled server-side by Clerk — no token needed on the client.
 *
 * Never use fetch() — see .cursor/rules/http-client.mdc.
 * New Nest endpoints: call the canonical path here. Do not add a proxy route file.
 *
 * GET requests in flight for the same URL share one Promise.
 * Completed GETs are not reused — React Query owns list cache where it matters.
 * POST / PATCH / DELETE are always sent as-is (mutations must not be coalesced).
 */
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

const _base = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
})

const _inFlight = new Map<string, Promise<AxiosResponse<unknown>>>()

function getKey(url: string, config?: AxiosRequestConfig) {
  return config?.params != null ? `${url}:${JSON.stringify(config.params)}` : url
}

export const proxyClient = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const key = getKey(url, config)
    const hit = _inFlight.get(key) as Promise<AxiosResponse<T>> | undefined
    if (hit) return hit

    const p = _base.get<T>(url, config).finally(() => _inFlight.delete(key)) as Promise<
      AxiosResponse<T>
    >

    _inFlight.set(key, p as Promise<AxiosResponse<unknown>>)
    return p
  },

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return _base.post<T>(url, data, config)
  },

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return _base.patch<T>(url, data, config)
  },

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return _base.delete<T>(url, config)
  },
}
