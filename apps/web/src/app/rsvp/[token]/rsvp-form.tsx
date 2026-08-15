'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, HelpCircle, Send, ChevronDown } from 'lucide-react'
import { backend } from '@/lib/backend'
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

const EVENT_TYPE_LABELS: Record<string, string> = {
  WEDDING: 'Wedding',
  INTRODUCTION: 'Introduction Ceremony',
  TRADITIONAL_WEDDING: 'Traditional Wedding',
  WHITE_WEDDING: 'White Wedding',
  RECEPTION: 'Wedding Reception',
  ENGAGEMENT: 'Engagement Party',
  NAMING_CEREMONY: 'Naming Ceremony',
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
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to submit RSVP')
    }
  }

  if (submitted && choice) {
    return (
      <div className="text-center py-8 px-6">
        {choice === 'ATTENDING' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">You're confirmed! 🎉</h2>
            <p className="text-brand-300 text-sm">
              We've recorded your RSVP. We can't wait to celebrate with you{eventDate ? ` on ${eventDate}` : ''}.
            </p>
            {plusOneName && (
              <p className="text-brand-400 text-xs mt-2">Plus one: {plusOneName}</p>
            )}
          </>
        )}
        {choice === 'DECLINED' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <XCircle size={28} className="text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">RSVP received</h2>
            <p className="text-brand-300 text-sm">
              We're sorry you can't make it. Thank you for letting us know.
            </p>
          </>
        )}
        {choice === 'MAYBE' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <HelpCircle size={28} className="text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Got it!</h2>
            <p className="text-brand-300 text-sm">
              We've noted you might be able to join us. We hope to see you there!
            </p>
          </>
        )}

        <button
          onClick={() => setSubmitted(false)}
          className="mt-6 text-xs text-brand-500 hover:text-brand-300 underline"
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
            'flex flex-col items-center gap-2 py-4 rounded-xl border transition-all',
            choice === 'ATTENDING'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-white/4 border-white/10 text-brand-400 hover:border-white/20 hover:text-brand-200',
          )}
        >
          <CheckCircle2 size={20} />
          <span className="text-xs font-medium">Attending</span>
        </button>
        <button
          onClick={() => setChoice('MAYBE')}
          className={cn(
            'flex flex-col items-center gap-2 py-4 rounded-xl border transition-all',
            choice === 'MAYBE'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-white/4 border-white/10 text-brand-400 hover:border-white/20 hover:text-brand-200',
          )}
        >
          <HelpCircle size={20} />
          <span className="text-xs font-medium">Maybe</span>
        </button>
        <button
          onClick={() => setChoice('DECLINED')}
          className={cn(
            'flex flex-col items-center gap-2 py-4 rounded-xl border transition-all',
            choice === 'DECLINED'
              ? 'bg-red-500/15 border-red-500/40 text-red-300'
              : 'bg-white/4 border-white/10 text-brand-400 hover:border-white/20 hover:text-brand-200',
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
            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-200 transition-colors"
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
                  <label className="block text-xs text-brand-400 mb-1.5">Plus one name</label>
                  <input
                    value={plusOneName}
                    onChange={(e) => setPlusOneName(e.target.value)}
                    placeholder="Guest's name"
                    className="w-full text-sm bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-brand-400 mb-1.5">
                  Dietary requirements
                </label>
                <input
                  value={dietaryNote}
                  onChange={(e) => setDietaryNote(e.target.value)}
                  placeholder="Vegetarian, halal, nut allergy…"
                  className="w-full text-sm bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-400 mb-1.5">
                  Message to the couple
                </label>
                <textarea
                  value={guestMessage}
                  onChange={(e) => setGuestMessage(e.target.value)}
                  placeholder="Congratulations! We're so happy for you both…"
                  rows={3}
                  className="w-full text-sm bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-brand-500 focus:outline-none focus:border-gold-500/50 transition-colors resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={() => startTransition(submit)}
        disabled={!choice || isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold-600/15 hover:bg-gold-600/25 border border-gold-500/30 text-gold-300 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send size={14} />
        {isPending ? 'Submitting…' : 'Submit RSVP'}
      </button>
    </div>
  )
}
