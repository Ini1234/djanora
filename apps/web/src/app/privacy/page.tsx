import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/json-ld'
import { MarketingArticle, MarketingShell } from '@/components/marketing/marketing-shell'
import { CONTACT_EMAIL, CONTACT_PATH } from '@/lib/contact'
import { breadcrumbJsonLd, pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  title: 'Privacy Policy',
  description:
    'How Djanora handles account, event, guest, and vendor data. Contact contact@djanora.com for access or deletion requests.',
  path: '/privacy',
})

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Privacy Policy', path: '/privacy' },
        ])}
      />
      <MarketingArticle
        title="Privacy Policy"
        lede="Last updated 21 September 2026. This describes the data Djanora actually stores today. It is not a claim of certification."
      >
        <h2 className="font-display text-2xl font-semibold">Who we are</h2>
        <p>
          Djanora is an event planning product operated from Ottawa, Ontario, Canada. Write to{' '}
          <Link href={CONTACT_PATH} className="underline underline-offset-2">
            {CONTACT_EMAIL}
          </Link>{' '}
          about this policy.
        </p>
        <h2 className="font-display text-2xl font-semibold">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account identity from Clerk (name, email, and the Clerk user id).</li>
          <li>Event plans you create: titles, dates, locations, budgets, checklists, notes.</li>
          <li>Guest lists and RSVP answers you or your guests submit, including dietary notes.</li>
          <li>Vendor profiles, portfolio media, and inquiries between hosts and vendors.</li>
          <li>Messages you send through the in-app contact form.</li>
          <li>Technical logs needed to run the site (for example, request errors).</li>
        </ul>
        <h2 className="font-display text-2xl font-semibold">How we use it</h2>
        <p>
          We use this data to run the product you asked for: planning an event, listing a vendor,
          sending invites, and answering support mail. We do not sell guest lists. Djanora does not
          process card payments.
        </p>
        <h2 className="font-display text-2xl font-semibold">Who can see it</h2>
        <p>
          People you invite to an event see the surfaces you grant. Approved vendor profiles are
          public. Event websites are public only when you set them to open; invite-only sites stay
          behind a guest unlock. Unique RSVP links identify a guest and are not meant to be public.
        </p>
        <h2 className="font-display text-2xl font-semibold">Where it is stored</h2>
        <p>
          Application data is stored in PostgreSQL hosted on Neon. File uploads go to Azure Blob
          Storage. Authentication is handled by Clerk. Transactional email is sent with Resend.
          Hosting runs on Microsoft Azure.
        </p>
        <h2 className="font-display text-2xl font-semibold">Retention and deletion</h2>
        <p>
          You can ask us to close an account. We treat deleted users as gone: the account is
          soft-deleted, the email is freed, and an approved vendor profile is taken off the public
          list. Write to {CONTACT_EMAIL} to request access or deletion.
        </p>
        <h2 className="font-display text-2xl font-semibold">Testing sandbox</h2>
        <p>
          test.djanora.com is a sandbox. Data you add there may be reset and should not include
          production guest lists or anything you cannot afford to lose.
        </p>
      </MarketingArticle>
    </MarketingShell>
  )
}
