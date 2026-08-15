import type { Metadata } from 'next'
import { getMe } from '@/lib/api.server'
import { SettingsClient } from './settings-client'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const user = await getMe()
  if (!user) return null
  return <SettingsClient user={user} />
}
