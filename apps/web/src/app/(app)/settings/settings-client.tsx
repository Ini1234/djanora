'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { LogOut } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import { ThemeToggle } from '@/components/theme-toggle'
import { signOutToHome } from '@/lib/client-sign-out'
import type { UserMe } from '@/lib/api.types'

const SettingsSecurity = dynamic(
  () => import('./settings-security').then((m) => m.SettingsSecurity),
  {
    ssr: false,
    loading: () => (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Loading sign-in settings…</p>
    ),
  },
)

export function SettingsClient({ user }: { user: UserMe }) {
  const [firstName, setFirstName] = useState(user.firstName ?? '')
  const [lastName, setLastName] = useState(user.lastName ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [city, setCity] = useState(user.city ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const fieldStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  } as const

  function save() {
    setError('')
    setSaved(false)
    start(async () => {
      try {
        await proxyClient.patch('/users/me', {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          city: city.trim(),
        })
        setSaved(true)
      } catch {
        setError('Could not save. Try again.')
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          Your account on Djanora
        </p>
      </div>

      <section
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Profile</h2>
        {user.email && (
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{user.email}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs space-y-1" style={{ color: 'var(--color-muted)' }}>
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full h-9 rounded-lg px-3 text-sm focus:outline-none" style={fieldStyle} />
          </label>
          <label className="text-xs space-y-1" style={{ color: 'var(--color-muted)' }}>
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full h-9 rounded-lg px-3 text-sm focus:outline-none" style={fieldStyle} />
          </label>
        </div>
        <label className="block text-xs space-y-1" style={{ color: 'var(--color-muted)' }}>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-9 rounded-lg px-3 text-sm focus:outline-none" style={fieldStyle} />
        </label>
        <label className="block text-xs space-y-1" style={{ color: 'var(--color-muted)' }}>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-9 rounded-lg px-3 text-sm focus:outline-none" style={fieldStyle} />
        </label>
        {error && <p className="text-xs" style={{ color: 'var(--color-error, #c45c4a)' }}>{error}</p>}
        {saved && <p className="text-xs" style={{ color: 'var(--color-success, #3d7a4a)' }}>Saved</p>}
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-9 px-4 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
        >
          {pending ? 'Saving…' : 'Save profile'}
        </button>
      </section>

      <section
        className="rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Appearance</h2>
        <ThemeToggle />
      </section>

      <section
        className="rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Sign-in & security</h2>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Email, password, and connected accounts.
        </p>
        <SettingsSecurity />
        <button
          type="button"
          onClick={() => void signOutToHome()}
          className="flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium"
          style={{
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </section>
    </div>
  )
}
