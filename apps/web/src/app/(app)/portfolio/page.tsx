import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { loadMe, getMyPosts, getMyVendorProfile } from '@/lib/api.server'
import { BackendUnavailable } from '@/components/backend-unavailable'
import { PortfolioClient } from './portfolio-client'

export const metadata: Metadata = { title: 'Portfolio' }

export default async function PortfolioPage() {
  const { user, unavailable } = await loadMe()
  if (unavailable) return <BackendUnavailable />
  if (!user?.hasVendorProfile) redirect('/')

  const [posts, profile] = await Promise.all([getMyPosts(), getMyVendorProfile()])
  return (
    <PortfolioClient
      initialPosts={posts}
      initialExternalUrl={profile?.externalPortfolioUrl ?? null}
      initialExternalLabel={profile?.externalPortfolioLabel ?? null}
    />
  )
}
