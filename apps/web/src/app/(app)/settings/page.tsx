import type { Metadata } from 'next'
import { loadMe } from '@/lib/api.server'
import { SettingsClient } from './settings-client'
import { BackendUnavailable } from '@/components/backend-unavailable'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const { user, unavailable } = await loadMe()
  if (unavailable) return <BackendUnavailable />
  if (!user) return null
  return <SettingsClient user={user} />
}
