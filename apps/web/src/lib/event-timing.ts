export function eventDateKey(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  return dateStr.slice(0, 10)
}

export function todayKey(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function isPastEvent(event: {
  isCompleted?: boolean
  estimatedDate?: string | null
}): boolean {
  if (event.isCompleted) return true
  const key = eventDateKey(event.estimatedDate)
  if (!key) return false
  return key < todayKey()
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  const key = eventDateKey(dateStr)
  if (!key) return null
  const start = new Date(`${todayKey()}T00:00:00`).getTime()
  const target = new Date(`${key}T00:00:00`).getTime()
  return Math.round((target - start) / 86_400_000)
}

export function formatEventDate(dateStr: string | null | undefined): string | null {
  const key = eventDateKey(dateStr)
  if (!key) return null
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function countdownLabel(days: number | null, style: 'short' | 'long' = 'short'): string | null {
  if (days == null || days < 0) return null
  if (days === 0) return 'Today'
  if (days === 1) return style === 'long' ? '1 day' : 'Tomorrow'
  return style === 'long' ? `${days} days` : `${days}d`
}

export function splitByTiming<T extends { isCompleted?: boolean; estimatedDate?: string | null }>(
  events: T[],
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = []
  const past: T[] = []
  for (const event of events) {
    if (isPastEvent(event)) past.push(event)
    else upcoming.push(event)
  }
  const byDate = (a: T, b: T, dir: 1 | -1) => {
    const aKey = eventDateKey(a.estimatedDate)
    const bKey = eventDateKey(b.estimatedDate)
    if (!aKey && !bKey) return 0
    if (!aKey) return 1
    if (!bKey) return -1
    return aKey < bKey ? -dir : aKey > bKey ? dir : 0
  }
  upcoming.sort((a, b) => byDate(a, b, 1))
  past.sort((a, b) => byDate(a, b, -1))
  return { upcoming, past }
}
