function fromApiMessage(message: unknown): string | null {
  if (typeof message === 'string' && message.trim()) return message
  if (Array.isArray(message)) {
    const parts = message.map(fromApiMessage).filter((part): part is string => Boolean(part))
    return parts.length ? parts.join(' ') : null
  }
  return null
}

export function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { message?: unknown } }
    message?: unknown
  }
  return fromApiMessage(maybe.response?.data?.message) ?? fromApiMessage(maybe.message) ?? fallback
}
