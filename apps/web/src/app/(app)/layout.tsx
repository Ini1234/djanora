import { redirect } from 'next/navigation'
import { getMe } from '@/lib/api.server'
import { AppShell } from '@/components/dashboard/app-shell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getMe()

  if (!user) {
    redirect('/sign-in')
  }

  if (!user.onboardingCompletedAt) {
    redirect('/onboarding')
  }

  return <AppShell user={user}>{children}</AppShell>
}
