import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { loadMe } from '@/lib/api.server'
import { AppShell } from '@/components/dashboard/app-shell'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { CONTACT_EMAIL, isContactReason } from '@/lib/contact'
import { pageMeta } from '@/lib/seo'
import { ContactForm } from './contact-form'

export const metadata: Metadata = pageMeta({
  title: 'Contact',
  description: `Write to Djanora at ${CONTACT_EMAIL}. Account, vendor review, and product questions.`,
  path: '/contact',
})

interface Props {
  searchParams: Promise<{ reason?: string }>
}

export default async function ContactPage({ searchParams }: Props) {
  const t = await getTranslations('contact')
  const [{ user }, { reason: rawReason }] = await Promise.all([loadMe(), searchParams])
  const reason = isContactReason(rawReason) ? rawReason : undefined
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  const form = <ContactForm email={user?.email ?? ''} name={name} reason={reason} />
  const heading = (
    <>
      <h1
        className="font-display text-2xl font-semibold sm:text-3xl"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {t('title')}
      </h1>
      <p className="mt-2 mb-8 text-sm" style={{ color: 'var(--color-muted)' }}>
        {t('subtitle')}
      </p>
    </>
  )

  if (user?.onboardingCompletedAt) {
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
          {heading}
          {form}
        </div>
      </AppShell>
    )
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        {heading}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
        >
          {form}
        </div>
      </div>
    </MarketingShell>
  )
}
