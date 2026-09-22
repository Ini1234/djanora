import Link from 'next/link'
import { serverFetch } from '@/lib/api.server'
import type { AdminVendorList, AdminVendorRow } from '@/lib/admin.types'
import { AdminVendorTable } from '../admin-vendor-table'

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const data = await serverFetch<AdminVendorList>(`/admin/vendors${query}`)
  const filters: Array<AdminVendorRow['reviewStatus'] | 'ALL'> = [
    'ALL',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SUSPENDED',
  ]

  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => {
          const href = item === 'ALL' ? '/admin/vendors' : `/admin/vendors?status=${item}`
          const active = (item === 'ALL' && !status) || status === item
          return (
            <Link
              key={item}
              href={href}
              className="rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                borderColor: 'var(--color-border)',
                background: active
                  ? 'color-mix(in srgb, var(--color-brand-primary) 16%, transparent)'
                  : undefined,
              }}
            >
              {item}
            </Link>
          )
        })}
      </div>
      <AdminVendorTable items={data?.items ?? []} />
    </div>
  )
}
