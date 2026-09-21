import { redirect } from 'next/navigation'
import { loadMe } from '@/lib/api.server'
import { AppShell } from '@/components/dashboard/app-shell'
import { BackendUnavailable } from '@/components/backend-unavailable'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, unavailable } = await loadMe()

  if (unavailable) return <BackendUnavailable asPage />
  if (!user) redirect('/sign-in')

  if (!user.onboardingCompletedAt) {
    redirect('/onboarding')
  }

  return <AppShell user={user}>{children}</AppShell>
}
