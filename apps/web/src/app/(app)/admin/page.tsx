import { getTranslations } from 'next-intl/server'
import { serverFetch } from '@/lib/api.server'
import type { AdminVendorList } from '@/lib/admin.types'
import { AdminVendorTable } from './admin-vendor-table'

export default async function AdminQueuePage() {
  const t = await getTranslations('admin')
  const data = await serverFetch<AdminVendorList>('/admin/vendors?status=PENDING')

  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        {t('pendingCount', { count: data?.counts.pending ?? 0 })}
      </p>
      <AdminVendorTable items={data?.items ?? []} />
    </div>
  )
}
