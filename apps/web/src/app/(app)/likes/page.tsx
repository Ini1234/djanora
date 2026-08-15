import type { Metadata } from 'next'
import { LikesClient } from './likes-client'

export const metadata: Metadata = { title: 'Liked' }

export default function LikesPage() {
  return <LikesClient />
}
