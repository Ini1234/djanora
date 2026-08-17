import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useSse, type SseEvent } from '@/contexts/sse-context'

export interface InboxPreview {
  id?: string
  message: string
  createdAt: string
}

export interface InboxRow {
  id: string
  status: string
  messages?: InboxPreview[]
}

const INBOX_EVENTS = new Set(['new_message', 'message_updated', 'message_unsent', 'inquiry_status'])

function moveToFront<T extends InboxRow>(list: T[], id: string): T[] {
  const index = list.findIndex((row) => row.id === id)
  if (index <= 0) return list
  const next = [...list]
  const [row] = next.splice(index, 1)
  next.unshift(row)
  return next
}

export function applyInboxSseEvent<T extends InboxRow>(list: T[], event: SseEvent): T[] | null {
  const inquiryId = event.inquiryId
  if (!inquiryId) return list

  const index = list.findIndex((row) => row.id === inquiryId)
  if (index < 0) {
    if (event.type === 'new_message' || event.type === 'inquiry_status') return null
    return list
  }

  const current = list[index]

  if (event.type === 'inquiry_status' && event.status && current.status !== event.status) {
    const next = [...list]
    next[index] = { ...current, status: event.status }
    return next
  }

  if (event.type === 'new_message' && event.message) {
    const preview: InboxPreview = {
      id: event.message.id,
      message: event.message.unsentAt ? '' : event.message.message,
      createdAt: event.message.createdAt,
    }
    const next = [...list]
    next[index] = { ...current, messages: [preview] }
    return moveToFront(next, inquiryId)
  }

  if (event.type === 'message_updated' && event.message) {
    const last = current.messages?.[0]
    if (last?.id && last.id !== event.message.id) return list
    const preview: InboxPreview = {
      id: event.message.id,
      message: event.message.unsentAt ? '' : event.message.message,
      createdAt: event.message.createdAt,
    }
    const next = [...list]
    next[index] = { ...current, messages: [preview] }
    return next
  }

  if (event.type === 'message_unsent' && event.unsent) {
    const last = current.messages?.[0]
    if (last?.id && last.id !== event.unsent.messageId) return list
    if (!last?.id && last) return list
    const next = [...list]
    next[index] = {
      ...current,
      messages: [
        {
          ...last,
          id: event.unsent.messageId,
          message: '',
          createdAt: last?.createdAt ?? event.unsent.unsentAt,
        },
      ],
    }
    return next
  }

  return list
}

/** Patch the inbox query from SSE. Unknown threads invalidate once instead of GET-on-every-event. */
export function useInboxSse(queryKey: QueryKey) {
  const queryClient = useQueryClient()
  const { on } = useSse()

  useEffect(() => {
    return on((event) => {
      if (!INBOX_EVENTS.has(event.type)) return

      let miss = false
      queryClient.setQueryData<InboxRow[]>(queryKey, (current) => {
        if (!current) {
          miss = event.type === 'new_message' || event.type === 'inquiry_status'
          return current
        }
        const next = applyInboxSseEvent(current, event)
        if (next === null) {
          miss = true
          return current
        }
        return next
      })

      if (miss) {
        void queryClient.invalidateQueries({ queryKey })
      }
    })
  }, [on, queryClient, queryKey])
}
