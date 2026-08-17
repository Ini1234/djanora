'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Plus, Trash2, Unlink } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import {
  CEREMONY_PRESETS,
  EVENT_TYPE_LABELS,
  THEME_OPTIONS,
  TRIBE_OPTIONS,
} from '@/lib/event-type-labels'
import type { Event, EventJourneyStop, EventType, WeddingTheme } from '@/lib/api.types'

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function EventSubEventsSection({
  event,
  onEventChange,
}: {
  event: Event
  onEventChange: (next: Event) => void
}) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<EventType>('TRADITIONAL_WEDDING')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState(event.location ?? '')
  const [tribes, setTribes] = useState<string[]>(event.tribes)
  const [themes, setThemes] = useState<WeddingTheme[]>(event.themes)
  const [guestCount, setGuestCount] = useState('')
  const [budget, setBudget] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [standalone, setStandalone] = useState<Event[] | null>(null)

  const children = event.children ?? []
  const tree = event.treeBudget
  const isHost = event.viewer?.isHost === true
  const remaining = tree ? tree.pot - tree.envelopesTotal : event.totalBudget
  const overage = tree ? Math.max(0, tree.envelopesTotal - tree.pot) : 0
  const nextBudget = (() => {
    const dollars = Number(budget)
    if (!budget.trim() || Number.isNaN(dollars)) return 0
    return Math.round(dollars)
  })()
  const wouldExceed = tree != null && tree.pot > 0 && tree.envelopesTotal + nextBudget > tree.pot

  const attachable = useMemo(() => {
    if (!standalone) return []
    const taken = new Set(children.map((stop) => stop.id))
    return standalone.filter(
      (row) => row.viewer?.isHost && !row.parentId && row.id !== event.id && !taken.has(row.id),
    )
  }, [standalone, children, event.id])

  async function refresh(next?: Event) {
    if (next) {
      onEventChange(next)
    } else {
      const { data } = await proxyClient.get<Event>(`/events/${event.id}`)
      onEventChange(data)
    }
    router.refresh()
  }

  async function loadStandalone() {
    if (standalone) return
    const { data } = await proxyClient.get<Event[]>('/events')
    setStandalone(data)
  }

  async function addChild(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (tribes.length === 0) {
      setError('Pick at least one culture.')
      return
    }
    if (themes.length === 0) {
      setError('Pick at least one look.')
      return
    }
    setPending(true)
    try {
      const dollars = Number(budget)
      const guests = Number(guestCount)
      const { data } = await proxyClient.post<Event>(`/events/${event.id}/children`, {
        title: title.trim() || EVENT_TYPE_LABELS[eventType],
        eventType,
        tribes,
        themes,
        location: location.trim(),
        estimatedDate: date || null,
        guestCount: guestCount.trim() && !Number.isNaN(guests) ? guests : undefined,
        allocatedBudget: !budget.trim() || Number.isNaN(dollars) ? 0 : Math.round(dollars),
      })
      setTitle('')
      setDate('')
      setLocation(event.location ?? '')
      setTribes(event.tribes)
      setThemes(event.themes)
      setGuestCount('')
      setBudget('')
      setShowAdd(false)
      await refresh(data)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
        ?.message
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Could not add sub-event.'))
    } finally {
      setPending(false)
    }
  }

  async function attach(eventId: string) {
    setError('')
    try {
      const { data } = await proxyClient.post<Event>(`/events/${event.id}/children/attach`, {
        eventId,
      })
      await refresh(data)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(typeof msg === 'string' ? msg : 'Could not attach that event.')
    }
  }

  async function removeChild(stop: EventJourneyStop) {
    if (!confirm(`Remove “${stop.title}” from this event? It stays in My Events as its own event.`))
      return
    setError('')
    setActingId(stop.id)
    try {
      const { data } = await proxyClient.post<Event>(
        `/events/${event.id}/children/${stop.id}/detach`,
      )
      await refresh(data)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(typeof msg === 'string' ? msg : 'Could not remove that sub-event.')
    } finally {
      setActingId(null)
    }
  }

  async function deleteChild(stop: EventJourneyStop) {
    if (!confirm(`Delete “${stop.title}”? It will be removed from your events.`)) return
    setError('')
    setActingId(stop.id)
    try {
      await proxyClient.delete(`/events/${stop.id}`)
      await refresh()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(typeof msg === 'string' ? msg : 'Could not delete that event.')
    } finally {
      setActingId(null)
    }
  }

  if (event.parentId) return null
  if (!isHost && children.length === 0) return null

  return (
    <section
      className="mb-8 overflow-hidden rounded-2xl"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Sub-events
          </h2>
          {tree && (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Budget {money(tree.pot, event.currency)}
              {tree.envelopesTotal > 0
                ? ` · ${money(tree.envelopesTotal, event.currency)} assigned to sub-events`
                : ''}
              {overage > 0
                ? ` · ${money(overage, event.currency)} over this event's total`
                : remaining > 0
                  ? ` · ${money(remaining, event.currency)} left to assign`
                  : ''}
              {tree.spentTotal > 0 ? ` · ${money(tree.spentTotal, event.currency)} spent` : ''}
            </p>
          )}
        </div>
        {isHost && (
          <button
            type="button"
            onClick={() => {
              setShowAdd((v) => !v)
              void loadStandalone()
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
            style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {tree && (
          <>
            <div
              className={`h-1.5 overflow-hidden rounded-full ${overage > 0 ? 'mb-3' : 'mb-5'}`}
              style={{ background: 'color-mix(in srgb, var(--color-border) 80%, transparent)' }}
            >
              <div
                className="bg-gold-600 h-full rounded-full"
                style={{
                  width: `${tree.pot ? Math.min(100, (tree.envelopesTotal / tree.pot) * 100) : 0}%`,
                }}
              />
            </div>
            {overage > 0 && (
              <p className="mb-5 text-xs" style={{ color: 'var(--color-brand-primary)' }}>
                Sub-event budgets add up to more than this event&apos;s total. This event&apos;s
                budget is still the cap.
              </p>
            )}
          </>
        )}

        {children.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Optional. Add bride price, traditional, court, reception — or any sub-event inside this
            one.
          </p>
        ) : (
          <ol className="relative space-y-0">
            {children.map((stop: EventJourneyStop, index) => (
              <li key={stop.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      background: stop.isCompleted
                        ? 'var(--color-brand-primary)'
                        : 'var(--color-card)',
                      color: stop.isCompleted ? '#fff' : 'var(--color-text-primary)',
                      border: '1.5px solid var(--color-brand-primary)',
                    }}
                  >
                    {stop.isCompleted ? <Check size={12} /> : index + 1}
                  </span>
                  {index < children.length - 1 && (
                    <span
                      className="min-h-[28px] w-px flex-1"
                      style={{ background: 'var(--color-border)' }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-6">
                  <Link href={`/events/${stop.id}`} className="block min-w-0">
                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {stop.title}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {EVENT_TYPE_LABELS[stop.eventType] ?? stop.eventType}
                      {stop.location ? ` · ${stop.location}` : ''}
                      {stop.tribes?.length
                        ? ` · ${stop.tribes.map((tribe) => TRIBE_OPTIONS.find((opt) => opt.value === tribe)?.label ?? tribe).join(', ')}`
                        : ''}
                      {stop.estimatedDate
                        ? ` · ${new Date(stop.estimatedDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : ''}
                      {stop.allocatedBudget != null
                        ? ` · ${money(stop.allocatedBudget, event.currency)}`
                        : ''}
                    </p>
                  </Link>
                  {isHost && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actingId === stop.id}
                        onClick={() => void removeChild(stop)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                        style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <Unlink size={12} />
                        {actingId === stop.id ? 'Working…' : 'Remove'}
                      </button>
                      <button
                        type="button"
                        disabled={actingId === stop.id}
                        onClick={() => void deleteChild(stop)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
                        style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {showAdd && isHost && (
          <form
            onSubmit={(e) => void addChild(e)}
            className="mt-2 space-y-3 rounded-2xl border p-4"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Add a sub-event
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                A sub-event is a full event — its own type, name, location, culture, look, date,
                guests, and budget. Culture and look start from this event; change them if this part
                is different.
              </p>
            </div>
            <div>
              <p
                className="mb-1.5 text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Type
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CEREMONY_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setEventType(preset.value)
                      if (!title || CEREMONY_PRESETS.some((p) => p.label === title))
                        setTitle(preset.label)
                    }}
                    className="rounded-full border px-2.5 py-1 text-xs"
                    style={{
                      borderColor:
                        eventType === preset.value
                          ? 'var(--color-brand-primary)'
                          : 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Name
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bride price in Lagos"
                required
                className="mt-1 h-10 w-full rounded-xl border bg-transparent px-3 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </label>
            <label className="block">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Location
              </span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, venue, or address"
                required
                className="mt-1 h-10 w-full rounded-xl border bg-transparent px-3 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </label>
            <div>
              <p
                className="mb-1.5 text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Culture
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TRIBE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTribes((current) => toggleValue(current, opt.value))}
                    className="rounded-full border px-2.5 py-1 text-xs"
                    style={{
                      borderColor: tribes.includes(opt.value)
                        ? 'var(--color-brand-primary)'
                        : 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p
                className="mb-1.5 text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Look
              </p>
              <div className="flex flex-wrap gap-1.5">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setThemes((current) => toggleValue(current, opt.value))}
                    className="rounded-full border px-2.5 py-1 text-xs"
                    style={{
                      borderColor: themes.includes(opt.value)
                        ? 'var(--color-brand-primary)'
                        : 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Date <span style={{ color: 'var(--color-muted)' }}>(optional)</span>
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border bg-transparent px-3 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </label>
              <label className="block">
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Guests <span style={{ color: 'var(--color-muted)' }}>(optional)</span>
                </span>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  placeholder="200"
                  className="mt-1 h-10 w-full rounded-xl border bg-transparent px-3 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </label>
            </div>
            <label className="block">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Budget <span style={{ color: 'var(--color-muted)' }}>(optional)</span>
              </span>
              <input
                type="number"
                min={0}
                step="100"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
                className="mt-1 h-10 w-full rounded-xl border bg-transparent px-3 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </label>
            <p
              className="text-xs"
              style={{ color: wouldExceed ? 'var(--color-brand-primary)' : 'var(--color-muted)' }}
            >
              {wouldExceed
                ? "This would put sub-event budgets over this event's total. You can still add it — this event's budget is still the cap."
                : remaining > 0
                  ? `Budget is how much you plan for this sub-event. ${money(remaining, event.currency)} left to assign under this event's total.`
                  : event.totalBudget > 0
                    ? "This event's budget is still the cap, even if sub-event budgets add up to more."
                    : 'Set a total budget on this event first if you want a cap to plan against.'}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
            >
              {pending ? 'Adding…' : 'Add sub-event'}
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {isHost && attachable.length > 0 && (
          <div className="mt-5">
            <h3
              className="mb-2 text-xs font-medium tracking-wide uppercase"
              style={{ color: 'var(--color-muted)' }}
            >
              Attach an existing event
            </h3>
            <div className="space-y-2">
              {attachable.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void attach(row.id)}
                  className="w-full rounded-xl border px-3 py-2 text-left text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  {row.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
