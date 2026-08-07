import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Playfair_Display } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://caas.com'),
  title: {
    default: 'CaaS — Culture as a Service | Nigerian Wedding Planning in Ottawa',
    template: '%s | CaaS',
  },
  description:
    'Plan your Nigerian wedding in Ottawa with confidence. CaaS connects diaspora couples with culturally-informed vendors — caterers, DJs, decorators, photographers and more — all within your budget.',
  keywords: [
    'Nigerian wedding Ottawa',
    'African wedding planner Canada',
    'diaspora wedding planning',
    'Nigerian caterer Ottawa',
    'Yoruba wedding',
    'Igbo wedding',
    'Hausa wedding',
    'Nigerian vendors Ottawa',
    'cultural wedding planning',
    'aso-ebi Ottawa',
  ],
  authors: [{ name: 'CaaS' }],
  creator: 'CaaS',
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: 'https://caas.com',
    siteName: 'CaaS',
    title: 'CaaS — Plan Your Nigerian Wedding in Ottawa',
    description:
      'Connect with trusted Nigerian vendors in Ottawa. Plan a culturally authentic wedding, on budget.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'CaaS — Culture as a Service' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CaaS — Nigerian Wedding Planning in Ottawa',
    description: 'Plan a culturally authentic Nigerian wedding in Ottawa, on budget.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
}

export const viewport: Viewport = {
  themeColor: '#1a3a2a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en-CA"
        className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
