/**
 * Tab-scoped EventSource. Survives React Strict Mode remounts.
 * Does not share across tabs — Nest fans those out.
 */

import type { SseEvent } from '@/contexts/sse-context'

type Listener = (event: SseEvent) => void

const RELEASE_DELAY_MS = 300
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

const listeners = new Set<Listener>()
let es: EventSource | null = null
let holders = 0
let releaseTimer: ReturnType<typeof setTimeout> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let backoffMs = INITIAL_BACKOFF_MS

function clearReconnect() {
  if (!reconnectTimer) return
  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function parseEvent(raw: string): SseEvent | null {
  try {
    const event = JSON.parse(raw) as { type?: string }
    if (!event?.type || event.type === 'heartbeat') return null
    return event as SseEvent
  } catch {
    return null
  }
}

function open() {
  if (holders <= 0) return
  if (es && (es.readyState === EventSource.OPEN || es.readyState === EventSource.CONNECTING)) {
    return
  }

  es?.close()
  const source = new EventSource('/api/sse/stream')
  es = source

  source.onopen = () => {
    backoffMs = INITIAL_BACKOFF_MS
  }

  source.onmessage = (message: MessageEvent<string>) => {
    const event = parseEvent(message.data)
    if (!event) return
    backoffMs = INITIAL_BACKOFF_MS
    listeners.forEach((fn) => fn(event))
  }

  source.onerror = () => {
    if (source.readyState === EventSource.CONNECTING) return
    if (source.readyState === EventSource.OPEN) return

    source.close()
    if (es === source) es = null
    if (holders <= 0) return

    const delay = backoffMs * (0.75 + Math.random() * 0.5)
    backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2)
    clearReconnect()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      open()
    }, delay)
  }
}

/** Keep the tab's EventSource alive. Delayed release absorbs Strict Mode. */
export function retainSse(): () => void {
  holders += 1
  if (releaseTimer) {
    clearTimeout(releaseTimer)
    releaseTimer = null
  }
  open()

  return () => {
    holders = Math.max(0, holders - 1)
    if (holders > 0) return
    releaseTimer = setTimeout(() => {
      releaseTimer = null
      if (holders > 0) return
      clearReconnect()
      es?.close()
      es = null
    }, RELEASE_DELAY_MS)
  }
}

export function onSse(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
