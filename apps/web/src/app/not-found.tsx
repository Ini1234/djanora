import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { noindexRobots } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: noindexRobots,
}

export default function NotFound() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-3xl font-semibold">Page not found</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          That URL is not a public Djanora page. The homepage explains the product.
        </p>
        <Link href="/" className="btn btn-primary mt-8 inline-flex">
          Back to Djanora
        </Link>
      </div>
    </MarketingShell>
  )
}
