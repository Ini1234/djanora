import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Playfair_Display } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { JsonLd } from '@/components/json-ld'
import { AppProviders } from '@/components/app-providers'
import { ClerkAuthProvider } from '@/components/clerk-auth-provider'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { isSessionCookieName } from '@/lib/clerk-token'
import { isSandboxHost } from '@/lib/is-sandbox-host'
import { SandboxBanner } from '@/components/sandbox-banner'
import { SkipLink } from '@/components/skip-link'
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  indexRobots,
  noindexRobots,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers()
  const sandbox = isSandboxHost(headerList.get('x-forwarded-host') ?? headerList.get('host'))
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} | Plan Your Event`,
      template: '%s | Djanora',
    },
    description: SITE_DESCRIPTION,
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    openGraph: {
      type: 'website',
      locale: 'en_CA',
      url: SITE_URL,
      siteName: SITE_NAME,
      title: `${SITE_NAME} — Plan Your Event`,
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} — Plan Your Event`,
      description: SITE_DESCRIPTION,
    },
    robots: sandbox ? noindexRobots : indexRobots,
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const signedIn = (await cookies()).getAll().some((cookie) => isSessionCookieName(cookie.name))
  const headerList = await headers()
  const sandbox = isSandboxHost(headerList.get('x-forwarded-host') ?? headerList.get('host'))

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      data-sandbox={sandbox ? '' : undefined}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
        <SkipLink />
        <SandboxBanner />
        {!sandbox && (
          <>
            <JsonLd data={organizationJsonLd()} />
            <JsonLd data={websiteJsonLd()} />
          </>
        )}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <ClerkAuthProvider>
              <AppProviders signedIn={signedIn}>{children}</AppProviders>
            </ClerkAuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
