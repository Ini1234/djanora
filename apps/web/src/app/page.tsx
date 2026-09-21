import { redirect } from 'next/navigation'
import { loadMe } from '@/lib/api.server'
import { LandingPage } from '@/components/marketing/landing-page'
import { AppShell } from '@/components/dashboard/app-shell'
import { DashboardHome } from './(app)/dashboard-home'
import { BackendUnavailable } from '@/components/backend-unavailable'

export default async function RootPage() {
  const { user, unavailable } = await loadMe()

  if (unavailable) return <BackendUnavailable asPage />
  if (!user) return <LandingPage />
  if (!user.onboardingCompletedAt) redirect('/onboarding')
  if (user.activeMode === 'vendor') redirect('/vendor/dashboard')

  return (
    <AppShell user={user}>
      <DashboardHome firstName={user.firstName ?? 'there'} />
    </AppShell>
  )
}
