'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Circle, Pencil, Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import type { Event, UserChecklist } from '@/lib/api.types'

function dueLabel(dateStr: string | null) {
  if (!dateStr) return null
  const start = new Date(new Date().toDateString()).getTime()
  const days = Math.round((new Date(dateStr).getTime() - start) / 86_400_000)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function toDateInput(value: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

export function PersonalChecklist({ events }: { events: Event[] }) {
  const t = useTranslations('dashboard')
  const [items, setItems] = useState<UserChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    proxyClient
      .get<UserChecklist[]>('/users/me/checklists')
      .then(({ data }) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function createItem(input: { title: string; dueDate: string; eventId: string }) {
    const { data } = await proxyClient.post<UserChecklist>('/users/me/checklists', {
      title: input.title,
      dueDate: input.dueDate,
      eventId: input.eventId || null,
    })
    setItems((prev) => [...prev, data].sort(byDue))
    setCreating(false)
  }

  async function saveItem(item: UserChecklist, input: { title: string; dueDate: string; eventId: string }) {
    const { data } = await proxyClient.patch<UserChecklist>(`/users/me/checklists/${item.id}`, {
      title: input.title,
      dueDate: input.dueDate,
      eventId: input.eventId || null,
    })
    setItems((prev) => prev.map((row) => (row.id === item.id ? data : row)).sort(byDue))
    setEditingId(null)
  }

  async function toggle(item: UserChecklist) {
    if (pendingIds.has(item.id)) return
    const next = !item.isCompleted
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isCompleted: next } : row)))
    setPendingIds((prev) => new Set(prev).add(item.id))
    try {
      if (item.source === 'ASSIGNED' && item.eventId) {
        await proxyClient.patch(`/events/${item.eventId}/checklist/${item.id}`, { isCompleted: next })
      } else {
        await proxyClient.patch(`/users/me/checklists/${item.id}`, { isCompleted: next })
      }
    } catch {
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isCompleted: item.isCompleted } : row)))
    } finally {
      setPendingIds((prev) => {
        const ids = new Set(prev)
        ids.delete(item.id)
        return ids
      })
    }
  }

  async function remove(item: UserChecklist) {
    if (pendingIds.has(item.id)) return
    const snapshot = items
    setItems((prev) => prev.filter((row) => row.id !== item.id))
    if (editingId === item.id) setEditingId(null)
    setPendingIds((prev) => new Set(prev).add(item.id))
    try {
      await proxyClient.delete(`/users/me/checklists/${item.id}`)
    } catch {
      setItems(snapshot)
    } finally {
      setPendingIds((prev) => {
        const ids = new Set(prev)
        ids.delete(item.id)
        return ids
      })
    }
  }

  if (loading) return null

  const open = items.filter((item) => !item.isCompleted)
  const done = items.filter((item) => item.isCompleted)

  return (
    <section>
      <ul>
        {[...open, ...done].map((item) => (
          <li key={item.id} className="py-2">
            {editingId === item.id ? (
              <ChecklistFields
                events={events}
                initialTitle={item.title}
                initialDueDate={toDateInput(item.dueDate)}
                initialEventId={item.eventId ?? ''}
                submitLabel={t.has('saveChecklist') ? t('saveChecklist') : 'Save'}
                onCancel={() => setEditingId(null)}
                onSubmit={(input) => saveItem(item, input)}
              />
            ) : (
              <ChecklistRow
                item={item}
                pending={pendingIds.has(item.id)}
                onToggle={() => void toggle(item)}
                onEdit={item.source === 'ASSIGNED' ? undefined : () => {
                  setCreating(false)
                  setEditingId(item.id)
                }}
                onRemove={item.source === 'ASSIGNED' ? undefined : () => void remove(item)}
              />
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="mt-3">
          <ChecklistFields
            events={events}
            submitLabel={t.has('personalAdd') ? t('personalAdd') : 'Add'}
            onCancel={() => setCreating(false)}
            onSubmit={createItem}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setCreating(true)
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-foreground)' }}
        >
          <Plus size={14} />
          {t.has('addChecklist') ? t('addChecklist') : 'Add checklist'}
        </button>
      )}
    </section>
  )
}

function byDue(a: UserChecklist, b: UserChecklist) {
  if (!a.dueDate && !b.dueDate) return 0
  if (!a.dueDate) return 1
  if (!b.dueDate) return -1
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
}

function ChecklistFields({
  events,
  initialTitle = '',
  initialDueDate = '',
  initialEventId = '',
  submitLabel,
  onCancel,
  onSubmit,
}: {
  events: Event[]
  initialTitle?: string
  initialDueDate?: string
  initialEventId?: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: { title: string; dueDate: string; eventId: string }) => Promise<void>
}) {
  const t = useTranslations('dashboard')
  const [title, setTitle] = useState(initialTitle)
  const [dueDate, setDueDate] = useState(initialDueDate)
  const [eventId, setEventId] = useState(initialEventId)
  const [saving, setSaving] = useState(false)

  async function submit() {
    const name = title.trim()
    if (!name || !dueDate || saving) return
    setSaving(true)
    try {
      await onSubmit({ title: name, dueDate, eventId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
        placeholder={t.has('checklistName') ? t('checklistName') : 'What needs doing?'}
        maxLength={200}
        className="w-full bg-transparent text-sm outline-none"
        style={{ color: 'var(--color-foreground)' }}
      />
      <label className="block text-xs" style={{ color: 'var(--color-muted)' }}>
        {t.has('dueDate') ? t('dueDate') : 'Due date'}
        <input
          type="date"
          required
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="mt-1 block w-full bg-transparent text-sm outline-none"
          style={{ color: 'var(--color-foreground)' }}
        />
      </label>
      <label className="block text-xs" style={{ color: 'var(--color-muted)' }}>
        {t.has('linkToEvent') ? t('linkToEvent') : 'Link to an event'}
        <select
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          className="mt-1 block w-full bg-transparent text-sm outline-none"
          style={{ color: 'var(--color-foreground)' }}
        >
          <option value="">{t.has('notLinked') ? t('notLinked') : 'Not linked'}</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !title.trim() || !dueDate}
          className="text-sm font-semibold disabled:opacity-40"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function ChecklistRow({
  item,
  pending,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: UserChecklist
  pending: boolean
  onToggle: () => void
  onEdit?: () => void
  onRemove?: () => void
}) {
  const due = dueLabel(item.dueDate)
  const overdue = due === 'Overdue'

  return (
    <div className="group flex items-start gap-2.5">
      <button
        type="button"
        disabled={pending}
        onClick={onToggle}
        className="mt-0.5 shrink-0 disabled:opacity-40"
        aria-label={item.isCompleted ? `Mark “${item.title}” incomplete` : `Mark “${item.title}” complete`}
      >
        {item.isCompleted ? (
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full"
            style={{ background: 'color-mix(in srgb, var(--color-brand-primary) 18%, transparent)' }}
          >
            <Check size={10} strokeWidth={2.5} style={{ color: 'var(--color-brand-primary)' }} />
          </span>
        ) : (
          <Circle size={16} style={{ color: 'var(--color-muted)' }} />
        )}
      </button>
      <button type="button" onClick={onEdit} disabled={!onEdit} className="min-w-0 flex-1 text-left">
        <p
          className="text-sm font-medium"
          style={{
            color: item.isCompleted ? 'var(--color-muted)' : 'var(--color-foreground)',
            textDecoration: item.isCompleted ? 'line-through' : 'none',
          }}
        >
          {item.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: overdue && !item.isCompleted ? '#b91c1c' : 'var(--color-muted)' }}>
          {[due, item.event?.title, item.source === 'ASSIGNED' ? 'Assigned to you' : null].filter(Boolean).join(' · ')}
        </p>
      </button>
      {item.event && (
        <Link
          href={`/events/${item.event.id}?tab=checklist`}
          className="text-xs shrink-0 mt-0.5 hover:opacity-70"
          style={{ color: 'var(--color-muted)' }}
        >
          View
        </Link>
      )}
      {onEdit && (
      <button
        type="button"
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 mt-0.5"
        style={{ color: 'var(--color-muted)' }}
        aria-label={`Edit “${item.title}”`}
      >
        <Pencil size={12} />
      </button>
      )}
      {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 mt-0.5"
        style={{ color: 'var(--color-muted)' }}
        aria-label={`Remove “${item.title}”`}
      >
        <X size={12} />
      </button>
      )}
    </div>
  )
}
