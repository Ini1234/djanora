'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowLeft, History, Loader2, Maximize2, Plus, Send, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { DjanMark } from './djan-mark'
import {
  DJAN_STARTERS,
  useDjanChat,
  type ConfirmCard,
  type NavAction,
  type ThreadSummary,
} from './use-djan-chat'
import { isSafeAppHref } from './djan-nav'

type DjanChatPanelProps = {
  enabled?: boolean
  eventId?: string
  threadId?: string
  layout?: 'widget' | 'page'
  showClose?: boolean
  onClose?: () => void
  onThreadChange?: (id: string | null) => void
}

const iconBtn =
  'tap-target inline-flex h-10 w-10 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2'

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 86_400_000) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function DjanChatPanel({
  enabled = true,
  eventId,
  threadId,
  layout = 'widget',
  showClose = false,
  onClose,
  onThreadChange,
}: DjanChatPanelProps) {
  const isPage = layout === 'page'
  const {
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
  } = useDjanChat({ enabled, eventId, threadId, autoSelectLatest: !isPage })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [thread?.messages.length, busy])

  useEffect(() => {
    if (enabled) inputRef.current?.focus()
  }, [enabled, thread?.id])

  const eventLabel = thread?.currentEvent?.title
  const selected = Boolean(thread) || composing

  const selectThread = async (id: string) => {
    setComposing(false)
    await openThread(id)
    onThreadChange?.(id)
    setHistoryOpen(false)
  }

  const startNew = async () => {
    if (isPage) {
      clearThread()
      onThreadChange?.(null)
      setComposing(true)
      setHistoryOpen(false)
      return
    }
    const created = await newChat()
    onThreadChange?.(created.id)
    setHistoryOpen(false)
  }

  const deleteThread = async (id: string) => {
    const next = await removeThread(id, !isPage)
    onThreadChange?.(next)
  }

  const backToList = () => {
    setComposing(false)
    clearThread()
    onThreadChange?.(null)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void sendAndSync(draft)
  }

  const sendAndSync = async (text: string) => {
    const id = await send(text)
    if (id) {
      setComposing(false)
      onThreadChange?.(id)
    }
  }

  const conversation = (
    <>
      <header
        className="flex shrink-0 items-center gap-2 border-b px-3 py-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {isPage && (
          <button
            type="button"
            onClick={backToList}
            aria-label="Back to chats"
            className={`${iconBtn} md:hidden`}
            style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--ring)' }}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <DjanMark className="h-9 w-9 text-sm" />
        <div className="min-w-0 flex-1">
          <h2
            id="djan-dialog-title"
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {thread?.title || (isPage ? 'New chat' : 'Djan')}
          </h2>
          <p className="truncate text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            {eventLabel ? `Planning ${eventLabel}` : 'Ask about culture, cities, or your event'}
          </p>
        </div>
        {!isPage && (
          <>
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-label="Chat history"
              aria-expanded={historyOpen}
              className={iconBtn}
              style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--ring)' }}
            >
              <History size={16} />
            </button>
            <button
              type="button"
              onClick={() => void startNew()}
              aria-label="New chat"
              className={iconBtn}
              style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--ring)' }}
            >
              <Plus size={16} />
            </button>
          </>
        )}
        {showClose && thread && (
          <Link
            href={`/assistant?thread=${thread.id}`}
            onClick={onClose}
            aria-label="Open full chat"
            className={iconBtn}
            style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--ring)' }}
          >
            <Maximize2 size={16} />
          </Link>
        )}
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Djan"
            className={iconBtn}
            style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--ring)' }}
          >
            <X size={16} />
          </button>
        )}
      </header>

      {!isPage && historyOpen && (
        <ThreadList
          threads={threads}
          activeId={thread?.id}
          compact
          onSelect={(id) => void selectThread(id)}
          onDelete={(id) => void deleteThread(id)}
        />
      )}

      {configured === false && (
        <p
          className="px-4 py-2 text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
          role="status"
        >
          Azure chat is not configured on this server. Culture packs still load; replies need a chat
          deployment.
        </p>
      )}

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {thread && thread.messages.length > 0 ? (
          <div className="space-y-3">
            {thread.messages.map((message) =>
              message.role === 'user' ? (
                <article key={message.id} className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-sm leading-5"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </article>
              ) : (
                <article key={message.id} className="flex items-start gap-2">
                  <DjanMark className="mt-0.5 h-7 w-7 text-[10px]" />
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tl-md px-3 py-2 text-sm leading-5"
                    style={{
                      background: 'color-mix(in srgb, var(--foreground) 8%, var(--color-card))',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.parts?.citations && message.parts.citations.length > 0 && (
                      <ul
                        className="mt-2 space-y-1 text-[11px]"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {message.parts.citations.map((cite) => (
                          <li key={`${cite.kind}:${cite.title}`}>
                            {cite.title} · {cite.source}
                          </li>
                        ))}
                      </ul>
                    )}
                    {message.parts?.navigations
                      ?.filter((nav) => isSafeAppHref(nav.href))
                      .map((nav) => (
                        <NavLink key={nav.href} nav={nav} onOpen={go} />
                      ))}
                    {message.parts?.confirms
                      ?.filter((card) => !dismissed[`${message.id}:${card.confirm_token}`])
                      .map((card) => (
                        <ConfirmActions
                          key={card.confirm_token}
                          card={card}
                          busy={busy}
                          onConfirm={() => void confirm(card, message.id)}
                          onCancel={() =>
                            setDismissed((prev) => ({
                              ...prev,
                              [`${message.id}:${card.confirm_token}`]: true,
                            }))
                          }
                        />
                      ))}
                  </div>
                </article>
              ),
            )}
            {busy && (
              <p
                className="flex items-center gap-2 pl-9 text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
                role="status"
                aria-live="polite"
              >
                <Loader2 size={12} className="animate-spin" /> Djan is typing…
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col justify-end gap-3">
            <div className="flex gap-2">
              <DjanMark className="h-8 w-8 text-xs" />
              <div
                className="rounded-2xl rounded-tl-md px-3 py-2 text-sm leading-5"
                style={{
                  background: 'color-mix(in srgb, var(--foreground) 8%, var(--color-card))',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Hi — I&apos;m Djan. Ask about a culture or city, or tell me what to change in
                Djanora. Anything irreversible waits for a confirm tap.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-10">
              {DJAN_STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void sendAndSync(starter)}
                  className="min-h-10 rounded-full px-3 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    outlineColor: 'var(--ring)',
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t px-3 py-3"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
      >
        {error && (
          <p className="mb-2 text-xs" style={{ color: 'var(--destructive)' }} role="alert">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="djan-draft">
            Message Djan
          </label>
          <textarea
            ref={inputRef}
            id="djan-draft"
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendAndSync(draft)
              }
            }}
            placeholder="Message Djan…"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl px-3 py-2.5 text-sm placeholder:text-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: 'color-mix(in srgb, var(--foreground) 6%, var(--color-card))',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              outlineColor: 'var(--ring)',
            }}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send message"
            className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              outlineColor: 'var(--ring)',
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </>
  )

  if (!isPage) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" style={{ background: 'var(--color-card)' }}>
        {conversation}
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden"
      style={{ background: 'var(--color-card)' }}
    >
      <aside
        className={`flex shrink-0 flex-col overflow-hidden border-r ${
          selected ? 'hidden md:flex md:w-72 lg:w-80' : 'flex w-full md:w-72 lg:w-80'
        }`}
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
      >
        <div
          className="flex shrink-0 items-center gap-2 border-b px-3 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <DjanMark className="h-8 w-8 text-xs" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Djan
            </h1>
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Previous chats
            </p>
          </div>
          <button
            type="button"
            onClick={() => void startNew()}
            aria-label="New chat"
            className={iconBtn}
            style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--ring)' }}
          >
            <Plus size={16} />
          </button>
        </div>
        <ThreadList
          threads={threads}
          activeId={thread?.id}
          onSelect={(id) => void selectThread(id)}
          onDelete={(id) => void deleteThread(id)}
        />
      </aside>

      <div
        className={`min-w-0 flex-1 flex-col overflow-hidden ${selected ? 'flex' : 'hidden md:flex'}`}
      >
        {conversation}
      </div>
    </div>
  )
}

function ThreadList({
  threads,
  activeId,
  compact = false,
  onSelect,
  onDelete,
}: {
  threads: ThreadSummary[]
  activeId?: string
  compact?: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <nav
      className={
        compact
          ? 'max-h-40 shrink-0 overflow-y-auto border-b px-2 py-2'
          : 'min-h-0 flex-1 overflow-y-auto px-2 py-2'
      }
      style={{
        borderColor: 'var(--color-border)',
        background: compact ? 'var(--page-bg)' : 'var(--color-card)',
      }}
      aria-label="Previous chats"
    >
      {threads.length === 0 && (
        <p className="px-2 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          No chats yet. Start one and it will show up here.
        </p>
      )}
      <div className="space-y-0.5">
        {threads.map((item) => {
          const active = activeId === item.id
          return (
            <div key={item.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: active
                    ? 'color-mix(in srgb, var(--primary) 14%, var(--color-card))'
                    : 'transparent',
                  color: 'var(--color-text-primary)',
                  outlineColor: 'var(--ring)',
                }}
              >
                <span className="block truncate text-sm">{item.title || 'New chat'}</span>
                <span
                  className="mt-0.5 flex items-center gap-2 text-[11px]"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span>{formatWhen(item.updatedAt)}</span>
                  {item.currentEvent?.title && (
                    <span className="truncate">{item.currentEvent.title}</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.title || 'chat'}`}
                onClick={() => onDelete(item.id)}
                className={iconBtn}
                style={{ color: 'var(--color-text-secondary)', outlineColor: 'var(--ring)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

function NavLink({ nav, onOpen }: { nav: NavAction; onOpen: (href: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(nav.href)}
      className="mt-2 inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: 'var(--primary)',
        color: 'var(--primary-foreground)',
        outlineColor: 'var(--ring)',
      }}
    >
      Open {nav.label}
    </button>
  )
}

function ConfirmActions({
  card,
  busy,
  onConfirm,
  onCancel,
}: {
  card: ConfirmCard
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
      <p className="font-medium">{card.summary}</p>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {card.blast_radius}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="h-10 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            outlineColor: 'var(--ring)',
          }}
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            outlineColor: 'var(--ring)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
