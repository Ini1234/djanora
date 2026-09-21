import { redirect } from 'next/navigation'
import { loadMe } from '@/lib/api.server'
import { BackendUnavailable } from '@/components/backend-unavailable'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, unavailable } = await loadMe()

  if (unavailable) return <BackendUnavailable />
  if (!user) redirect('/sign-in')
  if (!user.onboardingCompletedAt) redirect('/onboarding')
  if (!user.hasVendorProfile) redirect('/onboarding')

  return <>{children}</>
}
