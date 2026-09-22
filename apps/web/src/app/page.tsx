import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { loadMe } from '@/lib/api.server'
import { LandingPage } from '@/components/marketing/landing-page'
import { AppShell } from '@/components/dashboard/app-shell'
import { DashboardHome } from './(app)/dashboard-home'
import { BackendUnavailable } from '@/components/backend-unavailable'
import { SITE_DESCRIPTION, noindexRobots, pageMeta } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const { user } = await loadMe()
  if (user) return { title: 'Home', robots: noindexRobots }
  return pageMeta({
    title: 'Plan Your Event',
    description: SITE_DESCRIPTION,
    path: '/',
  })
}

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
