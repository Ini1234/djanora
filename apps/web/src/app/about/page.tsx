import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/json-ld'
import { MarketingArticle, MarketingShell } from '@/components/marketing/marketing-shell'
import { CONTACT_EMAIL, CONTACT_PATH } from '@/lib/contact'
import { breadcrumbJsonLd, pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  title: 'About',
  description:
    'Djanora is an Ottawa event planning product for hosts and vendors. Budget, guests, vendors, and the day-of schedule live in one place.',
  path: '/about',
})

export default function AboutPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />
      <MarketingArticle
        title="About Djanora"
        lede="Djanora is software for planning a celebration and for vendors who want hosts to find them. It is based in Ottawa, Ontario."
      >
        <p>
          Hosts use Djanora to keep the budget, vendor inquiries, guest list, and day-of schedule in
          one shared plan. Collaborators can be invited to the same event instead of passing around
          spreadsheets.
        </p>
        <p>
          Vendors create a profile. Djanora reviews that profile before hosts can see it. There is
          no booking commission. Hosts and vendors contract with each other directly.
        </p>
        <h2 className="font-display pt-2 text-2xl font-semibold">What Djanora is not</h2>
        <p>
          Djanora is not a payments processor, not a venue-booking marketplace that takes a cut, and
          not a directory of every vendor in Canada. Event websites that hosts publish are theirs.
          Invite-only sites and RSVP links stay private.
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
