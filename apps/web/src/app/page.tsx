import { redirect } from 'next/navigation'
import { getMe } from '@/lib/api.server'
import { LandingPage } from '@/components/marketing/landing-page'
import { AppShell } from '@/components/dashboard/app-shell'
import { DashboardHome } from './(app)/dashboard-home'

export default async function RootPage() {
  const user = await getMe()

  if (!user) return <LandingPage />
  if (!user.onboardingCompletedAt) redirect('/onboarding')
  if (user.activeMode === 'vendor') redirect('/vendor/dashboard')

  return (
    <AppShell user={user}>
      <DashboardHome firstName={user.firstName ?? 'there'} />
    </AppShell>
  )
}
