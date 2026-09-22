import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/json-ld'
import { MarketingArticle, MarketingShell } from '@/components/marketing/marketing-shell'
import { CONTACT_EMAIL, CONTACT_PATH } from '@/lib/contact'
import { breadcrumbJsonLd, pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  title: 'Terms of Service',
  description:
    'Terms for using Djanora. The product is provided as-is. Hosts contract with vendors directly.',
  path: '/terms',
})

export default function TermsPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Terms of Service', path: '/terms' },
        ])}
      />
      <MarketingArticle
        title="Terms of Service"
        lede="Last updated 21 September 2026. These terms apply when you create an account or use a public Djanora page."
      >
        <h2 className="font-display text-2xl font-semibold">The product</h2>
        <p>
          Djanora provides software for planning events and for listing approved vendor profiles.
          Features can change. The testing sandbox at test.djanora.com may be reset without notice.
        </p>
        <h2 className="font-display text-2xl font-semibold">Your account</h2>
        <p>
          You must give a working email and keep your login to yourself. You are responsible for the
          guests, notes, and files you add. Do not upload other people’s data unless you have a
          reason to include them on that event.
        </p>
        <h2 className="font-display text-2xl font-semibold">Vendors and bookings</h2>
        <p>
          A vendor profile is a listing, not a booking contract with Djanora. Hosts and vendors make
          their own agreements. Djanora does not take a booking commission and does not process
          payments between you.
        </p>
        <h2 className="font-display text-2xl font-semibold">Event websites and invites</h2>
        <p>
          If you publish an open event site, search engines may index it. Invite-only sites, RSVP
          links, and join links are not public pages. Do not post those links on public websites if
          you want them to stay private.
        </p>
        <h2 className="font-display text-2xl font-semibold">Acceptable use</h2>
        <p>
          Do not use Djanora to spam, impersonate someone, or list a business you do not represent.
          We can suspend a profile or account that breaks these terms or that we cannot verify.
        </p>
        <h2 className="font-display text-2xl font-semibold">Liability</h2>
        <p>
          The product is provided as-is. Djanora is not liable for a cancelled vendor, a missed
          RSVP, or data you choose to put on an open event site. Ontario law applies.
        </p>
        <p>
          Questions:{' '}
          <Link href={CONTACT_PATH} className="underline underline-offset-2">
            {CONTACT_EMAIL}
          </Link>
          .
        </p>
      </MarketingArticle>
    </MarketingShell>
  )
}
