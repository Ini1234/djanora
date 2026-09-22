import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/json-ld'
import { MarketingArticle, MarketingShell } from '@/components/marketing/marketing-shell'
import { breadcrumbJsonLd, pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  title: 'For vendors',
  description:
    'List your event service on Djanora. Free profile, no booking commission, reviewed before hosts see it.',
  path: '/for-vendors',
})

export default function ForVendorsPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'For vendors', path: '/for-vendors' },
        ])}
      />
      <MarketingArticle
        title="Reach hosts who are already planning"
        lede="Create a vendor profile on Djanora. Hosts inquire from the event they are already budgeting."
      >
        <p>A listed profile is free. Djanora does not take a commission when a host books you.</p>
        <h2 className="font-display pt-2 text-2xl font-semibold">How listing works</h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>Create a Djanora account and a vendor profile with your category, city, and work.</li>
          <li>Djanora reviews the profile. Pending or rejected profiles are not shown to hosts.</li>
          <li>Approved vendors receive inquiries in one dashboard.</li>
        </ol>
        <p>
          Review is done by Djanora, not by a public rating from the community. Hosts may still
          leave a review after they work with you.
        </p>
        <p>
          <Link href="/sign-up" className="btn btn-primary inline-flex">
            Create a vendor account
          </Link>
        </p>
        <p className="text-muted text-sm">
          After you sign in, open vendor mode and submit a profile. Listing is not automatic.
        </p>
      </MarketingArticle>
    </MarketingShell>
  )
}
