import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Playfair_Display } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { JsonLd } from '@/components/json-ld'
import { AppProviders } from '@/components/app-providers'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { cookies } from 'next/headers'
import { isSessionCookieName } from '@/lib/clerk-token'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const playfair  = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://djanora.com'),
  title: {
    default:  'Djanora | Plan Your Event',
    template: '%s | Djanora',
  },
  description:
    'Plan your event with confidence. Djanora keeps budget, vendors, guests, and the day-of schedule in one place.',
  keywords: [
    'event planning', 'event planner', 'book vendors', 'event budget',
    'guest list', 'event schedule', 'catering', 'photography',
    'event vendors', 'plan your event',
  ],
  authors: [{ name: 'Djanora' }],
  creator: 'Djanora',
  openGraph: {
    type: 'website', locale: 'en_CA', url: 'https://djanora.com', siteName: 'Djanora',
    title: 'Djanora — Plan Your Event',
    description: 'Connect with trusted vendors. Plan your event on budget — guests, schedule, and bookings in one place.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Djanora — plan your event' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Djanora — Plan Your Event',
    description: 'Plan your event on budget — vendors, guests, and schedule in one place.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)',  color: '#1c1917' },
  ],
  width: 'device-width',
  initialScale: 1,
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Djanora',
  url: 'https://djanora.com',
  description: 'Event planning platform for planners and vendors — budget, vendors, guests, and schedule in one place.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://djanora.com/vendors?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const signedIn = (await cookies()).getAll().some((cookie) => isSessionCookieName(cookie.name))

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
        <JsonLd data={websiteJsonLd} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AppProviders signedIn={signedIn}>{children}</AppProviders>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
