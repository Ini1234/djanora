'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, HelpCircle, Send, ChevronDown } from 'lucide-react'
import { backend } from '@/lib/backend'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

interface RsvpPageData {
  id: string
  rsvpStatus: string
  rsvpAt: string | null
  plusOneName: string | null
  dietaryNote: string | null
  guestMessage: string | null
  guest: {
    firstName: string
    lastName: string | null
    plusOneAllowed: boolean
  }
  event: {
    id: string
    title: string
    eventType: string
    estimatedDate: string | null
    location: string | null
  }
}

type RsvpChoice = 'ATTENDING' | 'DECLINED' | 'MAYBE'

export function RsvpForm({ token, data }: { token: string; data: RsvpPageData }) {
  const [isPending, startTransition] = useTransition()
  const [choice, setChoice] = useState<RsvpChoice | null>(
    data.rsvpAt ? (data.rsvpStatus as RsvpChoice) : null,
  )
  const [plusOneName, setPlusOneName] = useState(data.plusOneName ?? '')
  const [dietaryNote, setDietaryNote] = useState(data.dietaryNote ?? '')
  const [guestMessage, setGuestMessage] = useState(data.guestMessage ?? '')
  const [submitted, setSubmitted] = useState(!!data.rsvpAt)
  const [error, setError] = useState<string | null>(null)
  const [showExtras, setShowExtras] = useState(false)

  const guestName = [data.guest.firstName, data.guest.lastName].filter(Boolean).join(' ')
  const eventDate = data.event.estimatedDate
    ? new Date(data.event.estimatedDate).toLocaleDateString('en-CA', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  async function submit() {
    if (!choice) return
    setError(null)
    try {
      await backend.post(`/rsvp/${token}`, {
        status: choice,
        plusOneName: plusOneName.trim() || undefined,
        dietaryNote: dietaryNote.trim() || undefined,
        guestMessage: guestMessage.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit RSVP'))
    }
  }

  if (submitted && choice) {
    return (
      <div className="px-6 py-8 text-center">
        {choice === 'ATTENDING' && (
          <>
            <div className="border-success/30 bg-success/15 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border">
              <CheckCircle2 size={28} className="text-success" />
            </div>
            <h2 className="text-fg mb-2 text-xl font-semibold">You&apos;re confirmed! 🎉</h2>
            <p className="text-muted text-sm">
              We&apos;ve recorded your RSVP. We can&apos;t wait to celebrate with you
              {eventDate ? ` on ${eventDate}` : ''}.
            </p>
            {plusOneName && <p className="text-muted mt-2 text-xs">Plus one: {plusOneName}</p>}
          </>
        )}
        {choice === 'DECLINED' && (
          <>
            <div className="border-danger/30 bg-danger/15 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border">
              <XCircle size={28} className="text-danger" />
            </div>
            <h2 className="text-fg mb-2 text-xl font-semibold">RSVP received</h2>
            <p className="text-muted text-sm">
              We&apos;re sorry you can&apos;t make it. Thank you for letting us know.
            </p>
          </>
        )}
        {choice === 'MAYBE' && (
          <>
            <div className="border-warning/30 bg-warning/15 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border">
              <HelpCircle size={28} className="text-warning" />
            </div>
            <h2 className="text-fg mb-2 text-xl font-semibold">Got it!</h2>
            <p className="text-muted text-sm">
              We&apos;ve noted you might be able to join us. We hope to see you there!
            </p>
          </>
        )}

        <button
          onClick={() => setSubmitted(false)}
          className="text-muted hover:text-fg mt-6 text-xs underline"
        >
          Change my response
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-muted text-sm">
        Hi <strong className="text-fg">{guestName}</strong>, will you be joining us?
      </p>

      {/* RSVP buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setChoice('ATTENDING')}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border py-4 transition-all',
            choice === 'ATTENDING'
              ? 'border-success/40 bg-success/15 text-success'
              : 'text-muted hover:text-fg border-border bg-surface hover:border-border',
          )}
        >
          <CheckCircle2 size={20} />
          <span className="text-xs font-medium">Attending</span>
        </button>
        <button
          onClick={() => setChoice('MAYBE')}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border py-4 transition-all',
            choice === 'MAYBE'
              ? 'border-warning/40 bg-warning/15 text-warning'
              : 'text-muted hover:text-fg border-border bg-surface hover:border-border',
          )}
        >
          <HelpCircle size={20} />
          <span className="text-xs font-medium">Maybe</span>
        </button>
        <button
          onClick={() => setChoice('DECLINED')}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border py-4 transition-all',
            choice === 'DECLINED'
              ? 'border-danger/40 bg-danger/15 text-danger'
              : 'text-muted hover:text-fg border-border bg-surface hover:border-border',
          )}
        >
          <XCircle size={20} />
          <span className="text-xs font-medium">Declined</span>
        </button>
      </div>

      {/* Extras (attending only) */}
      {choice === 'ATTENDING' && (
        <div className="space-y-3">
          <button
            onClick={() => setShowExtras((v) => !v)}
            className="text-muted hover:text-fg flex items-center gap-1.5 text-xs transition-colors"
          >
            <ChevronDown
              size={13}
              className={cn('transition-transform', showExtras && 'rotate-180')}
            />
            {showExtras ? 'Hide details' : 'Add details (dietary, message…)'}
          </button>

          {showExtras && (
            <div className="space-y-3">
              {data.guest.plusOneAllowed && (
                <div>
                  <label className="text-muted mb-1.5 block text-xs">Plus one name</label>
                  <input
                    value={plusOneName}
                    onChange={(e) => setPlusOneName(e.target.value)}
                    placeholder="Guest's name"
                    className="placeholder:text-muted focus:border-primary border-border bg-input text-fg w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="text-muted mb-1.5 block text-xs">Dietary requirements</label>
                <input
                  value={dietaryNote}
                  onChange={(e) => setDietaryNote(e.target.value)}
                  placeholder="Vegetarian, halal, nut allergy…"
                  className="placeholder:text-muted focus:border-primary border-border bg-input text-fg w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted mb-1.5 block text-xs">Message to the planner</label>
                <textarea
                  value={guestMessage}
                  onChange={(e) => setGuestMessage(e.target.value)}
                  placeholder="Looking forward to celebrating with you…"
                  rows={3}
                  className="placeholder:text-muted focus:border-primary border-border bg-input text-fg w-full resize-none rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-danger text-xs">{error}</p>}

      <button
        onClick={() => startTransition(submit)}
        disabled={!choice || isPending}
        className="bg-primary/15 hover:bg-primary/25 border-primary/30 text-primary flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send size={14} />
        {isPending ? 'Submitting…' : 'Submit RSVP'}
      </button>
    </div>
  )
}
