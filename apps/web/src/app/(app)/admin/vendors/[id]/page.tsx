import { notFound } from 'next/navigation'
import { serverFetch } from '@/lib/api.server'
import type { AdminVendorRow } from '@/lib/admin.types'
import { AdminVendorReview } from './admin-vendor-review'

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vendor = await serverFetch<AdminVendorRow>(`/admin/vendors/${id}`)
  if (!vendor) notFound()
  return <AdminVendorReview vendor={vendor} />
}
