'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import type { AdminVendorRow } from '@/lib/admin.types'

export function reviewTone(status: AdminVendorRow['reviewStatus']) {
  if (status === 'APPROVED') return 'text-success'
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'text-danger'
  return 'text-warning'
}

export function AdminVendorTable({ items }: { items: AdminVendorRow[] }) {
  const t = useTranslations('admin')
  const tCat = useTranslations('vendorCategories')

  if (items.length === 0) {
    return <p className="text-muted text-sm">{t('empty')}</p>
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
            <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-muted)' }}>
              {t('business')}
            </th>
            <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-muted)' }}>
              {t('category')}
            </th>
            <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-muted)' }}>
              {t('status')}
            </th>
            <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-muted)' }}>
              {t('applied')}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              <td className="px-3 py-2.5">
                <Link href={`/admin/vendors/${item.id}`} className="font-medium hover:underline">
                  {item.businessName}
                </Link>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {item.user.email}
                </p>
              </td>
              <td className="px-3 py-2.5" style={{ color: 'var(--color-muted)' }}>
                {getVendorCategoryLabel(item.category, tCat)}
              </td>
              <td className={`px-3 py-2.5 text-xs font-medium ${reviewTone(item.reviewStatus)}`}>
                {t(`status_${item.reviewStatus}`)}
              </td>
              <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-muted)' }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
