'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import { getErrorMessage } from '@/lib/errors'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'
import type { AdminVendorRow } from '@/lib/admin.types'
import { reviewTone } from '../../admin-vendor-table'

export function AdminVendorReview({ vendor }: { vendor: AdminVendorRow }) {
  const t = useTranslations('admin')
  const tCat = useTranslations('vendorCategories')
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function act(path: string, body?: { reason: string }) {
    setBusy(true)
    setError('')
    try {
      await proxyClient.post(`/admin/vendors/${vendor.id}/${path}`, body)
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err, t('actionFailed')))
    } finally {
      setBusy(false)
    }
  }

  const city = vendor.city || vendor.user.city
  const name = [vendor.user.firstName, vendor.user.lastName].filter(Boolean).join(' ')

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className={`text-xs font-medium ${reviewTone(vendor.reviewStatus)}`}>
          {t(`status_${vendor.reviewStatus}`)}
        </p>
        <h2 className="font-display mt-1 text-2xl font-semibold">{vendor.businessName}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
          {name || vendor.user.email} · {vendor.user.email}
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt style={{ color: 'var(--color-muted)' }}>{t('category')}</dt>
          <dd>{getVendorCategoryLabel(vendor.category, tCat)}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--color-muted)' }}>{t('city')}</dt>
          <dd>{city || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt style={{ color: 'var(--color-muted)' }}>{t('bio')}</dt>
          <dd className="whitespace-pre-wrap">{vendor.bio || '—'}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--color-muted)' }}>{t('price')}</dt>
          <dd>
            {vendor.estimatedPriceFrom != null
              ? `${vendor.currency} ${vendor.estimatedPriceFrom}${vendor.estimatedPriceTo != null ? `–${vendor.estimatedPriceTo}` : '+'}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--color-muted)' }}>{t('links')}</dt>
          <dd className="space-y-1">
            {vendor.websiteUrl && (
              <a
                className="block underline"
                href={vendor.websiteUrl}
                target="_blank"
                rel="noreferrer"
              >
                {vendor.websiteUrl}
              </a>
            )}
            {vendor.instagramUrl && (
              <a
                className="block underline"
                href={vendor.instagramUrl}
                target="_blank"
                rel="noreferrer"
              >
                {vendor.instagramUrl}
              </a>
            )}
            {vendor.facebookUrl && (
              <a
                className="block underline"
                href={vendor.facebookUrl}
                target="_blank"
                rel="noreferrer"
              >
                {vendor.facebookUrl}
              </a>
            )}
            {!vendor.websiteUrl && !vendor.instagramUrl && !vendor.facebookUrl && '—'}
          </dd>
        </div>
      </dl>

      {vendor.reviewNote && (
        <p
          className="rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {t('lastNote')}: {vendor.reviewNote}
        </p>
      )}

      <label className="block text-sm">
        <span style={{ color: 'var(--color-muted)' }}>{t('reason')}</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border px-3 py-2"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
        />
      </label>

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {vendor.reviewStatus !== 'APPROVED' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void act('approve')}
          >
            {t('approve')}
          </button>
        )}
        {vendor.reviewStatus !== 'REJECTED' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || reason.trim().length < 4}
            onClick={() => void act('reject', { reason: reason.trim() })}
          >
            {t('reject')}
          </button>
        )}
        {vendor.reviewStatus === 'APPROVED' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || reason.trim().length < 4}
            onClick={() => void act('suspend', { reason: reason.trim() })}
          >
            {t('suspend')}
          </button>
        )}
        {vendor.reviewStatus === 'SUSPENDED' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void act('restore')}
          >
            {t('restore')}
          </button>
        )}
      </div>
    </div>
  )
}
