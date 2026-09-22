'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { backend } from '@/lib/backend'
import { CONTACT_EMAIL, CONTACT_REASONS, type ContactReason } from '@/lib/contact'
import { getErrorMessage } from '@/lib/errors'

const fieldStyle = {
  background: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
}

type Props = {
  email?: string
  name?: string
  reason?: ContactReason
}

export function ContactForm({ email = '', name = '', reason = 'general' }: Props) {
  const t = useTranslations('contact')
  const tCommon = useTranslations('common')
  const [pending, start] = useTransition()
  const [fromName, setFromName] = useState(name)
  const [fromEmail, setFromEmail] = useState(email)
  const [topic, setTopic] = useState<ContactReason>(reason)
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function submit() {
    setError('')
    start(async () => {
      try {
        await backend.post('/contact', {
          name: fromName.trim() || undefined,
          email: fromEmail.trim(),
          reason: topic,
          message: message.trim(),
          company: company.trim() || undefined,
        })
        setSent(true)
      } catch (err) {
        setError(getErrorMessage(err, t('failed')))
      }
    })
  }

  if (sent) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('sentTitle')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          {t('sentBody', { email: CONTACT_EMAIL })}
        </p>
      </div>
    )
  }

  return (
    <form
      className="relative space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label className="block space-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
        {t('name')}
        <input
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          autoComplete="name"
          className="h-10 w-full rounded-lg px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ring)_20%,transparent)]"
          style={fieldStyle}
        />
      </label>
      <label className="block space-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
        {t('email')}
        <input
          type="email"
          required
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          autoComplete="email"
          className="h-10 w-full rounded-lg px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ring)_20%,transparent)]"
          style={fieldStyle}
        />
      </label>
      <label className="block space-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
        {t('reason')}
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactReason)}
          className="h-10 w-full rounded-lg px-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ring)_20%,transparent)]"
          style={fieldStyle}
        >
          {CONTACT_REASONS.map((value) => (
            <option key={value} value={value}>
              {t(`reason_${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
        {t('message')}
        <textarea
          required
          minLength={10}
          maxLength={4000}
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-y rounded-lg px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ring)_20%,transparent)]"
          style={fieldStyle}
        />
      </label>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="text-xs" style={{ color: 'var(--color-error, #c45c4a)' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
        style={{
          background: 'var(--color-brand-primary)',
          color: 'var(--color-primary-foreground)',
        }}
      >
        {pending ? tCommon('sending') : tCommon('submit')}
      </button>
    </form>
  )
}
