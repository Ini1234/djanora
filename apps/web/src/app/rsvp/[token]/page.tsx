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
    robots: { index: false, follow: false },
  }
}

export default async function RsvpPage({ params }: Props) {
  const { token } = await params
  const data = await getInvite(token)

  if (!data) {
    return (
      <div className="bg-page flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="mb-4 text-4xl">🔗</p>
          <h1 className="text-fg mb-2 text-xl font-semibold">Invite not found</h1>
          <p className="text-muted text-sm">This invite link may have expired or is invalid.</p>
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
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-page flex min-h-screen items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="border-border bg-surface overflow-hidden rounded-3xl border">
          {/* Header band */}
          <div className="bg-inverse px-6 pt-8 pb-6">
            <p className="text-inverse-fg mb-2 text-xs font-medium tracking-[2px] uppercase">
              You&apos;re Invited
            </p>
            <h1 className="font-display text-inverse-fg text-2xl leading-tight font-bold">
              {event.title}
            </h1>
            <p className="text-inverse-muted mt-1 text-sm">
              {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
            </p>

            <div className="mt-4 space-y-1.5">
              {eventDate && (
                <div className="text-inverse-muted flex items-center gap-2 text-sm">
                  <CalendarDays size={13} className="text-inverse-fg shrink-0" />
                  {eventDate}
                </div>
              )}
              {event.location && (
                <div className="text-inverse-muted flex items-center gap-2 text-sm">
                  <MapPin size={13} className="text-inverse-fg shrink-0" />
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

        <p className="text-muted mt-6 text-center text-xs">Powered by Djanora · Event Planning</p>
      </div>
    </main>
  )
}
