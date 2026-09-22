import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { publicGet } from '@/lib/backend'
import { loadMe } from '@/lib/api.server'
import { AppShell } from '@/components/dashboard/app-shell'
import { JsonLd } from '@/components/json-ld'
import { Footer } from '@/components/layout/footer'
import { Navbar } from '@/components/layout/navbar'
import { breadcrumbJsonLd, noindexRobots, pageMeta, vendorJsonLd } from '@/lib/seo'
import { VendorProfileClient, type VendorProfile } from './vendor-profile-client'
import type { UserMe } from '@/lib/api.types'

async function getVendor(slug: string) {
  return publicGet<VendorProfile>(`/vendors/${slug}`)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const vendor = await getVendor(slug)
  if (!vendor) return { title: 'Vendor not found', robots: noindexRobots }
  const description = vendor.bio?.trim() || `Contact ${vendor.businessName} for your event.`
  return pageMeta({
    title: vendor.businessName,
    description,
    path: `/vendors/${slug}`,
  })
}

function withShell(user: UserMe | null, children: ReactNode) {
  if (user?.onboardingCompletedAt) {
    return <AppShell user={user}>{children}</AppShell>
  }
  return (
    <div className="flex min-h-screen flex-col pt-16" style={{ background: 'var(--page-bg)' }}>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default async function VendorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [vendor, clerkUser, meResult] = await Promise.all([
    getVendor(slug),
    currentUser(),
    loadMe(),
  ])
  if (!vendor) notFound()

  const me = meResult.unavailable ? null : meResult.user
  const signedIn = Boolean(clerkUser || me)

  return withShell(
    me,
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: vendor.businessName, path: `/vendors/${slug}` },
        ])}
      />
      <JsonLd data={vendorJsonLd(vendor)} />
      <VendorProfileClient vendor={vendor} signedIn={signedIn} />
    </>,
  )
}
