import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { currentUser } from '@clerk/nextjs/server'
import { publicGet } from '@/lib/backend'
import { getMe } from '@/lib/api.server'
import { AppShell } from '@/components/dashboard/app-shell'
import { JoinInviteActions } from './join-invite-actions'
import type { EventSurface, UserMe } from '@/lib/api.types'

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

const ROLE_LABELS: Record<string, string> = {
  EDITOR: 'Editor',
  COMMENTER: 'Commenter',
  VIEWER: 'Viewer',
}

const SURFACE_LABELS: Record<EventSurface, string> = {
  SCHEDULE: 'Schedule',
  CHECKLIST: 'Checklist',
  BUDGET: 'Budget',
  MOODBOARD: 'Mood board',
  VENDORS: 'Vendors',
  GUESTS: 'Guests',
}

type InvitePreview =
  | {
      accepted: false
      event: { title: string; eventType: string; estimatedDate: string | null }
      invitedBy: { firstName: string | null; lastName: string | null }
      role: string
      surfaces: EventSurface[]
    }
  | { accepted: true; event: { title: string } }

async function getInvite(token: string): Promise<InvitePreview | null> {
  return publicGet<InvitePreview>(`/event-invites/${token}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const data = await getInvite(token)
  return {
    title: data ? `Join · ${data.event.title}` : 'Join event',
    robots: { index: false, follow: false },
  }
}

function InviteNotFound({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Invite not found
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        This invite link may have expired or is invalid.
      </p>
      <Link
        href={signedIn ? '/events' : '/'}
        className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
        style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
      >
        {signedIn ? 'Back to events' : 'Go home'}
      </Link>
    </div>
  )
}

function InviteCard({
  data,
  token,
  signedIn,
}: {
  data: InvitePreview
  token: string
  signedIn: boolean
}) {
  const hostName = data.accepted
    ? 'Someone'
    : [data.invitedBy.firstName, data.invitedBy.lastName].filter(Boolean).join(' ') || 'Someone'
  const eventDate =
    !data.accepted && data.event.estimatedDate
      ? new Date(data.event.estimatedDate).toLocaleDateString('en-CA', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div
        className="overflow-hidden rounded-3xl border"
        style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <div className="bg-brand-900 dark:bg-brand-800 px-6 pt-8 pb-6">
          <p className="text-gold-500 mb-2 text-xs font-medium tracking-[2px] uppercase">
            You&apos;re invited to plan
          </p>
          <h1 className="font-display text-2xl leading-tight font-bold text-white">
            {data.event.title}
          </h1>
          {!data.accepted && (
            <p className="text-brand-400 mt-1 text-sm">
              {EVENT_TYPE_LABELS[data.event.eventType] ?? data.event.eventType}
            </p>
          )}
          {eventDate && (
            <div className="text-brand-300 mt-4 flex items-center gap-2 text-sm">
              <CalendarDays size={13} className="text-gold-500 shrink-0" />
              {eventDate}
            </div>
          )}
        </div>

        <div className="space-y-4 px-6 py-6">
          {data.accepted ? (
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              This invite was already accepted. Sign in with the same email to open the event.
            </p>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                <span className="font-semibold">{hostName}</span> invited you as a{' '}
                {ROLE_LABELS[data.role] ?? data.role.toLowerCase()}.
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                You&apos;ll be able to see{' '}
                {data.surfaces.map((s) => SURFACE_LABELS[s] ?? s).join(', ')}.
              </p>
            </>
          )}
          <JoinInviteActions token={token} signedIn={signedIn} />
        </div>
      </div>
      {!signedIn && (
        <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
          Powered by Djanora · Event Planning
        </p>
      )}
    </div>
  )
}

function withShell(user: UserMe | null, children: ReactNode) {
  if (user?.onboardingCompletedAt) {
    return <AppShell user={user}>{children}</AppShell>
  }
  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      {children}
    </div>
  )
}

export default async function JoinEventPage({ params }: Props) {
  const { token } = await params
  const [data, clerkUser, me] = await Promise.all([getInvite(token), currentUser(), getMe()])
  const signedIn = Boolean(clerkUser || me)

  if (!data) {
    return withShell(me, <InviteNotFound signedIn={signedIn} />)
  }

  return withShell(me, <InviteCard data={data} token={token} signedIn={signedIn} />)
}
