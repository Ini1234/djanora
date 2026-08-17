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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">You&apos;re confirmed! 🎉</h2>
            <p className="text-brand-300 text-sm">
              We&apos;ve recorded your RSVP. We can&apos;t wait to celebrate with you
              {eventDate ? ` on ${eventDate}` : ''}.
            </p>
            {plusOneName && <p className="text-brand-400 mt-2 text-xs">Plus one: {plusOneName}</p>}
          </>
        )}
        {choice === 'DECLINED' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15">
              <XCircle size={28} className="text-red-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">RSVP received</h2>
            <p className="text-brand-300 text-sm">
              We&apos;re sorry you can&apos;t make it. Thank you for letting us know.
            </p>
          </>
        )}
        {choice === 'MAYBE' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15">
              <HelpCircle size={28} className="text-amber-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">Got it!</h2>
            <p className="text-brand-300 text-sm">
              We&apos;ve noted you might be able to join us. We hope to see you there!
            </p>
          </>
        )}

        <button
          onClick={() => setSubmitted(false)}
          className="text-brand-500 hover:text-brand-300 mt-6 text-xs underline"
        >
          Change my response
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-brand-300 text-sm">
        Hi <strong className="text-white">{guestName}</strong>, will you be joining us?
      </p>

      {/* RSVP buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setChoice('ATTENDING')}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border py-4 transition-all',
            choice === 'ATTENDING'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'text-brand-400 hover:text-brand-200 border-white/10 bg-white/4 hover:border-white/20',
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
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
              : 'text-brand-400 hover:text-brand-200 border-white/10 bg-white/4 hover:border-white/20',
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
              ? 'border-red-500/40 bg-red-500/15 text-red-300'
              : 'text-brand-400 hover:text-brand-200 border-white/10 bg-white/4 hover:border-white/20',
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
            className="text-brand-400 hover:text-brand-200 flex items-center gap-1.5 text-xs transition-colors"
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
                  <label className="text-brand-400 mb-1.5 block text-xs">Plus one name</label>
                  <input
                    value={plusOneName}
                    onChange={(e) => setPlusOneName(e.target.value)}
                    placeholder="Guest's name"
                    className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white transition-colors focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="text-brand-400 mb-1.5 block text-xs">Dietary requirements</label>
                <input
                  value={dietaryNote}
                  onChange={(e) => setDietaryNote(e.target.value)}
                  placeholder="Vegetarian, halal, nut allergy…"
                  className="placeholder:text-brand-500 focus:border-gold-500/50 w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white transition-colors focus:outline-none"
                />
              </div>
              <div>
                <label className="text-brand-400 mb-1.5 block text-xs">
                  Message to the planner
                </label>
                <textarea
                  value={guestMessage}
                  onChange={(e) => setGuestMessage(e.target.value)}
                  placeholder="Looking forward to celebrating with you…"
                  rows={3}
                  className="placeholder:text-brand-500 focus:border-gold-500/50 w-full resize-none rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white transition-colors focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={() => startTransition(submit)}
        disabled={!choice || isPending}
        className="bg-gold-600/15 hover:bg-gold-600/25 border-gold-500/30 text-gold-300 flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send size={14} />
        {isPending ? 'Submitting…' : 'Submit RSVP'}
      </button>
    </div>
  )
}
