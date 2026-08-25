export function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { message?: unknown } }
    message?: unknown
  }
  const apiMessage = maybe.response?.data?.message
  if (typeof apiMessage === 'string') return apiMessage
  if (typeof maybe.message === 'string') return maybe.message
  return fallback
}
