import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Playfair_Display } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { JsonLd } from '@/components/json-ld'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const playfair  = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://caas.com'),
  title: {
    default:  'Djanora | Nigerian Wedding Planning in Ottawa',
    template: '%s | Djanora',
  },
  description:
    'Plan your Nigerian wedding in Ottawa with confidence. Djanora connects diaspora couples with culturally-informed vendors — caterers, DJs, decorators, photographers and more — all within your budget.',
  keywords: [
    'Nigerian wedding Ottawa', 'African wedding planner Canada', 'diaspora wedding planning',
    'Nigerian caterer Ottawa', 'Yoruba wedding', 'Igbo wedding', 'Hausa wedding',
    'Nigerian vendors Ottawa', 'cultural wedding planning', 'aso-ebi Ottawa',
  ],
  authors: [{ name: 'Djanora' }],
  creator: 'Djanora',
  openGraph: {
    type: 'website', locale: 'en_CA', url: 'https://caas.com', siteName: 'Djanora',
    title: 'Djanora — Plan Your Nigerian Wedding in Ottawa',
    description: 'Connect with trusted Nigerian vendors in Ottawa. Plan a culturally authentic wedding, on budget.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Djanora — Nigerian wedding planning' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Djanora — Nigerian Wedding Planning in Ottawa',
    description: 'Plan a culturally authentic Nigerian wedding in Ottawa, on budget.',
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
  url: 'https://caas.com',
  description: 'Nigerian wedding planning platform for diaspora couples in Ottawa, Canada.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://caas.com/vendors?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

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
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
