import type { Metadata } from 'next'
import { CalendarDays, MapPin } from 'lucide-react'
import { publicGet } from '@/lib/backend'
import { RsvpForm } from './rsvp-form'

interface Props {
  params: Promise<{ token: string }>
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

interface InviteData {
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
    notes: string | null
  }
}

async function getInvite(token: string): Promise<InviteData | null> {
  return publicGet<InviteData>(`/rsvp/${token}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const data = await getInvite(token)
  return {
    title: data ? `RSVP · ${data.event.title}` : 'RSVP',
    description: data ? `You're invited to ${data.event.title}` : undefined,
  }
}

export default async function RsvpPage({ params }: Props) {
  const { token } = await params
  const data = await getInvite(token)

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--page-bg)' }}>
        <div className="max-w-sm w-full text-center">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-semibold text-white mb-2">Invite not found</h1>
          <p className="text-brand-400 text-sm">
            This invite link may have expired or is invalid.
          </p>
        </div>
      </div>
    )
  }

  const { event } = data
  const eventDate = event.estimatedDate
    ? new Date(event.estimatedDate).toLocaleDateString('en-CA', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--page-bg)' }}>
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl overflow-hidden border" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
          {/* Header band */}
          <div className="bg-brand-900 dark:bg-brand-800 px-6 pt-8 pb-6">
            <p className="text-xs uppercase tracking-[2px] text-gold-500 mb-2 font-medium">
              You're Invited
            </p>
            <h1 className="font-display text-2xl font-bold text-white leading-tight">
              {event.title}
            </h1>
            <p className="text-brand-400 text-sm mt-1">
              {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
            </p>

            <div className="mt-4 space-y-1.5">
              {eventDate && (
                <div className="flex items-center gap-2 text-brand-300 text-sm">
                  <CalendarDays size={13} className="text-gold-500 shrink-0" />
                  {eventDate}
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2 text-brand-300 text-sm">
                  <MapPin size={13} className="text-gold-500 shrink-0" />
                  {event.location}
                </div>
              )}
            </div>
          </div>

          {/* RSVP form */}
          <div className="px-6 py-6">
            <RsvpForm token={token} data={data} />
          </div>
        </div>

        <p className="text-center text-brand-600 text-xs mt-6">
          Powered by Djanora · Event Planning
        </p>
      </div>
    </div>
  )
}
