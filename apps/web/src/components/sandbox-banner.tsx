import { headers } from 'next/headers'
import { isSandboxHost } from '@/lib/is-sandbox-host'

export async function SandboxBanner() {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (!isSandboxHost(host)) return null

  return (
    <div
      role="status"
      className="bg-gold-800 text-gold-50 z-[60] shrink-0 px-4 py-2 text-center text-sm font-medium"
    >
      Testing sandbox — you&apos;re just playing around. This is not the live product, and data here
      may be reset.
    </div>
  )
}
