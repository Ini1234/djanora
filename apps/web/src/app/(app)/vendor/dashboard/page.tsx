import type { Metadata } from 'next'
import { getMe, getMyVendorProfile } from '@/lib/api.server'
import { VendorDashboardHome } from './vendor-dashboard-home'

export const metadata: Metadata = { title: 'Vendor Dashboard – Djanora' }

export default async function VendorDashboardPage() {
  const [user, profile] = await Promise.all([getMe(), getMyVendorProfile()])

  return (
    <VendorDashboardHome
      firstName={user?.firstName ?? 'there'}
      avatarUrl={user?.avatarUrl ?? null}
      profile={profile}
    />
  )
}
