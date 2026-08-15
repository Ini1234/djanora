import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getMe, getMyPosts, getMyVendorProfile } from '@/lib/api.server'
import { PortfolioClient } from './portfolio-client'

export const metadata: Metadata = { title: 'Portfolio' }

export default async function PortfolioPage() {
  const user = await getMe()
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
