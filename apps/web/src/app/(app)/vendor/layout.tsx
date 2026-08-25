import { redirect } from 'next/navigation'
import { getMe } from '@/lib/api.server'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe()

  if (!user) redirect('/sign-in')
  if (!user.onboardingCompletedAt) redirect('/onboarding')
  if (!user.hasVendorProfile) redirect('/onboarding')

  return <>{children}</>
}
