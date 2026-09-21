import axios from 'axios'

export class BackendUnavailableError extends Error {
  constructor() {
    super('backend_unavailable')
    this.name = 'BackendUnavailableError'
  }
}

export function isBackendUnavailable(err: unknown): boolean {
  return err instanceof BackendUnavailableError
}

/**
 * 401/403: session not accepted.
 * 404: resource missing.
 * Timeout, 5xx, and network: Nest did not answer. That is not signed-out.
 */
export function classifyAxiosFailure(
  err: unknown,
): 'unauthenticated' | 'not_found' | 'unavailable' {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (status === 401 || status === 403) return 'unauthenticated'
    if (status === 404) return 'not_found'
  }
  return 'unavailable'
}
