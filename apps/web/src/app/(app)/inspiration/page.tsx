import type { Metadata } from 'next'
import { InspirationClient } from './inspiration-client'

export const metadata: Metadata = { title: 'Inspiration' }

export default async function InspirationPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; item?: string }>
}) {
  const { tag, item } = await searchParams
  return <InspirationClient initialTag={tag} initialItemId={item} />
}
