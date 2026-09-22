'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proxyClient } from '@/lib/proxy-client'
import type { DjanSheetAttachment } from './djan-chat-context'
import { hrefAfterImport, isSafeAppHref, notifyEventRefresh, readPageContext } from './djan-nav'

export type ConfirmCard = {
  tool: string
  args: Record<string, unknown>
  summary: string
  blast_radius: string
  confirm_token: string
  expires_at: string
}

export type Citation = { kind: 'culture' | 'city'; title: string; source: string }

export type NavAction = { href: string; label: string }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  parts?: {
    confirms?: ConfirmCard[]
    citations?: Citation[]
    jobs?: string[]
    navigations?: NavAction[]
  } | null
  createdAt: string
}

export type ThreadSummary = {
  id: string
  title: string | null
  sessionId?: string
  currentEventId: string | null
  currentEvent?: { id: string; title: string } | null
  updatedAt: string
}

export type Thread = ThreadSummary & { messages: ChatMessage[] }

export const DJAN_STARTERS = [
  'We are Yoruba in Lagos. What ceremonies should we create?',
  'What should I know about a Houston wedding weekend?',
  'Add a checklist for our introduction.',
  'Show my events and set the current one.',
]

export function useDjanChat({
  enabled,
  eventId,
  threadId,
  autoSelectLatest = true,
}: {
  enabled: boolean
  eventId?: string
  threadId?: string
  autoSelectLatest?: boolean
}) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [thread, setThread] = useState<Thread | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const localSeq = useRef(0)
  const loadedId = useRef<string | null>(null)
  const router = useRouter()

  const go = useCallback(
    (href: string) => {
      if (!isSafeAppHref(href)) return
      router.push(href)
    },
    [router],
  )

  const loadThreads = useCallback(async () => {
    const { data } = await proxyClient.get<ThreadSummary[]>('/assistant/threads')
    setThreads(data)
    return data
  }, [])

  const openThread = useCallback(async (id: string) => {
    const { data } = await proxyClient.get<Thread>(`/assistant/threads/${id}`)
    loadedId.current = data.id
    setThread(data)
    return data
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      try {
        const [{ data: status }, list] = await Promise.all([
          proxyClient.get<{ configured: boolean }>('/assistant/status'),
          loadThreads(),
        ])
        if (cancelled) return
        setConfigured(status.configured)
        if (threadId && loadedId.current === threadId) return
        if (threadId) {
          await openThread(threadId)
          return
        }
        if (eventId) {
          const existing = list.find((item) => item.currentEventId === eventId)
          if (existing) await openThread(existing.id)
          return
        }
        if (autoSelectLatest && list[0]) await openThread(list[0].id)
      } catch {
        if (!cancelled) setError('Could not load Djan.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, eventId, threadId, autoSelectLatest, loadThreads, openThread])

  const send = async (text: string, extras?: { sheet?: DjanSheetAttachment }) => {
    const content = text.trim()
    if (!content || busy) return
    setError(null)
    setBusy(true)
    setDraft('')
    try {
      let current = thread
      if (!current) {
        const { data } = await proxyClient.post<Thread>('/assistant/threads', { eventId })
        current = data
        loadedId.current = data.id
        setThread(data)
      }
      localSeq.current += 1
      const optimistic: ChatMessage = {
        id: `local-${localSeq.current}`,
        role: 'user',
        content,
        createdAt: '',
      }
      setThread({ ...current, messages: [...current.messages, optimistic] })
      const { data } = await proxyClient.post<{ thread: Thread }>(
        `/assistant/threads/${current.id}/messages`,
        {
          content,
          pageContext: readPageContext(),
          ...(extras?.sheet ? { sheetContext: extras.sheet } : {}),
        },
        { timeout: 90_000 },
      )
      setThread(data.thread)
      loadedId.current = data.thread.id
      const nav = data.thread.messages
        .filter((message) => message.role === 'assistant')
        .at(-1)
        ?.parts?.navigations?.at(-1)
      if (nav?.href) go(nav.href)
      await loadThreads()
      return data.thread.id
    } catch (err) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message ?? 'The assistant could not reply.')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (card: ConfirmCard, messageId: string) => {
    if (!thread || busy) return
    const dismissKey = `${messageId}:${card.confirm_token}`
    setBusy(true)
    setError(null)
    setDismissed((prev) => ({ ...prev, [dismissKey]: true }))
    try {
      const { data } = await proxyClient.post<{ thread: Thread; result?: unknown }>(
        `/assistant/threads/${thread.id}/confirm`,
        { tool: card.tool, args: card.args, confirmToken: card.confirm_token },
      )
      setThread(data.thread)
      const href = hrefAfterImport(card.tool, card.args, data.result, data.thread.currentEventId)
      if (href) go(href)
      notifyEventRefresh()
      router.refresh()
      await loadThreads()
    } catch {
      setDismissed((prev) => {
        const next = { ...prev }
        delete next[dismissKey]
        return next
      })
      setError("I couldn't finish that. Ask me to preview again.")
    } finally {
      setBusy(false)
    }
  }

  const newChat = () => {
    setError(null)
    loadedId.current = null
    setThread(null)
  }

  const removeThread = async (id: string, selectNext = true) => {
    await proxyClient.delete(`/assistant/threads/${id}`)
    const list = await loadThreads()
    if (thread?.id === id) {
      if (selectNext && list[0]) {
        await openThread(list[0].id)
        return list[0].id
      }
      loadedId.current = null
      setThread(null)
      return null
    }
    return thread?.id ?? null
  }

  const clearThread = () => {
    loadedId.current = null
    setThread(null)
  }

  return {
    configured,
    threads,
    thread,
    draft,
    setDraft,
    busy,
    error,
    dismissed,
    setDismissed,
    send,
    confirm,
    newChat,
    openThread,
    removeThread,
    clearThread,
    go,
  }
}
