'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import { getErrorMessage } from '@/lib/errors'
import type { AdminUserRow } from '@/lib/admin.types'

export function AdminUsersClient({ users }: { users: AdminUserRow[] }) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function setRole(id: string, role: AdminUserRow['role']) {
    setBusyId(id)
    setError('')
    try {
      await proxyClient.post(`/admin/users/${id}/role`, { role })
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err, t('actionFailed')))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-muted)' }}>
                {t('person')}
              </th>
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-muted)' }}>
                {t('role')}
              </th>
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-muted)' }}>
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-3 py-2.5">
                  <p className="font-medium">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {user.email}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-xs">{user.role}</td>
                <td className="px-3 py-2.5">
                  {user.role === 'ADMIN' ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === user.id}
                      onClick={() =>
                        void setRole(user.id, user.hasVendorProfile ? 'VENDOR' : 'USER')
                      }
                    >
                      {t('demote')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === user.id}
                      onClick={() => void setRole(user.id, 'ADMIN')}
                    >
                      {t('promote')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
