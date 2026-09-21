import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { loadMe } from '@/lib/api.server'
import { OnboardingWizard } from './onboarding-wizard'
import { safeInternalPath } from '@/lib/safe-path'
import { BackendUnavailable } from '@/components/backend-unavailable'

export const metadata: Metadata = {
  title: 'Get Started',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ next?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams
  const nextPath = safeInternalPath(rawNext)
  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect('/sign-in')
  }

  const { user, unavailable } = await loadMe()
  if (unavailable) return <BackendUnavailable asPage />
  if (user?.onboardingCompletedAt) {
    redirect(nextPath ?? '/')
  }

  return (
    <OnboardingWizard
      defaultFirstName={clerkUser.firstName ?? ''}
      defaultLastName={clerkUser.lastName ?? ''}
      nextPath={nextPath}
    />
  )
}
