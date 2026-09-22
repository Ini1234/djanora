import { notFound } from 'next/navigation'
import { loadMe } from '@/lib/api.server'
import { BackendUnavailable } from '@/components/backend-unavailable'
import { AdminSubnav } from './admin-subnav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, unavailable } = await loadMe()
  if (unavailable) return <BackendUnavailable asPage />
  if (!user || user.role !== 'ADMIN') notFound()

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <AdminSubnav />
      {children}
    </div>
  )
}
