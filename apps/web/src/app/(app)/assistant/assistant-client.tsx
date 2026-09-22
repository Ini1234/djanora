'use client'

import { useSearchParams } from 'next/navigation'
import { DjanChatPanel } from '@/components/assistant/djan-chat-panel'
import { replaceShallowQuery } from '@/lib/shallow-query'

export function AssistantClient() {
  const search = useSearchParams()
  const eventFromUrl = search.get('event')?.trim() || undefined
  const threadFromUrl = search.get('thread')?.trim() || undefined

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
      <DjanChatPanel
        enabled
        layout="page"
        eventId={eventFromUrl}
        threadId={threadFromUrl}
        onThreadChange={(id) => replaceShallowQuery('/assistant', { thread: id })}
      />
    </div>
  )
}
